# Laptop previews and sticker editor update

- Homepage carousel starts with Anime Heroes stickers on the silver laptop.
- All 19 regular packs and 4 long packs have a stored laptop preview using original catalogue artwork. Originals remain available in each carousel/product page.
- Regular catalogue editor: 16 designs, 4 × 4. Long editor: exact matching packs of 4 or 2; finishes and designs cannot cross layouts.
- Reorder, remove, restore saved selection, download A4 PNG, print, and add the complete selection to the existing bag/checkout.
- Exports do not include Cricut registration marks. Import into Design Space before Print Then Cut. Full-size long formats may require a suitable larger machine/mat workflow.
- Start local preview: run `python3 -m http.server 8000` in this folder; open http://localhost:8000/catalogue.html.
- Online owner publishing keeps the existing authenticated `/api/manage` GitHub/Vercel connection. It requires the repository, branch, GitHub token and owner password configured on the hosting account; no credentials are supplied by this ZIP. See owner.html and README-OWNER.md.
- Verified: asset/count consistency, build, backend security/conflict checks, editor layout restrictions, reordering, saved drafts and bag payloads. Browser page QA was unavailable in this workspace.
