# MindFlow Extension Icons

## Current Status
The extension uses placeholder SVG icons. For production, you should create proper PNG icons.

## Required Icons

### For Chrome Extension:
- `icon16.png` - 16x16 pixels (toolbar, small displays)
- `icon48.png` - 48x48 pixels (extension management page)
- `icon128.png` - 128x128 pixels (Chrome Web Store, installation)

### Temporary Workaround
Currently using `icon48.svg` as a placeholder. Chrome will use this but PNG is recommended.

## Creating Icons

### Option 1: Use Figma/Canva
1. Create 128x128 canvas
2. Design MindFlow logo:
   - Brain/mind symbol
   - Primary color: #6366f1 (indigo)
   - White or light details
   - Simple, recognizable
3. Export as PNG:
   - 16x16 (resize, keep crisp)
   - 48x48 (resize)
   - 128x128 (original)

### Option 2: Use Online Icon Generator
1. Go to: https://www.favicon-generator.org/
2. Upload a source image (512x512 recommended)
3. Generate all sizes
4. Download and rename:
   - favicon-16x16.png → icon16.png
   - favicon-48x48.png → icon48.png
   - android-chrome-192x192.png (resize to 128) → icon128.png

### Option 3: Use ImageMagick (Command Line)
```bash
# Install ImageMagick first
# Create from SVG
magick icon48.svg -resize 16x16 icon16.png
magick icon48.svg -resize 48x48 icon48.png
magick icon48.svg -resize 128x128 icon128.png
```

### Option 4: Use AI Generator
Prompt for DALL-E, Midjourney, or Stable Diffusion:
```
"Create a simple, modern app icon for a knowledge management tool called MindFlow. 
Style: minimalist, flat design, gradient from indigo to purple (#6366f1 to #764ba2). 
Icon: abstract brain or mind symbol with flowing lines. 
Background: rounded square with subtle gradient. 
Size: 1024x1024px, PNG with transparency."
```

## Design Guidelines

### Colors
- Primary: #6366f1 (Indigo 500)
- Secondary: #764ba2 (Purple)
- Gradient: from indigo to purple
- Background: White or transparent
- Details: White or very light color

### Style
- Modern and clean
- Recognizable at small sizes
- Not too detailed (16px needs to be clear)
- Professional appearance
- Matches dashboard aesthetic

### Symbol Ideas
- 🧠 Brain outline
- 💭 Thought bubble
- ⚡ Lightning + brain (fast thinking)
- 🌊 Flowing waves (mind flow)
- 📝 Note + brain combo
- 🎯 Target + brain (focused thinking)

## Quick Test

After creating icons:
1. Place PNG files in this directory
2. Reload extension in chrome://extensions/
3. Check icon appears in toolbar
4. Check icon quality on extension page

## Current Placeholder

The current `icon48.svg` is a simple SVG placeholder showing:
- Indigo circle background
- White brain/mind shape
- Smiling face details

Replace with proper PNG icons for production use.

## Files Needed
- [ ] icon16.png (16x16)
- [ ] icon48.png (48x48)  
- [ ] icon128.png (128x128)

## Note
Extension will work without perfect icons, but proper icons improve user experience and are required for Chrome Web Store publication.
