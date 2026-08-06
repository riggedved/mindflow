from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import Optional, List
from app.db.sessions import get_db
from app.modals.item import Item
from app.modals.user import User
from app.core.gemini_client import create_embedding, generate_tags, analyze_image, analyze_video, generate_description
from app.api.v1.routes.extension import analyze_content
import httpx
from app.core.security import decode_jwt
from app.services.supabase_service import supabase_service
from app.services.space_service import SpaceService
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from bs4 import BeautifulSoup
from urllib.parse import urlparse, parse_qs


def _looks_like_url(value: Optional[str]) -> bool:
    return bool(value and isinstance(value, str) and value.startswith(("http://", "https://")))


async def _fetch_page_metadata(url: Optional[str]) -> dict:
    """Fetch Open Graph metadata and a text sample for a given URL."""
    if not _looks_like_url(url):
        return {}

    is_youtube = _is_youtube_url(url)

    headers = {
        "User-Agent": "MindFlowBot/1.0 (+https://mindflow.ai)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    try:
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in (403, 429) and is_youtube:
            fallback = await _fetch_youtube_oembed_metadata(url)
            if fallback:
                return fallback
        print(f"Page metadata fetch failed for {url}: {exc}")
        return {}
    except httpx.RequestError as exc:
        if is_youtube:
            fallback = await _fetch_youtube_oembed_metadata(url)
            if fallback:
                return fallback
        print(f"Page metadata fetch failed for {url}: {exc}")
        return {}

    content_type = response.headers.get("content-type", "").lower()
    if "pdf" in content_type:
        return {"content_type": "application/pdf"}

    if "html" not in content_type:
        return {"content_type": content_type or None}

    html = response.text
    soup = BeautifulSoup(html, "html.parser")

    def _meta(name: str, attr: str = "property"):
        el = soup.find("meta", attrs={attr: name})
        return el.get("content") if el else None

    og_title = _meta("og:title") or _meta("twitter:title")
    og_description = _meta("og:description") or _meta("twitter:description")
    og_image = _meta("og:image") or _meta("twitter:image")
    og_video = _meta("og:video")
    og_type = _meta("og:type")
    canonical_link = soup.find("link", rel="canonical")

    # Fallbacks to standard metadata
    title = og_title or (soup.title.string.strip() if soup.title and soup.title.string else None)
    description = og_description
    if not description:
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc and meta_desc.get("content"):
            description = meta_desc.get("content").strip()

    def _clean(value: Optional[str]) -> Optional[str]:
        if not value:
            return value
        return value.replace("\x00", "").strip()

    title = _clean(title)
    description = _clean(description)

    text_content = soup.get_text(" ", strip=True) if soup else ""
    text_content = _clean(text_content) or ""
    text_sample = text_content[:4000] if text_content else ""

    return {
        "title": title,
        "description": description,
        "text": text_sample,
        "og_image": og_image,
        "og_video": og_video,
        "og_type": og_type,
        "canonical": canonical_link.get("href") if canonical_link else None,
        "content_type": content_type,
    }


def _youtube_embed_url(url: str) -> Optional[str]:
    if not _looks_like_url(url):
        return None
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    if "youtube.com" in host:
        if parsed.path.startswith("/watch"):
            video_id = parse_qs(parsed.query).get("v", [None])[0]
        elif parsed.path.startswith("/shorts/"):
            video_id = parsed.path.split("/")[-1]
        else:
            video_id = parsed.path.strip("/")
        if video_id:
            return f"https://www.youtube.com/embed/{video_id}"
    if "youtu.be" in host:
        video_id = parsed.path.strip("/")
        if video_id:
            return f"https://www.youtube.com/embed/{video_id}"
    return None


def _is_youtube_url(url: Optional[str]) -> bool:
    if not _looks_like_url(url):
        return False
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    return "youtube.com" in host or "youtu.be" in host


async def _fetch_youtube_oembed_metadata(url: str) -> Optional[dict]:
    oembed_url = "https://www.youtube.com/oembed"
    params = {"url": url, "format": "json"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                oembed_url,
                params=params,
                headers={
                    "User-Agent": "MindFlowBot/1.0 (+https://mindflow.ai)",
                    "Accept": "application/json",
                },
            )
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        print(f"YouTube oEmbed metadata fetch failed for {url}: {exc}")
        return None

    embed_url = _youtube_embed_url(url)
    description_parts: List[str] = []
    author = data.get("author_name")
    provider = data.get("provider_name")
    if author:
        description_parts.append(f"Creator: {author}")
    if provider:
        description_parts.append(f"Platform: {provider}")

    description = " | ".join(description_parts) if description_parts else None

    title = data.get("title")

    return {
        "title": title,
        "description": description,
        "text": title or description or "",
        "og_image": data.get("thumbnail_url"),
        "og_video": embed_url,
        "og_type": data.get("type") or "video",
        "canonical": url,
        "content_type": "text/html",
    }

router = APIRouter()
security = HTTPBearer()


class CreateItemRequest(BaseModel):
    type: str  # note, link, image, video, article
    content: str
    title: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    source_url: Optional[str] = None
    page_title: Optional[str] = None
    preview_content: Optional[str] = None

    class Config:
        extra = "ignore"


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: AsyncSession = Depends(get_db)):
    """Get current user from JWT token"""
    token = credentials.credentials
    payload = decode_jwt(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    
    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    
    return user


@router.get("/")
async def get_items(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all items for the current user"""
    result = await db.execute(
        select(Item).where(Item.user_id == current_user.id).order_by(Item.created_at.desc())
    )
    items = result.scalars().all()
    
    # Transform items to include folder from ai_meta
    items_list = []
    for item in items:
        content_value = item.content
        url_value = None
        if _looks_like_url(item.url):
            url_value = item.url
        elif _looks_like_url(content_value):
            url_value = content_value

        ai_meta = item.ai_meta or {}
        source_value = ai_meta.get("source_url") if _looks_like_url(ai_meta.get("source_url")) else None
        if not source_value:
            source_value = url_value if url_value else None

        item_dict = {
            "id": item.id,
            "type": item.type,
            # Expose AI-generated description for frontend display. Raw content
            # is kept in the DB but not used for display in the UI.
            "description": (item.ai_meta.get("description") if item.ai_meta else item.title),
            "title": item.title,
            "raw_content": content_value,
            "url": url_value,
            "source_url": source_value,
            "storage_path": item.storage_path,
            "mime_type": item.mime_type,
            "tags": item.tags or [],
            "folder": ai_meta.get("category", "general"),
            "preview": ai_meta.get("preview"),
            "thumbnail": ai_meta.get("thumbnail"),
                "created_at": item.created_at,
                "space_id": item.space_id
        }
        items_list.append(item_dict)
    
    return {"items": items_list}


@router.post("/upload")
async def upload_item(
    file: UploadFile = File(...),
    type: str = Form(...),
    title: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload an image, video, or PDF article file and create an item"""
    description_text = ""
    preview_payload: Optional[dict] = None
    file_bytes: Optional[bytes] = None
    try:
        # Validate file type
        if type == "image" and not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Invalid image file")
        if type == "video" and not file.content_type.startswith("video/"):
            raise HTTPException(status_code=400, detail="Invalid video file")
        if type == "article" and file.content_type not in ("application/pdf",):
            raise HTTPException(status_code=400, detail="Only PDF articles are supported right now")

        if type == "article":
            try:
                file_bytes = await file.read()
            finally:
                await file.seek(0)

        # Upload file to Supabase
        upload_result = await supabase_service.upload_file(file, current_user.id)
        storage_path = upload_result["storage_path"]
        public_url = upload_result["public_url"]
        mime_type = upload_result["mime_type"]

        # Analyze image/video/pdf with Gemini (generates tags, title, description from actual content)
        if type == "image":
            ai_result = await analyze_image(public_url, title or "")
        elif type == "video":
            ai_result = await analyze_video(public_url, title or "")
        elif type == "article":
            analysis_payload = None
            if file_bytes:
                analysis_payload = await analyze_content(file=file_bytes)
            else:
                analysis_payload = await analyze_content(url=public_url)

            ai_result = analysis_payload if analysis_payload and "error" not in analysis_payload else {}
            text_excerpt = ai_result.get("text") or ""
            raw_tags = ai_result.get("tags") or []
            tags_list = list(raw_tags) if isinstance(raw_tags, (list, tuple, set)) else []
            category_value = ai_result.get("category") or "general"
            summary = ai_result.get("description") or ""
            if not summary and text_excerpt:
                summary = await generate_description(text_excerpt[:4000])
            description_text = summary or text_excerpt[:512] or description_text
            ai_generated_title = ai_result.get("title") or (title or (file.filename if file else "PDF document"))

            # Normalize AI payload for downstream logic
            ai_result["tags"] = tags_list
            ai_result["category"] = category_value
            ai_result["title"] = ai_generated_title
            if description_text:
                ai_result["description"] = description_text
            if text_excerpt and "text" not in ai_result:
                ai_result["text"] = text_excerpt

            preview_payload = {"type": "pdf", "value": public_url}

        else:
            raise HTTPException(status_code=400, detail="Invalid file type")

        tags = ai_result.get("tags", [])
        if not isinstance(tags, list):
            tags = list(tags) if tags else []
        category = ai_result.get("category", "general")
        # Prefer the generated description for articles; for other types keep prior behavior
        if type == "article":
            description = description_text or (title or file.filename or "PDF document")
        else:
            description = ai_result.get("description", "")
        ai_generated_title = ai_result.get("title", f"{type.capitalize()} - {file.filename}")

        # Use AI-generated title as the canonical title (preferred)
        final_title = ai_generated_title

        # Generate embedding from description or title
        embedding_text = description or final_title or f"{type} file"
        embedding = await create_embedding(embedding_text)

        # Create the item and store the public URL as content/url
        new_item = Item(
            user_id=current_user.id,
            type=type,
            content=public_url,
            title=final_title,
            tags=tags,
            storage_path=storage_path,
            url=public_url,
            mime_type=mime_type,
            ai_meta={
                "category": category,
                "embedding": embedding,
                "ai_generated": True,
                "description": description,
                "preview": preview_payload,
                "source_url": public_url,
                "text_excerpt": ai_result.get("text", "")
            }
        )

        db.add(new_item)
        await db.commit()
        await db.refresh(new_item)

        # Auto-assign to best matching space
        try:
            best_space = await SpaceService.find_best_space(embedding, current_user.id, db)
            if best_space:
                await SpaceService.assign_item_to_space(new_item.id, best_space.id, db)
                await db.refresh(new_item)
        except Exception as e:
            print(f"Failed to auto-assign to space: {str(e)}")
            # Don't fail the whole request if space assignment fails

        return {
            "id": new_item.id,
            "type": new_item.type,
            "description": description,
            "title": final_title,
            "raw_content": new_item.content,
            "url": public_url,
            "storage_path": storage_path,
            "tags": new_item.tags,
            "folder": f"AI/{category}" if category else "General",
            "created_at": new_item.created_at,
            "preview": preview_payload,
            "space_id": new_item.space_id
        }
    except Exception as e:
        await db.rollback()
        print(f"Error uploading file: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")


@router.post("/")
async def create_item(
    request: CreateItemRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new item with AI-generated tags, title, and embeddings"""
    try:
        source_url = request.source_url
        if not source_url and request.type in {"link", "article", "video"} and _looks_like_url(request.content):
            source_url = request.content
        if not source_url and _looks_like_url(request.preview_content):
            source_url = request.preview_content

        page_metadata = await _fetch_page_metadata(source_url) if source_url else {}
        page_title = request.page_title or page_metadata.get("title") or request.title

        preview_value = request.preview_content or request.content
        preview_struct = {"type": request.type, "value": preview_value}

        tags: List[str] = []
        category: str = "general"
        description: str = request.description or page_metadata.get("description", "")
        final_title: str = page_title or request.title or ""
        ai_content: str = ""
        thumbnail: Optional[str] = page_metadata.get("og_image") if page_metadata else None

        # Branch per content type to build preview + AI signals
        if request.type == "note":
            snippet = (request.content or "").strip()
            preview_struct = {"type": "text", "value": snippet}
            context = " ".join(filter(None, [snippet, page_metadata.get("text")]))[:5000]
            context = context or snippet or (page_title or "Saved note")
            ai_result = await generate_tags(context)
            tags = ai_result.get("tags", [])
            category = ai_result.get("category", "general")
            final_title = ai_result.get("title") or final_title or page_title or "Saved Note"
            description = description or await generate_description(context)
            ai_content = description or context or final_title
        elif request.type == "image" and _looks_like_url(request.content):
            preview_struct = {"type": "image", "value": request.content}
            ai_result = await analyze_image(request.content, page_title or request.title or "")
            tags = ai_result.get("tags", [])
            category = ai_result.get("category", "general")
            description = ai_result.get("description") or description
            final_title = ai_result.get("title") or final_title or "Saved Image"
            ai_content = description or final_title or "Image content"
        elif request.type == "video" and _looks_like_url(preview_value):
            video_exts = (".mp4", ".m4v", ".mov", ".webm", ".avi", ".mkv")
            is_direct_asset = request.content.lower().endswith(video_exts)
            embed_candidate = _youtube_embed_url(source_url or request.content)
            if not embed_candidate and page_metadata.get("og_video"):
                embed_candidate = page_metadata["og_video"]
            preview_struct = {"type": "video", "value": embed_candidate or request.content}

            if is_direct_asset and not embed_candidate:
                ai_result = await analyze_video(request.content, page_title or request.title or "")
                tags = ai_result.get("tags", [])
                category = ai_result.get("category", "general")
                description = ai_result.get("description") or description
                final_title = ai_result.get("title") or final_title or "Saved Video"
            else:
                context_seed = " ".join(filter(None, [
                    page_metadata.get("title"),
                    page_metadata.get("description"),
                    page_metadata.get("text"),
                ]))[:5000]
                if not context_seed:
                    context_seed = request.title or "Video content"
                ai_result = await generate_tags(context_seed)
                tags = ai_result.get("tags", [])
                category = ai_result.get("category", "general")
                final_title = ai_result.get("title") or final_title or page_title or "Saved Video"
                description = description or await generate_description(context_seed)
            if not description:
                description = await generate_description(final_title or "Video content")
            ai_content = description or final_title or "Video content"
        elif request.type == "article":
            pdf_detected = request.content.lower().endswith(".pdf") or (page_metadata.get("content_type") == "application/pdf")
            preview_struct = {
                "type": "pdf" if pdf_detected else "link",
                "value": request.content if pdf_detected else (source_url or request.content),
            }
            article_context = ""
            if pdf_detected:
                try:
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        resp = await client.get(request.content)
                        resp.raise_for_status()
                        pdf_bytes = resp.content
                except Exception as exc:
                    print(f"Warning: failed to fetch PDF for AI analysis: {exc}")
                    pdf_bytes = b""

                if pdf_bytes:
                    try:
                        from pypdf import PdfReader
                        import io as _io

                        reader = PdfReader(_io.BytesIO(pdf_bytes))
                        max_pages = min(5, len(reader.pages))
                        chunks = []
                        for i in range(max_pages):
                            try:
                                chunks.append(reader.pages[i].extract_text() or "")
                            except Exception:
                                chunks.append("")
                        article_context = "\n\n".join(chunks).strip()
                    except Exception as exc:
                        print(f"PDF text extraction failed: {exc}")
            else:
                article_context = page_metadata.get("text") or page_metadata.get("description") or ""

            article_context = article_context[:8000] if article_context else (page_title or request.title or "Article content")
            ai_result = await generate_tags(article_context)
            tags = ai_result.get("tags", [])
            category = ai_result.get("category", "general")
            final_title = ai_result.get("title") or final_title or page_title or "Saved Article"
            description = description or await generate_description(article_context)
            ai_content = description or article_context or final_title
        elif request.type == "link" and (source_url or _looks_like_url(request.content)):
            link_url = source_url or request.content
            preview_struct = {"type": "link", "value": link_url}
            link_context = " ".join(filter(None, [
                page_metadata.get("title"),
                page_metadata.get("description"),
                page_metadata.get("text"),
            ]))[:5000]
            if not link_context:
                link_context = link_url
            ai_result = await generate_tags(link_context)
            tags = ai_result.get("tags", [])
            category = ai_result.get("category", "general")
            final_title = ai_result.get("title") or final_title or page_title or "Saved Link"
            description = description or await generate_description(link_context)
            ai_content = description or link_context or final_title
        else:
            preview_struct = {"type": request.type, "value": preview_value}
            fallback_context = request.content or page_metadata.get("text") or final_title or request.type
            ai_result = await generate_tags(fallback_context)
            tags = ai_result.get("tags", [])
            category = ai_result.get("category", "general")
            final_title = ai_result.get("title") or final_title or request.type.title()
            description = description or await generate_description(fallback_context)
            ai_content = description or fallback_context or final_title

        if not description:
            description = request.description or page_metadata.get("description") or final_title or request.type.title()

        if not tags:
            fallback_text = " ".join(filter(None, [ai_content, description, final_title])) or request.type
            fallback_result = await generate_tags(fallback_text)
            tags = fallback_result.get("tags", [request.type])
            category = fallback_result.get("category", category or "general")
            if not final_title:
                final_title = fallback_result.get("title") or request.title or request.type.title()

        ai_content = ai_content or description or final_title or request.type.title()

        embedding = await create_embedding(ai_content)
        if embedding is None:
            raise HTTPException(
                status_code=500,
                detail="AI embedding generation failed. Embeddings are required for semantic search."
            )

        item_content = preview_struct.get("value") or request.content

        new_item = Item(
            user_id=current_user.id,
            type=request.type,
            content=item_content,
            title=final_title,
            tags=tags,
            url=source_url,
            ai_meta={
                "category": category,
                "embedding": embedding,
                "ai_generated": True,
                "description": description,
                "preview": preview_struct,
                "source_url": source_url,
                "thumbnail": thumbnail,
                "original_title": request.title if request.title else None,
                "page": page_metadata,
            }
        )
        
        db.add(new_item)
        await db.commit()
        await db.refresh(new_item)
        
        # Auto-assign to best matching space
        try:
            best_space = await SpaceService.find_best_space(embedding, current_user.id, db)
            if best_space:
                await SpaceService.assign_item_to_space(new_item.id, best_space.id, db)
                await db.refresh(new_item)
        except Exception as e:
            print(f"Failed to auto-assign to space: {str(e)}")
            # Don't fail the whole request if space assignment fails
        
        preview_payload = new_item.ai_meta.get("preview") if new_item.ai_meta else None
        return {
            "id": new_item.id,
            "type": new_item.type,
            "description": (new_item.ai_meta.get("description") if new_item.ai_meta else new_item.title),
            "title": new_item.title,
            "raw_content": new_item.content,
            "tags": new_item.tags,
            "url": new_item.url,
            "source_url": new_item.url,
            "preview": preview_payload,
            "folder": f"AI/{category}" if category else "General",
            "created_at": new_item.created_at,
            "space_id": new_item.space_id
        }
    except Exception as e:
        await db.rollback()
        print(f"Error creating item: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create item: {str(e)}")


@router.get("/{item_id}")
async def get_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific item"""
    result = await db.execute(
        select(Item).where(Item.id == item_id, Item.user_id == current_user.id)
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    # Return a normalized dict matching the list GET shape so the frontend
    # can rely on consistent keys (description, raw_content, url, tags, folder).
    item_dict = {
        "id": item.id,
        "type": item.type,
        "description": (item.ai_meta.get("description") if item.ai_meta else item.title),
        "raw_content": item.content,
        "url": item.url if item.url else item.content,
        "source_url": item.url if item.url else (item.ai_meta.get("source_url") if item.ai_meta else None),
        "storage_path": item.storage_path,
        "mime_type": item.mime_type,
        "tags": item.tags or [],
        "folder": item.ai_meta.get("category", "general") if item.ai_meta else "general",
        "created_at": item.created_at,
        "title": item.title,
        "preview": item.ai_meta.get("preview") if item.ai_meta else None,
        "thumbnail": item.ai_meta.get("thumbnail") if item.ai_meta else None,
            "space_id": item.space_id,
    }

    return item_dict


@router.put("/{item_id}/")
async def update_item(
    item_id: int,
    request: CreateItemRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update an item with optional manual tag editing"""
    result = await db.execute(
        select(Item).where(Item.id == item_id, Item.user_id == current_user.id)
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    try:
        # Update basic fields
        # Keep raw content stored but allow updating if provided
        if request.content:
            item.content = request.content
        item.type = request.type

        # Update description if provided (maps to ai_meta.description)
        if request.description is not None:
            meta = item.ai_meta or {}
            meta["description"] = request.description
            item.ai_meta = meta

        # Handle tags - use manual tags if provided, otherwise regenerate with AI
        if request.tags is not None:
            # User provided manual tags
            tags = request.tags
            category = item.ai_meta.get("category", "general") if item.ai_meta else "general"
        else:
            # Regenerate AI tags if description/content changed
            ai_content = request.description or request.content
            if not ai_content or len(str(ai_content).strip()) < 3:
                if request.title and len(request.title) > 3:
                    ai_content = request.title
                elif request.type == "image":
                    ai_content = f"Image description"
                elif request.type == "video":
                    ai_content = f"Video description"
                elif request.type == "link":
                    ai_content = f"Link: {request.content}"
                else:
                    ai_content = f"{request.type} content"

            # Regenerate tags and category with AI
            ai_result = await generate_tags(ai_content)
            tags = ai_result.get("tags", [])
            category = ai_result.get("category", "general")
            # Also generate a short description for the new AI content
            description = await generate_description(ai_content)

        # Regenerate embedding based on description or content
        embedding_content = request.description or request.content or request.title
        embedding = await create_embedding(str(embedding_content) or "content")

        # Update tags and AI metadata
        item.tags = tags
        # Preserve any existing manual description unless a new one was provided
        existing_desc = item.ai_meta.get("description") if item.ai_meta else None
        final_description = None
        if request.description is not None:
            final_description = request.description
        elif 'description' in locals():
            final_description = description
        else:
            final_description = existing_desc

        item.ai_meta = {
            "category": category,
            "embedding": embedding,
            "ai_generated": request.tags is None,  # Track if tags are AI-generated or manual
            "description": final_description
        }
        
        await db.commit()
        await db.refresh(item)
        # Return normalized shape used by the frontend
        return {
            "id": item.id,
            "type": item.type,
            "description": (item.ai_meta.get("description") if item.ai_meta else item.title),
            "raw_content": item.content,
            "url": item.url if item.url else item.content,
            "storage_path": item.storage_path,
            "mime_type": item.mime_type,
            "tags": item.tags or [],
            "folder": category,
            "created_at": item.created_at,
            "title": item.title,
            "space_id": item.space_id
        }
    except Exception as e:
        await db.rollback()
        print(f"Error updating item: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update item: {str(e)}")


@router.delete("/{item_id}/")
async def delete_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete an item"""
    result = await db.execute(
        select(Item).where(Item.id == item_id, Item.user_id == current_user.id)
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    await db.delete(item)
    await db.commit()
    
    return {"message": "Item deleted successfully"}