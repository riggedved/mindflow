from datetime import datetime, timedelta, timezone

from jose import jwt
from jose.exceptions import ExpiredSignatureError, JWTError
from passlib.context import CryptContext

from app.core.config import settings


_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_jwt(data: dict, expires_delta: timedelta = timedelta(hours=12)):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_jwt(token: str):
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except ExpiredSignatureError:
        # Expired token — caller will treat as unauthorized
        return None
    except JWTError:
        # Any other JWT decoding/validation error — treat as invalid token
        return None


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    try:
        return _pwd_context.verify(password, hashed_password)
    except ValueError:
        return False
