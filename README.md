# The Paper Theory storefront

This is a static storefront built from the supplied product-photo ZIP. It does not need a build command.

## Open it

Extract the ZIP and open `index.html` in a modern browser. For the most reliable video and PDF behaviour, serve the folder through a simple web host rather than opening it with a `file://` address.

Keep the folder structure unchanged:

- `index.html` contains the page structure.
- `style.css` contains the core styling and responsive rules.
- `loader.css` contains the Paperverse loading animation and its mobile/reduced-motion treatment.
- `animations.css` contains the optional motion and catalogue effects. Remove this link from `index.html` if you ever want a completely static design.
- `enhancements.css` contains the new catalogue sections and falling background effect.
- `js/products.js` is the editable catalogue, variants and current pricing.
- `js/app.js` handles filters, galleries, variants, favourites, cart, uploads and WhatsApp.
- `js/loader.js` connects the progress animation to page readiness and creates the optional paper-spark sound in the browser. Sound is enabled by default, subject to each browser's autoplay policy.
- `js/pdf.js` creates the branded order PDF.
- `assets/products/` and `assets/videos/` contain renamed, optimised product media.
- Product videos are loaded only when a visitor chooses to play them; the previous website-tour video has been removed to keep the storefront focused and faster.
- `asset-inventory.csv` maps each original file to its website asset.
- `vendor/` contains the local PDF library and its licence.

## Mobile and loading behaviour

The branded loader stays visible for about 3.5 seconds, with sound enabled by default. Mobile browsers may require the visitor's first tap before audible sound begins; this is a browser restriction. Visitors can turn sound off from the loader.

Catalogue cards appear immediately on screens up to 700 px wide, avoiding mobile intersection-observer delays. Desktop retains the staggered reveal. Large showcase PNGs have lightweight WebP browsing versions, product videos use `preload="none"`, and catalogue images use native lazy loading and asynchronous decoding.

## Edit products and prices

Open `js/products.js` in a text editor. Each product has a stable `id`, category list, description, images and `variants`. A variant contains its displayed size, finish, price and image. Numeric prices are in Indian rupees.

The numeric prices reflect the latest supplied catalogue rates. The 10 × 8-inch shadow box intentionally remains price-to-be-announced.

## Upload the website

Upload the contents of this folder to any static web host. The files use relative paths, so they can also be placed inside a subfolder. No server or database is required for browsing, the cart or PDF generation.

The custom artwork picker creates a local preview only. It does not upload the original file. Customers must share the original using a viewer-accessible Google Drive link or send it in the WhatsApp conversation.

Direct add-to-bag purchasing is intentionally limited to Regular, Matte and Holographic stickers, Memoroids and suncatchers. Acrylic displays and fridge magnets route to an enquiry. Shadow boxes and light boxes are marked Coming Soon.

## Contact settings

- Instagram: `@thepapertheory.in`
- WhatsApp: `+91 82195 78050`

These are stored in `js/products.js` and linked throughout the page.

## Browser data

The cart and favourites are stored in the visitor's browser. Clearing browser storage removes them. There is no Catalogue Studio or administrator login in this package.
