# image assets analysis and cleanup

## current structure

### found images (4 files, ~8.6 MB total)

1. **`public/images/auth-bg.png`** - 4.64 MB
   - used in: Login.jsx, Register.jsx
   - purpose: background image for auth pages
   - status: **keep, correct location**

2. **`public/image.png`** - 4.41 MB  
   - used in: Home.jsx
   - purpose: welcome banner for logged-in users
   - status: **needs rename for clarity**

3. **`public/placeholder.svg`** - 538 bytes
   - used in: resolveImg.js (exported as PLACEHOLDER)
   - imported by: Home.jsx, AdminPanel.jsx, WorkshopsList.jsx, InstructorWorkshops.jsx
   - purpose: fallback image for workshops without photos
   - status: **keep, correct location**

4. **`icon.ico`** - 21.6 KB (root level)
   - used in: index.html
   - purpose: favicon
   - status: **incorrect location, should be in public/**

---

## issues found

### 1. favicon in wrong location ?
- current: `icon.ico` (root of ClientApp)
- correct: should be in `public/icon.ico`
- referenced in `index.html` as `/icon.ico` (expects public folder)

### 2. generic image name ??
- current: `public/image.png`
- unclear what it represents
- should be renamed to `public/images/welcome-banner.png` for clarity

### 3. missing favicon.svg ??
- index.html references `/favicon.svg` but file doesn't exist
- line: `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`
- can be removed or created

---

## code references

### frontend references

**Login.jsx (line 70):**
```javascript
backgroundImage: "linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url('/images/auth-bg.png')"
```
? correct path

**Register.jsx (line 62):**
```javascript
backgroundImage: "linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url('/images/auth-bg.png')"
```
? correct path

**Home.jsx (line 265):**
```javascript
<img src="/image.png" alt="Welcome banner" ... />
```
?? needs update if renamed

**index.html (line 7):**
```html
<link rel="icon" href="/icon.ico" />
```
? will be broken after move

**index.html (line 9):**
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```
? file doesn't exist

**resolveImg.js:**
```javascript
const PLACEHOLDER = '/placeholder.svg';
```
? correct path

---

## backend references (workshop images)

### hardcoded image paths in migrations (20251201003021_InitialCreate.cs)

all workshop seed data uses placeholder paths like:
```csharp
ImageUrl = "/workshop-images/guitar_course.jpg"
```

these files **do not exist** in the frontend but:
- folder created in Program.cs: `Directory.CreateDirectory(Path.Combine(webRoot, "workshop-images"));`
- WorkshopsController.cs uploads to this folder
- frontend resolveImg.js handles these paths

**status:** backend structure is correct, actual image files will be uploaded by admins

---

## recommended actions

### immediate fixes

1. **move favicon to correct location**
   ```bash
   move icon.ico public/icon.ico
   ```

2. **rename generic image**
   ```bash
   move public\image.png public\images\welcome-banner.png
   ```
   update Home.jsx:
   ```javascript
   src="/images/welcome-banner.png"
   ```

3. **remove broken favicon.svg reference**
   update index.html:
   ```html
   <link rel="icon" href="/icon.ico" />
   <!-- REMOVE: <link rel="icon" type="image/svg+xml" href="/favicon.svg" /> -->
   ```

### final structure

```
Projekt/ClientApp/
??? public/
?   ??? icon.ico                    ? favicon (moved from root)
?   ??? placeholder.svg             ? workshop fallback image
?   ??? images/
?       ??? auth-bg.png             ? login/register background
?       ??? welcome-banner.png      ? home page banner (renamed)
??? src/
??? index.html
```

### files to delete
**none** - all images are used

### no backend images to move
workshop images are uploaded at runtime, not shipped with source code

---

## implementation

run these commands in order:

```powershell
cd "C:\Users\kinga\source\repos\Workshop_App — kopia\Projekt\ClientApp"

# 1. move favicon to public folder
Move-Item -Path "icon.ico" -Destination "public/icon.ico" -Force

# 2. rename welcome banner
Move-Item -Path "public/image.png" -Destination "public/images/welcome-banner.png" -Force
```

then update these files:
- `src/pages/Home.jsx` (line 265): change `"/image.png"` to `"/images/welcome-banner.png"`
- `index.html` (line 9): remove `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`

---

## verification checklist

after changes, verify:
- [ ] favicon appears in browser tab
- [ ] login/register pages show background image
- [ ] home page shows welcome banner for logged-in users
- [ ] workshop cards show placeholder for missing images
- [ ] no 404 errors in browser console
- [ ] all images load from public/ folder

---

## summary

**total images:** 4 files (8.6 MB)  
**images to move:** 1 (icon.ico)  
**images to rename:** 1 (image.png ? welcome-banner.png)  
**images to delete:** 0  
**code updates needed:** 2 files (Home.jsx, index.html)  

**estimated time:** 5 minutes

all images are properly used in the application. the only issues are organizational (wrong location, unclear naming).
