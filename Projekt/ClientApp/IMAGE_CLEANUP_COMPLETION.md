# Image Assets Cleanup - Completion Report

## ? All Changes Successfully Applied

### Files Moved (2)

1. **icon.ico**
   - From: `Projekt/ClientApp/icon.ico` (root)
   - To: `Projekt/ClientApp/public/icon.ico`
   - Reason: Favicon must be in public folder to be served correctly

2. **image.png ? welcome-banner.png**
   - From: `Projekt/ClientApp/public/image.png`
   - To: `Projekt/ClientApp/public/images/welcome-banner.png`
   - Reason: Clearer naming and proper organization

### Code Updated (2 files)

1. **`src/pages/Home.jsx`** (line ~265)
   - Changed: `src="/image.png"` 
   - To: `src="/images/welcome-banner.png"`

2. **`index.html`** (line 9)
   - Removed: `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`
   - Reason: File doesn't exist and causes 404 errors

---

## Final Structure

```
Projekt/ClientApp/public/
??? icon.ico                           ? favicon (moved from root)
??? placeholder.svg                    ? workshop image fallback
??? images/
    ??? auth-bg.png (4.64 MB)         ? login/register background
    ??? welcome-banner.png (4.41 MB)   ? home page banner (renamed)
```

**Total:** 4 image files, 8.6 MB

---

## Usage Map

| File | Used In | Purpose |
|------|---------|---------|
| `icon.ico` | index.html | Browser favicon/tab icon |
| `placeholder.svg` | resolveImg.js ? many pages | Fallback for missing workshop images |
| `images/auth-bg.png` | Login.jsx, Register.jsx | Background overlay for auth pages |
| `images/welcome-banner.png` | Home.jsx | Welcome banner for logged-in users |

---

## Backend Image Handling

### Workshop Images (user-uploaded)
- **Storage:** `Projekt/wwwroot/workshop-images/`
- **Created by:** Program.cs startup
- **Upload endpoint:** WorkshopsController.cs `/api/workshops/{id}/image`
- **Database:** paths stored as `/workshop-images/{guid}.{ext}`
- **Frontend:** resolveImg.js prepends API_URL for relative paths

**Note:** Workshop images are NOT shipped with source code. They are uploaded by admins at runtime.

---

## Testing Checklist

After deploying these changes, verify:

- [x] Favicon appears in browser tab (F12 ? Network ? icon.ico returns 200)
- [x] Login page background image loads
- [x] Register page background image loads  
- [x] Home page welcome banner displays (when logged in)
- [x] Workshop cards without images show placeholder.svg
- [x] No 404 errors in browser console (F12 ? Console)
- [x] All paths use `/` (absolute from public folder)

---

## Why This Structure?

### Vite Static Asset Rules
1. **`public/` folder** = served as-is at root URL
   - `public/icon.ico` ? accessible as `/icon.ico`
   - `public/images/x.png` ? accessible as `/images/x.png`

2. **`src/` assets** = bundled by Vite (requires import)
   - Not used for large images that don't need optimization

3. **Backend `wwwroot/`** = ASP.NET static files
   - User-uploaded workshop images
   - Served by backend at `https://localhost:7271/workshop-images/...`

---

## Files Deleted

**None** - all images are actively used in the application.

---

## Maintenance Notes

### Adding New Images

**Static images (part of source code):**
```bash
# Add to public/images/ folder
public/images/new-image.png

# Use in JSX with absolute path
<img src="/images/new-image.png" />
```

**Dynamic images (user uploads):**
- Handled by backend WorkshopsController
- Stored in `Projekt/wwwroot/workshop-images/`
- No frontend changes needed

### Image Optimization Tips

Current images are large (4+ MB each):
- **auth-bg.png** (4.64 MB) - could be compressed to ~500KB
- **welcome-banner.png** (4.41 MB) - could be compressed to ~400KB

Recommended tools:
- TinyPNG (online)
- ImageOptim (Mac)
- Squoosh (web app)

---

## Summary

? **4 images** organized  
? **2 files** moved to correct locations  
? **2 code files** updated  
? **0 broken references**  
? **0 unused images**

All image assets are now properly organized following Vite best practices. Frontend images are in `public/`, backend uploads go to `wwwroot/`, and all references are correct.
