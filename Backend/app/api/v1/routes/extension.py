"""
Extension Download API
Serves the browser extension as a downloadable zip file
"""
from fastapi import APIRouter, HTTPException, Request, Header
from fastapi.responses import FileResponse
import os
import zipfile
import tempfile
from pathlib import Path
from datetime import datetime, timedelta
import json
import uuid
from PyPDF2 import PdfReader
import requests
from googleapiclient.discovery import build
import httpx
from bs4 import BeautifulSoup

from app.core.security import create_jwt, decode_jwt
from app.db.sessions import AsyncSessionLocal
from sqlalchemy.future import select
from app.modals.user import User
from app.core.gemini_client import generate_tags  
from app.core.config import settings

router = APIRouter()


def _find_extension_dir() -> Path:
    """Resolve the filesystem location of the extension source.

    The backend now ships with ``Backend/Extension`` by default, so we walk up
    from this file until that directory is found. Deployments may still
    override the location via the ``EXTENSION_DIR`` environment variable when
    the extension assets live elsewhere.
    """
    # Allow the deployment to explicitly provide the path when the Extension folder
    # is not co-located with the backend source (e.g., Render service with root dir=Backend).
    override = os.getenv("EXTENSION_DIR")
    if override:
        override_path = Path(override).expanduser().resolve()
        if override_path.exists() and override_path.is_dir():
            return override_path

    start = Path(__file__).resolve()
    for parent in start.parents:
        candidate = parent / "Extension"
        if candidate.exists() and candidate.is_dir():
            return candidate
    raise FileNotFoundError(
        f"Extension folder not found. Searched upwards from {start}."
    )


def create_extension_zip(device_token: str = None) -> str:
    """
    Create a zip file of the Extension folder. Optionally embed a device_token.json file
    into the archive so a downloaded build can auto-link the extension to a user.
    """
    # Create temporary zip file
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    temp_dir = tempfile.gettempdir()
    zip_path = os.path.join(temp_dir, f"mindflow-extension-{timestamp}.zip")
    
    # Resolve the Extension directory dynamically by traversing parents
    extension_dir = _find_extension_dir()
    
    if not extension_dir.exists():
        raise FileNotFoundError("Extension folder not found")

    # Files to include in the zip
    files_to_include = [
        "manifest.json",
        "background.js",
        "content-script.js",
        "auth-callback.html",
        "check-auth-status.js",
        "popup/popup.html",
        "popup/popup.js",
        "popup/popup.css",
        "icons/icon48.svg",
        "README.md",
        "INSTALL_AND_TEST.md",
    ]
    
    # Create zip file
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for file_path in files_to_include:
            full_path = extension_dir / file_path
            if full_path.exists():
                # Add file with relative path inside zip
                zipf.write(full_path, f"mindflow-extension/{file_path}")
        
        # Add icons directory if it exists
        icons_dir = extension_dir / "icons"
        if icons_dir.exists():
            for icon_file in icons_dir.glob("*.svg"):
                zipf.write(icon_file, f"mindflow-extension/icons/{icon_file.name}")
            for icon_file in icons_dir.glob("*.png"):
                zipf.write(icon_file, f"mindflow-extension/icons/{icon_file.name}")
        # Embed deployment-specific configuration so the background worker knows
        # which API/Dashboard URLs to target after download. These can be
        # overridden via env vars when building the backend image.
        api_base = os.getenv("EXTENSION_API_BASE_URL", settings.BACKEND_PUBLIC_URL).rstrip("/") or "http://localhost:8000"
        dashboard_base = os.getenv("EXTENSION_DASHBOARD_URL", settings.FRONTEND_URL).rstrip("/") or "http://localhost:8080"
        zipf.writestr(
            "mindflow-extension/extension.config.json",
            json.dumps({
                "api_base_url": api_base,
                "dashboard_url": dashboard_base,
            }, indent=2)
        )
        # Optionally embed a device token file so the installed extension can auto-link
        # Do this regardless of whether an icons directory exists.
        if device_token:
            token_obj = {"device_token": device_token}
            # write token JSON into the archive
            zipf.writestr("mindflow-extension/device_token.json", json.dumps(token_obj))
    
    return zip_path


@router.get("/download")
async def download_extension(device_token: str = None):
    """
    Downloads the browser extension as a zip file
    
    Returns:
        FileResponse: Zip file containing the extension
    """
    try:
        # Create zip file (optionally embed provided device token)
        zip_path = create_extension_zip(device_token=device_token)

        # Generate filename
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        filename = f"mindflow-extension-{timestamp}.zip"

        # Return file response
        return FileResponse(
            path=zip_path,
            media_type="application/zip",
            filename=filename,
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Cache-Control": "no-cache",
            },
        )
        
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create extension package: {str(e)}")


@router.post("/generate-device-token")
async def generate_device_token(request: Request, authorization: str = Header(None)):
    """
    Generate a long-lived device token tied to the authenticated user.
    The caller must include the user's Bearer token in the Authorization header.
    Returns: { device_token: "..." }
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    token = authorization.split(" ")[-1]
    payload = decode_jwt(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    # Verify user exists
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(User).where(User.id == int(user_id)))
        user = res.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

    # Create a device-scoped JWT (long-lived). Includes jti for potential revocation tracking.
    # Device tokens are intended to live much longer than interactive user
    # sessions (used when embedding a token into the extension zip). Use a
    # long expiry (e.g., 1 year) so users don't see immediate 401s.
    jti = str(uuid.uuid4())
    device_token = create_jwt({"sub": str(user.id), "device": True, "jti": jti}, expires_delta=timedelta(days=365))

    return {"device_token": device_token}


@router.get("/info")
async def extension_info():
    """
    Returns information about the extension
    
    Returns:
        dict: Extension metadata
    """
    return {
        "name": "MindFlow Capture Extension",
        "version": "1.0.0",
        "description": "Capture and save content from any webpage with AI-powered organization",
        "features": [
            "Right-click to save text, links, images, and videos",
            "AI-powered automatic tagging",
            "Instant sync with dashboard",
            "Desktop notifications",
        ],
        "installation_steps": [
            "Download the extension zip file",
            "Extract the zip file",
            "Go to chrome://extensions/",
            "Enable 'Developer mode' (top right)",
            "Click 'Load unpacked'",
            "Select the extracted mindflow-extension folder",
            "Sign in with your MindFlow account",
        ]
    }


# YouTube Data API setup (replace with your API key)
YOUTUBE_API_KEY = "YOUR_YOUTUBE_API_KEY"

async def analyze_pdf(file_path: str) -> dict:
    """
    Extract text from a PDF and generate tags using NLP.
    """
    try:
        reader = PdfReader(file_path)
        text = " ".join(page.extract_text() or "" for page in reader.pages)
        tag_payload = await generate_tags(text)

        # Ensure structure matches expectations
        tags = tag_payload.get("tags", []) if isinstance(tag_payload, dict) else []
        category = tag_payload.get("category") if isinstance(tag_payload, dict) else None
        title = tag_payload.get("title") if isinstance(tag_payload, dict) else None

        return {
            "text": text[:500],
            "tags": tags,
            "category": category,
            "title": title,
        }
    except Exception as e:
        return {"error": str(e)}

async def analyze_youtube_video(video_url: str) -> dict:
    """
    Download the YouTube video and analyze its content to generate tags and a description.
    """
    try:
        # Use the analyze_video function from gemini_client.py
        from app.core.gemini_client import analyze_video

        # Analyze the video content
        analysis_result = await analyze_video(video_url)

        # Return the analysis result
        return {
            "title": analysis_result.get("title", "Untitled Video"),
            "description": analysis_result.get("description", ""),
            "tags": analysis_result.get("tags", [])
        }
    except Exception as e:
        return {"error": str(e)}

@router.post("/analyze-content")
async def analyze_content(file: bytes = None, url: str = None):
    """
    Analyze a given file (PDF) or URL (image, video, webpage) and return relevant tags and description.
    """
    from app.core.gemini_client import analyze_video, analyze_image, generate_tags, generate_description

    if file:
        # Save the uploaded file temporarily
        temp_file_path = tempfile.mktemp(suffix=".pdf")
        with open(temp_file_path, "wb") as f:
            f.write(file)
        try:
            result = await analyze_pdf(temp_file_path)
        finally:
            try:
                os.remove(temp_file_path)
            except OSError:
                pass
        return result

    if url:
        try:
            # Perform a HEAD request to determine content type
            async with httpx.AsyncClient() as client:
                head_response = await client.head(url, follow_redirects=True)
                content_type = head_response.headers.get("Content-Type", "").lower()

            # Determine content type by extension or header
            if "image" in content_type or url.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp')):
                # Analyze image content
                return await analyze_image(url)

            elif "video" in content_type or url.lower().endswith(('.mp4', '.avi', '.mov', '.mkv', '.webm')):
                # Analyze video content
                return await analyze_video(url)

            elif "pdf" in content_type or url.lower().endswith('.pdf'):
                # Download and analyze PDF content
                async with httpx.AsyncClient() as client:
                    response = await client.get(url)
                    response.raise_for_status()
                    temp_file_path = tempfile.mktemp(suffix=".pdf")
                    with open(temp_file_path, "wb") as f:
                        f.write(response.content)
                    result = await analyze_pdf(temp_file_path)
                    os.remove(temp_file_path)  # Clean up
                    return result

            elif "html" in content_type or url.lower().endswith(('.html', '.htm')):
                # Fetch and analyze webpage content
                async with httpx.AsyncClient() as client:
                    response = await client.get(url)
                    response.raise_for_status()
                    html_content = response.text

                # Extract meaningful text from the webpage
                soup = BeautifulSoup(html_content, 'html.parser')
                text = soup.get_text(separator=' ', strip=True)

                # Generate tags and description for the webpage
                tags = await generate_tags(text)
                description = await generate_description(text)

                return {
                    "tags": tags.get("tags", []),
                    "category": tags.get("category", "general"),
                    "title": tags.get("title", "Untitled"),
                    "description": description
                }

            else:
                return {"error": "Unsupported content type. Provide a valid image, video, PDF, or webpage URL."}

        except Exception as e:
            return {"error": f"Failed to analyze URL: {str(e)}"}

    return {"error": "No file or URL provided. Provide a PDF file or a valid URL."}
