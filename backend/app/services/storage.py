import os
import shutil
from pathlib import Path
from fastapi import HTTPException
from app.core.config import settings


class StorageService:
    def __init__(self, base_storage_dir: str = settings.STORAGE_DIR):
        self.base_dir = Path(base_storage_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _get_user_dir(self, user_id: int) -> Path:
        user_dir = (self.base_dir / f"user_{user_id}").resolve()
        # Path traversal protection
        if not str(user_dir).startswith(str(self.base_dir)):
            raise HTTPException(status_code=400, detail="Invalid storage path")
        user_dir.mkdir(parents=True, exist_ok=True)
        return user_dir

    def save_file(self, user_id: int, filename: str, content: bytes) -> str:
        user_dir = self._get_user_dir(user_id)
        # Sanitize filename
        safe_filename = Path(filename).name
        file_path = (user_dir / safe_filename).resolve()

        if not str(file_path).startswith(str(user_dir)):
            raise HTTPException(status_code=400, detail="Invalid filename or path")

        with open(file_path, "wb") as f:
            f.write(content)

        return str(file_path)

    def get_file_path(self, user_id: int, filename: str) -> Path:
        user_dir = self._get_user_dir(user_id)
        safe_filename = Path(filename).name
        file_path = (user_dir / safe_filename).resolve()

        if not str(file_path).startswith(str(user_dir)) or not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found on storage")

        return file_path

    def delete_file(self, user_id: int, filename: str) -> bool:
        try:
            file_path = self.get_file_path(user_id, filename)
            if file_path.exists():
                file_path.unlink()
                return True
        except HTTPException:
            pass
        return False


storage_service = StorageService()
