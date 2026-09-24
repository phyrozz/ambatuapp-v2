import sharp from 'sharp';
const svg=await (await import('node:fs/promises')).readFile('public/app-icon.svg');
for (const size of [180,192,512]) await sharp(svg).resize(size,size).png().toFile(`public/app-icon-${size}.png`);
