import asyncio
import json
import google.generativeai as genai
from app.core.config import settings
import httpx
from PIL import Image
import io
from typing import Callable, TypeVar, Any

try:
    # Available when google-api-core is present (bundled with google-generativeai)
    from google.api_core.exceptions import ResourceExhausted, ServiceUnavailable, InternalServerError
except ImportError:  # pragma: no cover - defensive fallback
    ResourceExhausted = ServiceUnavailable = InternalServerError = Exception  # type: ignore

T = TypeVar("T")

# Configure Gemini
genai.configure(api_key=settings.GEMINI_API_KEY)


async def create_embedding(text: str):
    """
    Create embeddings using Gemini's supported embedding model
    """
    try:
        result = await _call_with_retries(
            lambda: genai.embed_content(
                model="models/gemini-embedding-001",
                content=text,
                task_type="retrieval_document"
            )
        )
        return result['embedding']
    except Exception as e:
        print(f"Embedding generation failed: {str(e)}")
        raise Exception(f"Failed to generate embeddings: {str(e)}")


async def generate_tags(text: str):
    """
    Generate tags, category, and title using Gemini 2.5 Flash (Latest stable free model)
    """
    try:
        # Use gemini-2.5-flash (latest stable free tier model)
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        prompt = f"""Analyze this content and extract exactly 6 concise tags, a single category, and a descriptive title.
        
Content: {text}

Return ONLY a valid JSON object in this exact format:
{{"tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"], "category": "category_name", "title": "descriptive title"}}

Make tags relevant, concise (1-2 words each), and useful for organizing content.
Category should be one word like: work, personal, learning, reference, creative, technical, etc.
Title should be a clear, concise summary (4-8 words) that captures the essence of the content."""

        response = await _call_with_retries(lambda: model.generate_content(prompt))
        raw = response.text.strip()
        
        # Remove markdown code blocks if present
        if raw.startswith("```json"):
            raw = raw[7:]
        if raw.startswith("```"):
            raw = raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()
        
        # Parse JSON
        try:
            parsed = json.loads(raw)
            # Ensure we have tags as a list and category as a string
            if isinstance(parsed.get("tags"), list) and isinstance(parsed.get("category"), str):
                return parsed
            else:
                return {"tags": [], "category": "general", "title": "Untitled"}
        except json.JSONDecodeError:
            print(f"Failed to parse Gemini response: {raw}")
            return {"tags": [], "category": "general", "title": "Untitled"}
            
    except Exception as e:
        print(f"Tag generation error: {str(e)}")
        return {"tags": [], "category": "general", "title": "Untitled"}


async def generate_description(text: str) -> str:
    """
    Generate a short (1-2 sentence) description/summary for a piece of text.
    """
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        prompt = f'''Summarize the following content in one to two concise sentences suitable as a human-friendly description.

Content: {text}

Return ONLY the plain description text (no JSON, no markdown).'''
        response = await _call_with_retries(lambda: model.generate_content(prompt))
        raw = response.text.strip()
        # Strip code fences if present
        if raw.startswith("```"):
            raw = raw.strip("`\n \r")
        return raw
    except Exception as e:
        print(f"Description generation error: {e}")
        return ""


async def analyze_image(image_url: str, title: str = ""):
    """
    Analyze an image using Gemini Vision and generate tags, title, and description
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(image_url)
            response.raise_for_status()
            image_data = response.content
        
        image = Image.open(io.BytesIO(image_data))
        
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        prompt = f"""Analyze this image and extract exactly 6 concise, descriptive tags, a single category, a descriptive title, and a brief description.

Analyze the ACTUAL IMAGE CONTENT, not the user-provided title.

Consider:
- What objects, people, or scenes are visible?
- What is the context or setting?
- What activities or actions are depicted?
- What is the mood or atmosphere?

Return ONLY a valid JSON object in this exact format:
{{"tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"], "category": "category_name", "title": "descriptive title", "description": "brief description"}}

Make tags relevant, concise (1-2 words each), and useful for searching.
Category should be one word like: work, personal, learning, reference, creative, technical, nature, people, architecture, etc.
Title should be a clear, descriptive summary (4-8 words) based on what you SEE in the image.
Description should be 1-2 sentences describing what's in the image."""

        response = await _call_with_retries(lambda: model.generate_content([prompt, image]))
        raw = response.text.strip()
        
        # Remove markdown code blocks
        if raw.startswith("```json"):
            raw = raw[7:]
        if raw.startswith("```"):
            raw = raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()
        
        # Parse JSON
        try:
            parsed = json.loads(raw)
            if isinstance(parsed.get("tags"), list) and isinstance(parsed.get("category"), str):
                return parsed
            else:
                return {"tags": [], "category": "general", "title": "Untitled Image", "description": ""}
        except json.JSONDecodeError:
            print(f"Failed to parse image analysis response: {raw}")
            return {"tags": [], "category": "general", "title": "Untitled Image", "description": ""}
            
    except Exception as e:
        print(f"Image analysis error: {str(e)}")
        return {"tags": [], "category": "general", "title": "Untitled Image", "description": ""}


async def analyze_video(video_url: str, title: str = ""):
    """
    Analyze a video using Gemini Vision with File API
    Downloads the video and uploads it to Gemini for actual content analysis
    """
    try:
        # Download the video file
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.get(video_url)
            response.raise_for_status()
            video_data = response.content
        
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Create a temporary file
        import tempfile
        import os
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp_file:
            temp_file.write(video_data)
            temp_path = temp_file.name
        
        try:
            print(f"📤 Uploading video to Gemini for analysis...")
            # Upload video file to Gemini
            video_file = genai.upload_file(temp_path)
            print(f"✅ Video uploaded: {video_file.name}")
            
            # Wait for the file to be processed
            print(f"⏳ Processing video...")
            while video_file.state.name == "PROCESSING":
                await asyncio.sleep(3)
                video_file = genai.get_file(video_file.name)
            
            if video_file.state.name == "FAILED":
                print(f"❌ Video processing failed")
                raise ValueError("Video processing failed")
            
            print(f"✅ Video processed successfully")
            
            # Generate tags, title, and description based on actual video content
            prompt = f"""Analyze this video carefully and extract exactly 6 concise, descriptive tags, a category, a descriptive title, and a brief description based on what you actually see in the video.

Analyze the ACTUAL VIDEO CONTENT (keyframes), not any user-provided title.

Consider:
- What activities, actions, or events are happening?
- What objects, people, or scenes are visible?
- What is the setting or environment?
- What is the overall theme, mood, or purpose?

Return ONLY a valid JSON object in this exact format:
{{"tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"], "category": "category_name", "title": "descriptive title", "description": "brief description"}}

Make tags specific to what you see in the video, concise (1-2 words each), and useful for searching.
Category should be one word like: tutorial, entertainment, educational, work, creative, presentation, demo, lecture, nature, sports, etc.
Title should be a clear, descriptive summary (4-8 words) based on what you SEE in the video.
Description should be 1-2 sentences describing what's actually shown in the video."""

            response = await _call_with_retries(lambda: model.generate_content([video_file, prompt]))
            raw = response.text.strip()
            
            print(f"🤖 Gemini analysis complete")
            
            # Delete the uploaded file from Gemini
            try:
                genai.delete_file(video_file.name)
                print(f"🗑️  Cleaned up Gemini file")
            except Exception as e:
                print(f"⚠️  Failed to delete Gemini file: {e}")
            
        finally:
            # Clean up local temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)
                print(f"🗑️  Cleaned up local temp file")
        
        # Remove markdown code blocks
        if raw.startswith("```json"):
            raw = raw[7:]
        if raw.startswith("```"):
            raw = raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()
        
        # Parse JSON
        try:
            parsed = json.loads(raw)
            if isinstance(parsed.get("tags"), list) and isinstance(parsed.get("category"), str):
                print(f"✨ Generated tags: {parsed.get('tags')}")
                print(f"✨ Generated title: {parsed.get('title')}")
                return parsed
            else:
                print(f"⚠️  Invalid response format, using defaults")
                return {"tags": [], "category": "general", "title": "Untitled Video", "description": ""}
        except json.JSONDecodeError:
            print(f"❌ Failed to parse video analysis response: {raw}")
            return {"tags": [], "category": "general", "title": "Untitled Video", "description": ""}
            
    except Exception as e:
        print(f"❌ Video analysis error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"tags": [], "category": "general", "title": "Untitled Video", "description": ""}


async def generate_content(prompt: str) -> str:
    """
    Generate content using Gemini AI with a custom prompt
    Used for general AI text generation tasks
    """
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = await _call_with_retries(lambda: model.generate_content(prompt))
        return response.text
    except Exception as e:
        print(f"❌ Content generation failed: {str(e)}")
        raise Exception(f"Failed to generate content: {str(e)}")


async def _call_with_retries(func: Callable[[], T], max_attempts: int = 3, base_delay: float = 1.5) -> T:
    """Call a synchronous Gemini SDK function with retry/backoff on transient quota errors."""
    delay = base_delay
    last_error: Any = None
    for attempt in range(1, max_attempts + 1):
        try:
            return func()
        except (ResourceExhausted, ServiceUnavailable, InternalServerError) as exc:
            last_error = exc
        except Exception as exc:  # catch other quota style errors via string inspection
            message = str(exc).lower()
            if any(token in message for token in ["resource exhausted", "quota", "429"]):
                last_error = exc
            else:
                raise

        if attempt == max_attempts:
            raise last_error  # type: ignore

        await asyncio.sleep(delay)
        delay *= 2

    raise last_error  # type: ignore  # pragma: no cover - logically unreachable
