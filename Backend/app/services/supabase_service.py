import os
import uuid
from supabase import create_client, Client
from app.core.config import settings
from fastapi import UploadFile
import mimetypes

class SupabaseService:
    def __init__(self):
        service_key = settings.SUPABASE_SERVICE_ROLE_KEY
        if not service_key:
            raise RuntimeError(
                "SUPABASE_SERVICE_ROLE_KEY is required but not set. "
                "Ensure the backend environment includes the service role key."
            )

        self.client: Client = create_client(settings.SUPABASE_URL, service_key)
        self.bucket = settings.SUPABASE_BUCKET
    
    async def upload_file(self, file: UploadFile, user_id: int) -> dict:
        """
        Upload a file to Supabase Storage
        Returns dict with storage_path, public_url, and mime_type
        """
        try:
            # Read file content
            content = await file.read()
            
            # Generate unique filename
            file_extension = os.path.splitext(file.filename)[1]
            unique_filename = f"{user_id}/{uuid.uuid4()}{file_extension}"
            
            # Detect mime type
            mime_type = file.content_type or mimetypes.guess_type(file.filename)[0] or "application/octet-stream"
            
            # Upload to Supabase
            response = self.client.storage.from_(self.bucket).upload(
                path=unique_filename,
                file=content,
                file_options={"content-type": mime_type}
            )
            
            # Get public URL
            public_url = self.client.storage.from_(self.bucket).get_public_url(unique_filename)
            
            return {
                "storage_path": unique_filename,
                "public_url": public_url,
                "mime_type": mime_type
            }
        except Exception as e:
            raise Exception(f"Failed to upload file: {str(e)}")
    
    async def delete_file(self, storage_path: str) -> bool:
        """
        Delete a file from Supabase Storage
        """
        try:
            self.client.storage.from_(self.bucket).remove([storage_path])
            return True
        except Exception as e:
            print(f"Failed to delete file: {str(e)}")
            return False
    
    def get_public_url(self, storage_path: str) -> str:
        """
        Get public URL for a stored file
        """
        return self.client.storage.from_(self.bucket).get_public_url(storage_path)

# Singleton instance
supabase_service = SupabaseService()
