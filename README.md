# MindFlow - AI-Powered Knowledge Management

Save, organize, and discover your digital content with the power of AI

## Overview

MindFlow is an intelligent bookmark and note-taking application inspired by MyMind. It helps you capture content from anywhere, automatically organizes it using AI, and makes everything searchable and discoverable.

### Key Features 

- **AI-Powered Organization** - Gemini AI automatically tags and categorizes your content
- **Smart Search** - Find anything with semantic search powered by vector embeddings
- **Beautiful Spaces** - Organize items into themed collections with custom colors
- **Browser Extension** - Capture content from any webpage with a right-click
- **Fully Responsive UI** - Mobile-first dashboard with adaptive layouts and navigation
- **Secure OAuth** - Sign in with Google for seamless authentication


### Browser Extension Setup

```sh
# Open Chrome/Edge
# Go to chrome://extensions/
# Enable Developer Mode
# Click "Load unpacked"
# Select the Extension folder
```

##  Project Structure

```
MindFlow/
├── src/                    # Frontend React application
│   ├── components/        # Reusable UI components
│   ├── pages/            # Page components (Dashboard, Spaces, etc.)
│   ├── lib/              # API helpers and utilities
│   └── hooks/            # Custom React hooks
├── Backend/               # FastAPI backend
│   ├── app/
│   │   ├── api/          # API routes
│   │   ├── core/         # Configuration and security
│   │   ├── modals/       # Database models
│   │   ├── schemas/      # Pydantic schemas
│   │   └── services/     # Business logic
│   ├── Extension/        # Browser extension source
│   │   ├── manifest.json # Extension configuration
│   │   ├── background.js # Service worker
│   │   ├── content-script.js # Page detection
│   │   └── popup/        # Extension popup UI
│   └── alembic/          # Database migrations
└── public/               # Static assets
```

##  Features

### Responsive Experience

- Adaptive dashboard shell with a collapsible mobile navigation sheet and persistent desktop sidebar.
- Responsive grids, cards, and masonry layouts that scale from single-column mobile views to wide-screen dashboards.
- Space detail hero, action buttons, and tabs that stack gracefully on phones while keeping quick actions within reach.
- Full-screen search and filter surfaces tuned for touch input with accessible hit areas across breakpoints.

### Content Types
-  **Notes** - Text snippets and thoughts
-  **Links** - Bookmarks with automatic metadata
-  **Images** - Visual content with AI descriptions
-  **Videos** - Video links with thumbnails
-  **Article** - documentations in pdf format

### AI Capabilities
- Auto-tagging with Gemini AI
- Semantic search with embeddings
- Smart categorization
- Content summarization
- Image description generation

### Organization
- **Spaces** - Themed collections with custom colors
- **Folders** - Hierarchical organization
- **Tags** - Flexible categorization
- **Search** - Full-text and semantic search

### Browser Extension
- Right-click to save any content
- Automatic page metadata capture
- Instant sync with dashboard
- Desktop notifications
- Secure OAuth authentication

## 🛠️ Tech Stack

### Frontend
- **React** + **TypeScript** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **shadcn/ui** - Component library
- **React Router** - Navigation

### Backend
- **FastAPI** - Python web framework
- **PostgreSQL** - Database
- **SQLAlchemy** - ORM
- **Alembic** - Migrations
- **Supabase** - File storage

### AI/ML
- **Google Gemini AI** - Tagging and descriptions
- **Text Embedding 004** - Semantic search
- **DBSCAN** - Clustering algorithm

### Extension
- **Manifest V3** - Chrome extension platform
- **Service Worker** - Background processing
- **Chrome APIs** - Context menus, storage, notifications

##  Security

- OAuth 2.0 authentication
- JWT token-based API access
- Secure password hashing
- CORS protection
- Environment variable configuration
- Chrome extension isolated storage

##  Testing

```sh
# Frontend tests
npm run test

# Backend tests
cd Backend
pytest

# Extension testing
# See EXTENSION_TESTING.md for checklist
```

##  Deployment

### Frontend
- Deploy to Vercel, Netlify, or any static host
- Update API URLs for production

### Backend
- Deploy to Railway, Render, or AWS
- Set up production database
- Configure environment variables
- Enable HTTPS

### Extension
- Create proper icons
- Update URLs to production
- Zip Extension folder
- Publish to Chrome Web Store (optional)

