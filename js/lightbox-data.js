(() => {
  'use strict';
  const catalogue = window.CATALOGUE;
  if (!catalogue?.products) return;
  const product = catalogue.products.find(item => item.id === 'LIT-001');
  if (!product) return;

  const shared = {
    categories: ['Light Boxes'],
    description: 'Artwork by day and a colour-changing centrepiece after dark. A real A4 display with built-in lighting and remote controller included.',
    video: 'assets/lightbox/lightbox-demo.mp4',
    unit: '1 A4 Light Box · remote included',
    contents: ['A4 Light Box', 'Built-in colour-changing lighting', 'Remote controller'],
    status: 'order',
    application: 'Place on a stable indoor surface. Use the included remote to change colours and lighting modes. Power connection details are confirmed with the order.',
    care: 'Handle carefully, keep away from moisture, clean with a soft dry microfibre cloth, avoid harsh chemicals and disconnect power before cleaning.',
    quality: 'A4 format · 210 × 297 mm. Real product footage is shown in the Light Box showcase.'
  };

  Object.assign(product, shared, {
    name: 'Eren · A4 Anime Light Box',
    theme: 'Attack on Titan',
    images: ['assets/lightbox/lightbox-eren-on.webp', 'assets/lightbox/lightbox-eren-off.webp'],
    variants: [{ id: 'LIT-EREN-A4', size: 'A4 · 210 × 297 mm', finish: 'Eren · Colour-changing', price: 1199, image: 'assets/lightbox/lightbox-eren-on.webp' }]
  });

  const lightBoxDesigns = [
    { id: 'LIT-GOKU', name: 'Goku · A4 Anime Light Box', theme: 'Dragon Ball', slug: 'goku' },
    { id: 'LIT-LUFFY', name: 'Luffy · A4 Anime Light Box', theme: 'One Piece', slug: 'luffy' }
  ];
  lightBoxDesigns.forEach(item => {
    if (catalogue.products.some(existing => existing.id === item.id)) return;
    catalogue.products.push({
      ...shared,
      id: item.id,
      name: item.name,
      theme: item.theme,
      images: [`assets/lightbox/lightbox-${item.slug}-on.webp`, `assets/lightbox/lightbox-${item.slug}-off.webp`],
      variants: [{ id: `${item.id}-A4`, size: 'A4 · 210 × 297 mm', finish: `${item.name.split(' · ')[0]} · Colour-changing`, price: 1199, image: `assets/lightbox/lightbox-${item.slug}-on.webp` }]
    });
  });

  if (!catalogue.products.some(item => item.id === 'PACK-10')) {
    catalogue.products.push({
      id: 'PACK-10',
      name: 'Build Your Own · 10 Sticker Pack',
      categories: ['Custom Packages / Bundles'],
      theme: 'Custom',
      description: 'Select exactly 10 eligible sticker designs in one chosen size. Price equals the single-sticker price for that size multiplied by 10.',
      images: ['assets/products/rengoku-flame.jpg','assets/products/zenitsu-thunder.jpg','assets/products/shinobu-butterfly.jpg'],
      variants: [
        { id: 'PACK-10-1', size: '1 inch', finish: '10 glossy / regular stickers', price: 180, image: 'assets/products/rengoku-flame.jpg' },
        { id: 'PACK-10-2', size: '2 inches', finish: '10 glossy / regular stickers', price: 300, image: 'assets/products/rengoku-flame.jpg' },
        { id: 'PACK-10-3', size: '3 inches', finish: '10 glossy / regular stickers', price: 390, image: 'assets/products/rengoku-flame.jpg' },
        { id: 'PACK-10-4', size: '4 inches', finish: '10 glossy / regular stickers', price: 450, image: 'assets/products/rengoku-flame.jpg' }
      ],
      unit: '10 stickers',
      status: 'order',
      application: 'Apply to clean, dry, smooth surfaces.',
      care: 'Avoid soaking and harsh abrasion.'
    });
  }
})();
