import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

print("Testing Gemini models...\n")

# Test 1: List available models
print("1. Available models:")
try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"   - {m.name}")
except Exception as e:
    print(f"   Error: {e}")

print("\n2. Testing gemini-1.5-flash-8b for tag generation:")
try:
    model = genai.GenerativeModel('gemini-1.5-flash-8b')
    response = model.generate_content("Say hello")
    print(f"   ✅ Success: {response.text[:50]}")
except Exception as e:
    print(f"   ❌ Error: {e}")

print("\n3. Testing alternative: gemini-1.5-flash:")
try:
    model = genai.GenerativeModel('gemini-1.5-flash')
    response = model.generate_content("Say hello")
    print(f"   ✅ Success: {response.text[:50]}")
except Exception as e:
    print(f"   ❌ Error: {e}")

print("\n4. Testing text-embedding-004:")
try:
    result = genai.embed_content(
        model="models/text-embedding-004",
        content="test",
        task_type="retrieval_document"
    )
    print(f"   ✅ Success: Generated embedding with {len(result['embedding'])} dimensions")
except Exception as e:
    print(f"   ❌ Error: {e}")

print("\n5. Testing embedding-001:")
try:
    result = genai.embed_content(
        model="models/embedding-001",
        content="test"
    )
    print(f"   ✅ Success: Generated embedding with {len(result['embedding'])} dimensions")
except Exception as e:
    print(f"   ❌ Error: {e}")
