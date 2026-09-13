# The Paper Theory storefront

This is a static storefront built from the supplied product-photo ZIP. It does not need a build command.

## Open it

Extract the ZIP and open `index.html` in a modern browser. For the most reliable video and PDF behaviour, serve the folder through a simple web host rather than opening it with a `file://` address.

Keep the folder structure unchanged:

- `index.html` contains the page structure.
- `style.css` contains the core styling and responsive rules.
- `animations.css` contains the optional motion and catalogue effects. Remove this link from `index.html` if you ever want a completely static design.
- `enhancements.css` contains the new catalogue sections and falling background effect.
- `js/products.js` is the editable catalogue, variants and current pricing.
- `js/app.js` handles filters, galleries, variants, favourites, cart, uploads and WhatsApp.
- `js/pdf.js` creates the branded order PDF.
- `assets/products/` and `assets/videos/` contain renamed, optimised product media.
- `asset-inventory.csv` maps each original file to its website asset.
- `vendor/` contains the local PDF library and its licence.

## Edit products and prices

Open `js/products.js` in a text editor. Each product has a stable `id`, category list, description, images and `variants`. A variant contains its displayed size, finish, price and image. Numeric prices are in Indian rupees.

The numeric prices reflect the latest supplied catalogue rates. The 10 × 8-inch shadow box intentionally remains price-to-be-announced.

## Upload the website

Upload the contents of this folder to any static web host. The files use relative paths, so they can also be placed inside a subfolder. No server or database is required for browsing, the cart or PDF generation.

The custom artwork picker creates a local preview only. It does not upload the original file. Customers must share the original using a viewer-accessible Google Drive link or send it in the WhatsApp conversation.

## Contact settings

- Instagram: `@thepapertheory.in`
- WhatsApp: `+91 82195 78050`

These are stored in `js/products.js` and linked throughout the page.

## Browser data

The cart and favourites are stored in the visitor's browser. Clearing browser storage removes them. There is no Catalogue Studio or administrator login in this package.
