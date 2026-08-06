import asyncio
import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

async def test_working_config():
    print("Testing final Gemini configuration...\n")
    
    # Test tag generation with gemini-2.5-flash
    print("1. Testing gemini-2.5-flash for tag generation:")
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        prompt = """Analyze this content and extract exactly 6 concise tags and a single category.
        
Content: Meeting notes about Q4 budget planning and team goals

Return ONLY a valid JSON object in this exact format:
{"tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"], "category": "category_name"}"""
        
        response = model.generate_content(prompt)
        print(f"   ✅ Success!")
        print(f"   Response: {response.text}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test embedding generation with text-embedding-004
    print("\n2. Testing text-embedding-004 for embeddings:")
    try:
        result = genai.embed_content(
            model="models/text-embedding-004",
            content="Meeting notes about Q4 budget planning",
            task_type="retrieval_document"
        )
        print(f"   ✅ Success! Generated {len(result['embedding'])} dimensional embedding")
    except Exception as e:
        print(f"   ❌ Error: {e}")

asyncio.run(test_working_config())
