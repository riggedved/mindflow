from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from app.api.v1.routes import auth, items, tags, folders, spaces, search, users, extension
from app.db.sessions import init_db
from app.core.config import settings

app = FastAPI(title="MindFlow API", redirect_slashes=False)

# Add session middleware for OAuth (required by Authlib)
app.add_middleware(SessionMiddleware, secret_key=settings.JWT_SECRET)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:5173", "https://mind-flow-steel.vercel.app"],
    allow_origin_regex=r"^chrome-extension://.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await init_db()

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(items.router, prefix="/api/v1/items", tags=["Items"])
app.include_router(tags.router, prefix="/api/v1/tags", tags=["Tags"])
app.include_router(folders.router, prefix="/api/v1/folders", tags=["Folders"])
app.include_router(spaces.router, prefix="/api/v1/spaces", tags=["Spaces"])
app.include_router(search.router, prefix="/api/v1/search", tags=["Search"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(extension.router, prefix="/api/v1/extension", tags=["Extension"])
