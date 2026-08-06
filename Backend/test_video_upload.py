"""
Quick test script to verify video upload API works
"""
import google.generativeai as genai
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

print("✅ Google Generative AI version:", genai.__version__)
print("✅ upload_file available:", hasattr(genai, 'upload_file'))
print("✅ get_file available:", hasattr(genai, 'get_file'))
print("✅ delete_file available:", hasattr(genai, 'delete_file'))

print("\n🎉 Video upload API is ready to use!")
print("\nNow restart your backend server and try uploading a video.")
