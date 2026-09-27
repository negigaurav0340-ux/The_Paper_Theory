# The Paper Theory storefront

This is a static storefront. Upload the contents of this folder to a static host with `index.html` at the site root. Keep the directory structure intact. `catalogue.html` is the printable sticker code book; `sticker-catalogue.csv` is the internal code index. No build command is needed.

## Sticker packs

The store has 11 preset category packs and a custom mix. Preset 6, 12, and 16 sticker sheets are ₹99 regular laminated or ₹199 holographic. Custom sheets are ₹129 regular or ₹229 holographic. The catalogue contains 158 unique codes. Customers can choose codes across category filters, print the A4 catalogue, and pass exactly 6, 12, or 16 codes into the custom product. The website checks known unique codes and the selected count before adding that product to the bag.

Each pack carousel slide switches between a sheet image and laptop preview. The three A4 Light Boxes remain featured at the top. The previous individual sticker cards and 10-sticker bundle are no longer sold in this version.

## Orders and media

The cart and favourites use browser storage. The generated order PDF and WhatsApp continuation are the ordering flow; this static package does not send orders or emails on its own. `admin.html` shows local browser analytics rather than cross-visitor results. The sticker and Light Box artwork is bundled, so the storefront does not rely on remote image hosts.

The Instagram section plays one locally hosted product demo and links to the current Reels tab. Automatic in-page retrieval of new Instagram posts requires a separately configured authenticated integration. The website does not claim its static video is a live feed.

Contacts: Instagram `@thepapertheory.in`, YouTube `@the_papertheory`, email `thepapertheory.in@gmail.com`, WhatsApp `+91 82195 78050`.

## Editing

- `js/products.js`: products, variants, prices and categories.
- `sticker-catalogue.json` and matching `js/catalogue-data.js`: catalogue entries.
- `js/sticker-packs-data.js`: pack carousel information.
- `assets/catalogue/`: sticker code images.
- `assets/sticker-packs/`: sheet and laptop previews.

Keep the JSON, JavaScript catalogue data, CSV and image filenames in sync if codes change. The `WEBSITE-UPDATE-PROMPT.md` file documents the design and future integration brief.
