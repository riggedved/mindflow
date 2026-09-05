# MindFlow - AI-Powered Knowledge Management

Save, organize, and discover your digital content with the help of AI.

## Overview

MindFlow is an AI-powered knowledge management and bookmark application inspired by tools such as MyMind.

It allows users to save different types of digital content, organize them into Spaces, Folders, and Tags, and use AI to automatically generate tags, descriptions, summaries, and content embeddings.

MindFlow also includes a browser extension that allows users to capture content directly from webpages.

---
## 🌐 Live Demo

**Frontend:** https://mindflow-vexy1.vercel.app/

**API Documentation:** https://mindflow-backend-b72t.onrender.com/docs

## ✨ Key Features

- **AI-Powered Organization** - Uses Google Gemini to generate tags, descriptions, summaries, and other metadata.
- **Smart Search** - Search saved content using titles, descriptions, content, tags, and filters.
- **Content Embeddings** - Generates embeddings that are used for similarity-based organization and clustering.
- **Beautiful Spaces** - Organize related content into themed collections with customizable colors.
- **Folders & Tags** - Organize saved content using hierarchical folders and flexible tags.
- **Browser Extension** - Save content directly from webpages using browser context menus.
- **Responsive UI** - Mobile-friendly dashboard with responsive layouts across different screen sizes.
- **Google OAuth** - Sign in securely using Google authentication.
- **JWT Authentication** - Authenticated API requests using JWT tokens.
- **Cloud Storage** - Store uploaded files and images using Supabase Storage.

---

## 🏗️ Project Structure

```text
MindFlow/
├── frontend/
│   ├── src/
│   │   ├── components/       # Reusable React components
│   │   ├── pages/            # Application pages
│   │   ├── lib/              # API helpers and utilities
│   │   └── hooks/            # Custom React hooks
│   ├── public/               # Static frontend assets
│   ├── package.json
│   ├── vite.config.ts
│   ├── Dockerfile
│   └── .dockerignore
│
├── Backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       └── routes/   # API route handlers
│   │   ├── core/             # Configuration, security, Gemini client
│   │   ├── db/               # Database sessions and initialization
│   │   ├── modals/           # SQLAlchemy database models
│   │   └── services/         # Application/business logic
│   ├── alembic/              # Database migrations
│   ├── certs/                # Database SSL certificates
│   ├── Extension/            # Browser extension
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env                  # Local environment variables (not committed)
│
├── docker-compose.yml         # Local multi-container development
└── README.md
```

---

# 🎨 Features

## Responsive Experience

MindFlow provides a responsive dashboard designed for both desktop and mobile devices.

- Collapsible navigation on smaller screens
- Persistent sidebar on desktop
- Responsive grids and cards
- Responsive Space detail pages
- Touch-friendly search and filter interfaces
- Adaptive layouts across screen sizes

---

## 📚 Content Types

MindFlow supports multiple types of saved content.

### Notes

Save text snippets, thoughts, ideas, and other written content.

### Links

Save webpages and bookmarks with associated metadata.

### Images

Upload images and use AI to generate descriptions and metadata.

### Videos

Save video links along with associated information and thumbnails.

### Articles / PDFs

Save and process documentation and PDF-based content.

---

# 🤖 AI Capabilities

MindFlow integrates Google Gemini for AI-powered content processing.

### Automatic Tagging

Gemini analyzes saved content and generates relevant tags.

### Content Summarization

Content can be summarized to make saved information easier to review.

### Image Descriptions

Uploaded images can be analyzed and described using Gemini.

### Content Embeddings

MindFlow generates vector embeddings for saved content.

These embeddings are used by the application for similarity-based organization and clustering.

### Content Clustering

MindFlow uses **DBSCAN** with cosine similarity to group related content.

The clustering service can also use Gemini to generate names and suggestions for discovered groups.

---

# 🗂️ Organization

## Spaces

Spaces allow users to organize related content into themed collections.

Each Space can have its own name, color, and associated content.

## Folders

Folders provide hierarchical organization for saved content.

## Tags

Tags provide flexible categorization across different types of content.

## Search

MindFlow provides search across saved content using fields such as:

- Title
- Content
- Description
- Tags
- Content type
- Other available filters

---

# 🌐 Browser Extension

MindFlow includes a browser extension for Chrome/Chromium-based browsers.

The extension allows users to save content directly from webpages.

### Extension Features

- Right-click to save content
- Automatic webpage metadata capture
- Sync saved content with MindFlow
- Browser notifications
- Chrome Manifest V3
- Background service worker
- Content script for webpage interaction
- Secure authentication

---

## Browser Extension Setup

### 1. Open Chrome or Edge

Navigate to:

```text
chrome://extensions/
```

### 2. Enable Developer Mode

Enable **Developer mode** in the browser extension settings.

### 3. Load the extension

Click:

```text
Load unpacked
```

Then select the:

```text
Backend/Extension/
```

directory.

---

# 🔐 Authentication & Security

MindFlow uses several mechanisms for authentication and application security.

### Google OAuth

Users can authenticate using their Google account through OAuth 2.0.

### JWT Authentication

After authentication, the backend issues JWT tokens that are used to authenticate API requests.

### Password Hashing

User passwords are securely hashed before being stored.

### CORS Protection

The backend restricts browser requests to configured frontend origins.

### Environment Variables

Sensitive configuration and credentials are provided through environment variables rather than being stored directly in source code.

### Extension Storage

Authentication information used by the browser extension is stored using browser-provided storage mechanisms.

---

# 🛠️ Tech Stack

## Frontend

- **React** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Frontend build tool
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI component library
- **React Router** - Client-side routing

## Backend

- **FastAPI** - Python web framework
- **Uvicorn** - ASGI application server
- **SQLAlchemy** - ORM
- **Alembic** - Database migrations
- **PostgreSQL** - Relational database
- **Pydantic** - Data validation

## AI / ML

- **Google Gemini AI** - AI-powered content processing
- **Gemini Embeddings** - Content vector embeddings
- **NumPy** - Numerical operations
- **scikit-learn** - DBSCAN clustering

## Storage & Services

- **Supabase PostgreSQL** - Managed PostgreSQL database
- **Supabase Storage** - File and image storage
- **Google OAuth** - Authentication

## Browser Extension

- **Manifest V3**
- **Chrome APIs**
- **Service Workers**
- **Content Scripts**

## Deployment & Infrastructure

- **Docker** - Backend containerization
- **Docker Compose** - Local multi-container development
- **Render** - Backend hosting
- **Vercel** - Frontend hosting

---

# 🐳 Docker

The backend is containerized using Docker.

The backend Dockerfile:

1. Starts from a Python image
2. Installs Python dependencies
3. Copies the application source code
4. Exposes the application port
5. Starts the FastAPI application using Uvicorn

### Build the Backend

From the `Backend` directory:

```sh
docker build -t mindflow-backend .
```

### Run the Backend

```sh
docker run --env-file .env -p 8000:8000 mindflow-backend
```

---

# 🧩 Docker Compose

The project includes a Docker Compose configuration for running the frontend and backend together during local development.

From the project root:

```sh
docker compose up --build
```

The services are exposed at:

```text
Frontend: http://localhost:8080
Backend:  http://localhost:8000
```

To stop the services:

```sh
docker compose down
```

---

# 💻 Local Development

## Prerequisites

Make sure the following are installed:

- Node.js
- npm
- Python
- Docker Desktop (optional)
- PostgreSQL/Supabase account
- Google Gemini API key
- Google OAuth credentials if Google login is required

---

## Frontend Setup

Navigate to the frontend:

```sh
cd frontend
```

Install dependencies:

```sh
npm install
```

Start the development server:

```sh
npm run dev
```

The frontend will normally be available at:

```text
http://localhost:8080
```

---

## Backend Setup

Navigate to the backend:

```sh
cd Backend
```

Create and activate a Python virtual environment.

### Windows

```powershell
python -m venv .venv
.venv\Scripts\activate
```

### Linux / macOS

```sh
python3 -m venv .venv
source .venv/bin/activate
```

Install dependencies:

```sh
pip install -r requirements.txt
```

Start the FastAPI server:

```sh
python -m uvicorn app.main:app --reload
```

The backend will normally be available at:

```text
http://localhost:8000
```

FastAPI documentation is available at:

```text
http://localhost:8000/docs
```

---

# ⚙️ Environment Variables

The backend requires environment variables for database access, authentication, storage, AI services, and application configuration.

Example:

```env
DATABASE_URL=

SUPABASE_URL=
SUPABASE_KEY=

GEMINI_API_KEY=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

JWT_SECRET_KEY=

FRONTEND_URL=http://localhost:8080
BACKEND_PUBLIC_URL=http://localhost:8000
```

The exact environment variables depend on the configuration in:

```text
Backend/app/core/config.py
```

### Production

Production environment variables are configured directly in the hosting platform.

**Never commit `.env` files or secret credentials to Git.**

---

# 🚀 Production Deployment

MindFlow is deployed using the following architecture:

```text
                         Internet
                            │
             ┌──────────────┴──────────────┐
             │                             │
             ▼                             ▼
       Vercel Frontend              Render Backend
       React + Vite                 FastAPI + Docker
             │                             │
             │ HTTPS API requests          │
             └──────────────►──────────────┘
                                           │
                              ┌────────────┼────────────┐
                              │            │            │
                              ▼            ▼            ▼
                         Supabase      Supabase      Gemini
                         PostgreSQL    Storage        API
```

## Frontend

The frontend is deployed on **Vercel**.

Configuration:

```text
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
```

The production backend URL is configured using:

```env
VITE_BACKEND_URL=https://your-backend-url
```

---

## Backend

The backend is containerized using Docker and deployed on **Render**.

Configuration:

```text
Root Directory: Backend
Dockerfile: Backend/Dockerfile
```

The FastAPI application runs using Uvicorn.

Production configuration is supplied through Render environment variables.

---

## Database

MindFlow uses **PostgreSQL hosted through Supabase**.

The backend connects to PostgreSQL using SQLAlchemy and `asyncpg`.

---

## File Storage

Uploaded files and images are stored using **Supabase Storage**.

---

## AI Services

Google Gemini is used for AI-powered content processing, including:

- Tag generation
- Content summarization
- Image descriptions
- Embeddings
- Content organization

---

# 🧪 Testing

## Frontend

Run frontend tests with:

```sh
npm run test
```

## Backend

From the `Backend` directory:

```sh
pytest
```

## Browser Extension

Follow the extension testing checklist and test the extension using a Chromium-based browser with Developer Mode enabled.

---

# 🔄 Application Flow

A typical content-saving flow looks like:

```text
User saves content
        │
        ▼
Frontend / Browser Extension
        │
        ▼
FastAPI Backend
        │
        ├──► Validate request
        │
        ├──► Store content in PostgreSQL
        │
        ├──► Upload files to Supabase Storage
        │
        ├──► Process content with Gemini
        │
        ├──► Generate tags / metadata
        │
        └──► Generate embeddings
                     │
                     ▼
              Similarity / Clustering
                     │
                     ▼
              Organized content
```

---

# 📁 Database & Migrations

MindFlow uses SQLAlchemy for database interaction and Alembic for database migration management.

Alembic configuration is located in:

```text
Backend/alembic/
```

Database initialization and session management are handled inside:

```text
Backend/app/db/
```

---

# 🔎 API Documentation

When the backend is running, interactive API documentation is available at:

```text
http://localhost:8000/docs
```

The deployed backend also exposes the FastAPI Swagger documentation at its `/docs` endpoint.

---

# 📌 Future Improvements

Potential improvements include:

- True vector-based semantic search
- Migration from the deprecated `google.generativeai` package to the current Google GenAI SDK
- Improved search ranking
- More advanced recommendation systems
- Additional browser extension capabilities
- Automated backend and frontend testing
- Production monitoring and logging
- Improved background processing for AI-heavy tasks

---
