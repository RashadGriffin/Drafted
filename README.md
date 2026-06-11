# Drafted Apparel

Premium illustrated athlete merch — static site, Git-backed, edited via Decap CMS.

## Stack
- Static HTML/CSS/JS (no framework, no build step)
- Hosted on **Netlify**, deployed from **GitHub**
- Content edited via **Decap CMS** at `/admin`
- Page content stored as JSON in `/content/` — pages fetch and render it client-side

## Folder structure
```
/
├── index.html              Homepage
├── shop.html               Collection (to build)
├── how-it-works.html       (to build)
├── about.html              (to build)
├── contact.html            (to build)
├── order-confirmation.html (to build)
├── products/               Individual product pages (to build)
├── admin/                  Decap CMS (index.html + config.yml)
├── content/                Editable JSON content files
│   ├── homepage.json
│   ├── products.json
│   └── site.json
├── css/style.css           Shared global styles
├── js/main.js              Shared JS (nav, reveal)
├── assets/uploads/         CMS image uploads land here
└── netlify.toml
```

## One-time setup

### 1. Push to GitHub
```bash
cd drafted-apparel
git init
git add .
git commit -m "Initial Drafted Apparel site"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/drafted-apparel.git
git push -u origin main
```

### 2. Connect to Netlify
- Netlify → **Add new site → Import an existing project** → pick the repo
- Build command: *(leave blank)*  •  Publish directory: `.`
- Deploy

### 3. Enable Decap CMS editing
Decap needs auth to commit back to GitHub. Easiest path:
- Netlify dashboard → **Site configuration → Identity → Enable Identity**
- Under Identity → **Registration**: set to *Invite only*
- Identity → **Services → Git Gateway**: enable
- **Invite yourself** (Identity → Invite users → your email)
- Accept the email invite, set a password
- Go to `https://draftedapparel.com/admin` → log in → edit

> Note: Netlify Identity is being phased out long-term. If you prefer, switch the
> `backend` in `admin/config.yml` to GitHub OAuth later. Identity is fastest to launch.

### 4. Point the domain
- GoDaddy → point `draftedapparel.com` to Netlify (or use Netlify DNS)
- Set up in Netlify → Domain management

## How editing works
1. You open `/admin`, change text or upload a photo
2. Decap commits the change to `/content/*.json` (and images to `/assets/uploads/`)
3. Netlify auto-rebuilds and redeploys
4. Pages fetch the JSON on load and render the new content

No code needed to swap photos, prices, testimonials, or copy.

## Build status
- [x] Homepage (Decap-wired, before/after slider, social proof, guarantee bar)
- [x] shop.html · how-it-works.html · about.html · contact.html
- [x] products/* — generated from `scripts/build-products.js` (full customization + checkout)
- [x] proof.html — live generation, approve / regenerate ×3 / manual touch
- [x] Backend: checkout → webhook → generation → compositor → proof (steps 1–6)
- [x] RUNBOOK.md — full deployment guide (step 8)
- [ ] Real photos (swap via Decap `/admin`)
- [ ] Live provider key + one paid live test (RUNBOOK Phase 7)
- [ ] Printful API automation (manual push for now — print files in `print-files` bucket)

Note: the proof page IS the post-purchase page (Stripe redirects straight to it),
so a separate order-confirmation.html isn't needed.
