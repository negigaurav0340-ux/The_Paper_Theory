# The Paper Theory — unified online store editor

## Start here

Upload this update to your existing GitHub repository and let Vercel deploy it. Then open:

**https://thepapertheory.in/owner.html**

This is the ONE page for products, sticker packs, individual catalogue designs, artwork uploads, names, categories, sizes, prices, availability, pack contents, website content and Instagram posts. It works on your live domain, not just localhost.

## What is the owner password?

**There is no preset password.** You create it in Vercel:

1. Open your Vercel project.
2. Go to Settings → Environment Variables.
3. Add `CATALOGUE_ADMIN_PASSWORD`.
4. Its value is a long, unique password that YOU choose. Do not use your Gmail/GitHub login password.
5. Select Production and redeploy once.
6. Enter that exact value in the Owner password field on `owner.html`.

The password is never placed in this ZIP or committed to GitHub. It stays in the form while the page is open. The GitHub token is a separate secret; never enter the token in the owner password field. The same owner password also protects live analytics. Legacy manager URLs redirect to the appropriate section of the unified editor.

## One-time connection for online editing + GitHub publishing

Set these four Vercel environment variables:

| Name | Value |
|---|---|
| `CATALOGUE_REPO` | Your actual GitHub `account/repository` |
| `CATALOGUE_BRANCH` | The branch Vercel deploys, usually `main` |
| `CATALOGUE_GITHUB_TOKEN` | Fine-grained GitHub token for this repository only, Contents: Read and write |
| `CATALOGUE_ADMIN_PASSWORD` | The owner password you choose |

Create the fine-grained token in GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens. Select only your website repository. Choose an expiry and grant Repository permissions → Contents: Read and write. Organization repos may need approval. Branch protection must allow this owner workflow; otherwise use the manual backup route rather than disabling your protection blindly.

Keep the token and password only in Vercel environment variables, marked as Secret if available. Never paste them into HTML, JavaScript, README files or chat.

Make sure Vercel Settings → Git is connected to that same repository and production branch. Redeploy once after setting the variables. Open `https://thepapertheory.in/api/manage`; a configured connection returns `configured: true`, published data and a revision, without exposing your secrets. The owner page should say **Connected**.

The complete workflow is:

**Edit → Save draft → Publish all to GitHub → Vercel deploys the commit.**

One publish saves these four files together in one GitHub commit:

- `js/product-updates.js`
- `js/catalogue-updates.js`
- `js/pack-updates.js`
- `js/site-settings.js`

Visitors read published data on refresh. The connected Vercel build regenerates product pages and sitemap for indexing/new product URLs. The page links to the actual GitHub commit after a successful publish. A GitHub commit is not proof that Vercel finished deploying; check the Vercel deployment status before announcing new URLs.

This update cannot configure your actual account/repository/password without your hosting access. Upload the supplied ZIP first, then complete the setup above. A local Python server cannot run the online publishing API.

## Upload the website update

1. Download and extract the ZIP.
2. Back up the current repository folder.
3. In GitHub Desktop, open your existing website repo and choose Repository → Show in Explorer.
4. Copy the CONTENTS of the extracted folder into the repository root. Replace matching website files. `index.html`, `api`, `js`, `assets`, `scripts` and `server` must be at the root; do not nest the whole update folder inside it.
5. Commit the changes, then Push origin.
6. In Vercel, use Framework **Other**, Build Command `node scripts/build-seo.cjs`, and Output Directory **.** (one dot). These are included in `vercel.json`. There are no third-party runtime dependencies to install.
7. After deployment, open the live owner page and confirm the online setup above.

## Edit everything in one place

### Products and complete packs

- Open Products & packs.
- Search for a name, category or ID.
- Press **Edit all details**.
- Change name, category, theme, description, availability, artwork and price options.
- Light Boxes use primary image = ON and second image = OFF.
- For a sticker pack, select **Yes / ready-made sticker pack** and edit the count, format, page slug, complete artwork and exact catalogue codes.
- Every pack option must begin with the actual count, e.g. `12 stickers · 3 × 4 sheet`. The editor rejects counts that disagree with its size options.
- Press Save product draft. When ready, Publish all to GitHub.

Changing a pack's primary product image does not silently replace its complete original sheet image. Use **Complete pack artwork** to replace the sheet preview. This keeps illustrative lifestyle images separate from actual contents.

### Add a new pack

1. Press **+ Add product / pack**.
2. Fill out the product details and upload a primary image.
3. Add the real size/finish/price options. Do not advertise a holographic option unless you genuinely sell it.
4. Select Yes / ready-made sticker pack.
5. Set the exact count and format. Use a unique lower-case page slug, e.g. `new-anime-pack`.
6. Upload the complete sheet image. Optionally enter the exact individual codes, separated by commas.
7. If codes are provided, they must be unique, available in the catalogue and equal the sticker count.
8. Save and publish. New packs appear in the homepage pack list; Vercel generates their product page on deployment.

### Individual stickers

- Open Individual stickers.
- Search by code, name, category or pack name (for example Gym Motivation); use the pack dropdown to show every design in one pack; the list pages through designs rather than loading every image at once.
- Add a design or press Edit to rename it, change category or replace its image.
- Batch uploads accept up to 12 web preview images at once; filenames become names.
- Hide / Restore keeps stable codes. A design referenced by a visible pack cannot be hidden until that pack's contents are corrected or the pack is hidden.
- Complete long-strip packs go under Products & packs; don't upload their entire sheet as one individual selectable sticker.

### Website and Instagram

Website & SEO edits the homepage heading/intro, announcement, WhatsApp number, Instagram profile, shipping explanation and homepage search title/description. Save website draft, then Publish all.

Instagram posts accepts public Reel/post links and labels. Add/remove them on the same page.

The dashboard edits the entire catalogue and these content fields. Page layouts, animations and hardcoded editorial sections still live in the HTML/CSS source. The source is included.

## Current long packs and exact sizes

| Pack type | Contents | Price per complete pack |
|---|---|---|
| Anime Original / Anime Variant / Multi Anime | 4 long stickers, each **6 × 2 inches** | **₹99** |
| Naruto & Akatsuki | 2 long stickers, each **10 × 2 inches** | **₹99** |

6 × 2 inches = 15.24 × 5.08 cm. 10 × 2 inches = 25.4 × 5.08 cm.

The earlier 8 × 1 and 11 × 1 sizes are superseded. Pack counts are unchanged. The existing normal sheets keep their actual counts from the supplied artwork: some are 16, some 12, and Friendship is 6. They are not all advertised as 16.

Laptop placement previews are rendered from the original artwork, not regenerated characters. The image pipeline identifies separate connected silhouettes and preserves internal white detail. The full original sheet is also shown using contain, never crop-to-fill. Previews are illustrative; they do not claim exact laptop scale. Aspect ratios of supplied artwork are preserved rather than stretched.

**These website previews are not Cricut cut files or print calibration proofs.** Keep original print masters. Configure final production size, offset and material settings in Cricut Design Space, print a test and confirm actual contour alignment before fulfilling orders. Changing a website size does not resize an already-printed sheet. Neither a web thumbnail nor a compressed upload should be used as the production master.

## Save status, conflicts and backups

- Save draft writes in your current browser only; it does not publish.
- Publish all uses the server password and saves all catalogue sections in one commit.
- Wrong password makes no repository requests.
- If someone updated GitHub after you loaded the editor, publishing is rejected rather than overwriting the newer revision. Download your draft backup, reload the latest data, and reapply the necessary changes.
- Concurrent branch changes are also rejected; force pushes are never used.
- Restore saved browser draft is offered after reopening the page; it doesn't silently overwrite freshly loaded published data.
- Download draft backup creates one JSON backup. Import backup restores it. Old per-section JS backups are still handled by their original managers, not this unified JSON importer.
- Download complete website ZIP includes the source, images and all saved unified drafts. It does not publish anything by itself. Extract it into your repo and push if you choose manual upload instead.
- Keep one editing browser/tab at a time. Do not clear browser storage before exporting. Browser storage is limited: use smaller web images or smaller batches, and keep backups.
- Changes in an open form must be saved before publishing. The publish button saves the current catalogue state, not unsaved form inputs.

No API key/password is required for the manual ZIP export path. Online saves require the one-time connection. There is no way for a static file alone to securely change your remote GitHub repository without a protected server and credentials.

## SEO and verification

The Vercel build generates product pages and structured data using actual product prices and pack artwork, and updates the sitemap. Pack metadata is applied to frontend views, product pages and homepage cards. The duplicate “More stickers. More you.” section is removed. Shop cards, new arrivals and the main pack carousel use a consistent silver-laptop scene with the original artwork. Long-pack cards show one laptop composition; original sheets remain on their product pages. Admin/editor pages are excluded from indexing.

Run these checks locally if Node.js is installed:

```text
node scripts/build-seo.cjs
node scripts/verify.cjs
node scripts/verify-publish.cjs
```

For local file previews with Python installed:

```text
python -m http.server 8000
```

Open `http://localhost:8000/owner.html`. This is a static preview; use your live Vercel domain for online publishing. Google controls indexing/ranking and no ranking or sales guarantee is made.

## Troubleshooting

- **No owner password:** set `CATALOGUE_ADMIN_PASSWORD` in Vercel and redeploy. There is no default.
- **Online publishing not connected:** check all four environment variables, repository/branch spelling, API folder deployment and token permission/expiry.
- **Publish succeeded but new URL missing:** wait for Vercel's deployment. Check Settings → Git and production branch. Some account/team configurations require author approval.
- **403/404 GitHub error:** check token scope, expiry, repository spelling and branch protection. This is separate from the owner password.
- **Outdated draft:** download a backup, reload from GitHub and reapply your edits.
- **Image too detailed:** choose a smaller web preview; keep the original print-ready file separately.
- **ZIP export failed:** use the live hosted site or localhost server, and make sure the build ran before exporting.
- **Analytics empty:** cross-visitor analytics needs the separate Upstash setup in `ANALYTICS-SETUP.md`.

The existing checkout remains PDF + WhatsApp confirmation. This update does not introduce a payment gateway or paid-order database.

Official references: https://vercel.com/docs/git/vercel-for-github · https://vercel.com/docs/environment-variables/managing-environment-variables · https://docs.github.com/en/rest/git/trees · https://developers.google.com/search/docs/appearance/structured-data/product-snippet


## Publishing messages explained

- **Offline website editor:** you opened `owner.html` directly from the downloaded folder (`file://`). Editing and backups work; a local file cannot run Vercel server functions. Open the hosted URL for publishing.
- **Editor ready · publishing setup needed:** the catalogue can be edited, but this host cannot reach or run the publishing endpoint. The message explains whether the endpoint is missing, configuration is incomplete, or the connection timed out. Upload the complete folder (including `api/`, `server/`, `scripts/`, `package.json` and `vercel.json`), set the four environment variables, and redeploy.
- **Connected to GitHub:** the current published data and revision loaded successfully. Your chosen owner password is still required to publish.
- **Publish accepted:** the editor provides a GitHub commit link. Wait for the linked repository's Vercel production deployment to finish, then refresh the public shop.

A static-only host such as GitHub Pages does not run these server functions. Keep GitHub as the source repository and use the connected Vercel project for the live domain. This ZIP cannot supply your account connection or choose your private owner password for you.

## Website pages and their purpose

These are the intended production addresses after deploying this update to your domain. This document does not confirm that the current live deployment has been updated.

| Address | Purpose |
| --- | --- |
| `https://thepapertheory.in/` | Homepage: shop, product filters, sticker packs, new arrivals, long packs, cart and custom requests. |
| `https://thepapertheory.in/index.html#shop` | Jump directly to the main shop and its filters. |
| `https://thepapertheory.in/index.html#custom` | Custom artwork/request form. |
| `https://thepapertheory.in/sticker-packs.html` | Sticker-sheet collection, latest packs, prices and links to exact pack details. |
| `https://thepapertheory.in/long-stickers.html` | Four long-sticker packs: 4 × 6 × 2-inch stickers or 2 × 10 × 2-inch stickers, ₹99 per pack. |
| `https://thepapertheory.in/catalogue.html` | Customer-facing catalogue of individual sticker designs and codes, grouped by pack. |
| `https://thepapertheory.in/light-boxes.html` | Light-box collection and product links. |
| `https://thepapertheory.in/about.html` | Brand information and contact links. |
| `https://thepapertheory.in/owner.html` | Main owner editor: products, packs, individual designs, uploads, prices, website settings, SEO and Instagram posts; backups and GitHub publishing. |
| `https://thepapertheory.in/owner.html#products` | Open the products and packs editing tab. |
| `https://thepapertheory.in/owner.html#designs` | Open individual designs; search by pack name or choose the pack filter to find Gym Motivation and all other packs. |
| `https://thepapertheory.in/owner.html#settings` | Edit homepage copy, contact details and homepage SEO. |
| `https://thepapertheory.in/owner.html#reels` | Manage Instagram post links. |
| `https://thepapertheory.in/product-manager.html` | Compatibility address; redirects to the main editor's products tab. |
| `https://thepapertheory.in/catalogue-manager.html` | Compatibility address; redirects to the main editor's individual-designs tab. |
| `https://thepapertheory.in/admin.html` | Owner analytics dashboard; private data requires the configured owner password. |
| `https://thepapertheory.in/README-OWNER.md` | This setup, uploading, editing and page guide. |
| `https://thepapertheory.in/sitemap.xml` | Public-page list for search engines, regenerated during deployment. |
| `https://thepapertheory.in/robots.txt` | Search-crawler instructions. |

### Every product page

Each product page shows the actual product name, artwork, sizes, finishes and prices, then links to the homepage's option selector/order flow. Sheet and long-sticker pages include a laptop placement preview plus complete original artwork. These pages also contain product structured data and canonical URLs for search engines. New product pages are created when Vercel runs the build after a GitHub publish.

| Address | Product |
| --- | --- |
| `https://thepapertheory.in/products/long-anime-original.html` | Anime Original Long Sticker Pack |
| `https://thepapertheory.in/products/long-anime-variant.html` | Anime Variant Long Sticker Pack |
| `https://thepapertheory.in/products/long-multi-anime.html` | Multi Anime Long Sticker Pack |
| `https://thepapertheory.in/products/long-naruto-akatsuki.html` | Naruto & Akatsuki Long Sticker Pack |
| `https://thepapertheory.in/products/anime-classics.html` | Anime Classics Pack |
| `https://thepapertheory.in/products/anime-heroes.html` | Anime Heroes |
| `https://thepapertheory.in/products/anime-meme.html` | Anime Meme Pack |
| `https://thepapertheory.in/products/feel-good.html` | Feel Good Pack |
| `https://thepapertheory.in/products/team-motu.html` | Team Motu Pack |
| `https://thepapertheory.in/products/team-bheem.html` | Team Bheem Pack |
| `https://thepapertheory.in/products/diwali-01.html` | Diwali Devotional Pack |
| `https://thepapertheory.in/products/diwali-02.html` | Diwali Festive Pack |
| `https://thepapertheory.in/products/cute-mood.html` | Cute Mood Pack |
| `https://thepapertheory.in/products/engineering-campus.html` | Engineering & Campus Pack |
| `https://thepapertheory.in/products/friendship.html` | Friendship Pack |
| `https://thepapertheory.in/products/pack-custom.html` | Build Your Own Sticker Pack |
| `https://thepapertheory.in/products/pack-upload.html` | Your Artwork Sticker Sheet |
| `https://thepapertheory.in/products/sun-001.html` | Believe in Myself · Suncatcher |
| `https://thepapertheory.in/products/sun-002.html` | Woodland Mushroom · Suncatcher |
| `https://thepapertheory.in/products/sun-003.html` | Mountain Sunrise · Suncatcher |
| `https://thepapertheory.in/products/sun-004.html` | Celestial Window · Design Collection |
| `https://thepapertheory.in/products/sun-shape-001.html` | Prism Shapes · Pick Four or Mix |
| `https://thepapertheory.in/products/mag-001.html` | Photo Fridge Magnet · Choose Your Design |
| `https://thepapertheory.in/products/acr-001.html` | Anime Collage · A4 Acrylic Poster |
| `https://thepapertheory.in/products/acr-002.html` | Dragon Ball · Transformations |
| `https://thepapertheory.in/products/org-001.html` | Spiky-Haired Silhouette · Custom Cut |
| `https://thepapertheory.in/products/pol-001.html` | Memoroids · Your Moments |
| `https://thepapertheory.in/products/sha-001.html` | Layered Shadow Boxes · Coming Soon |
| `https://thepapertheory.in/products/lit-001.html` | After Dark · Light Boxes |
| `https://thepapertheory.in/products/bnd-002.html` | Build Your Own · Fandom Gift Set |
| `https://thepapertheory.in/products/gym-motivation.html` | Gym Motivation |
| `https://thepapertheory.in/products/anime-fitness.html` | Anime Fitness |
| `https://thepapertheory.in/products/healthy-food.html` | Healthy Food |
| `https://thepapertheory.in/products/engineer-quotes.html` | Engineer Quotes |
| `https://thepapertheory.in/products/ultimate-memes-1.html` | Ultimate Memes Vol. 1 |
| `https://thepapertheory.in/products/ultimate-memes-2.html` | Ultimate Memes Vol. 2 |
| `https://thepapertheory.in/products/kawaii-sassy-1.html` | Kawaii & Sassy Vol. 1 |
| `https://thepapertheory.in/products/kawaii-sassy-2.html` | Kawaii & Sassy Vol. 2 |

