import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
const root = resolve(import.meta.dirname, '..');
const iconSvg = await readFile(resolve(root, 'public/app-icon.svg'), 'utf8');
const icon = Buffer.from(iconSvg);
const foreground = await readFile(resolve(root, 'public/app-icon-foreground.svg'));
const iconContent = iconSvg.match(/^<svg[^>]*>([\s\S]*)<\/svg>\s*$/)?.[1];
if (!iconContent) throw new Error('Could not read the app icon SVG contents.');
await writeFile(resolve(root, 'src/app/icon.svg'), iconSvg);
const splash = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732"><rect width="2732" height="2732" fill="#f8f7f2"/><svg x="1126" y="1126" width="480" height="480" viewBox="0 0 96 96">${iconContent}</svg></svg>`,
);
for (const [name, size] of [
  ['app-icon-180.png', 180],
  ['app-icon-192.png', 192],
  ['app-icon-512.png', 512],
])
  await sharp(icon).resize(size, size).png().toFile(resolve(root, 'public', name));
for (const [density, size] of [
  ['mdpi', 48],
  ['hdpi', 72],
  ['xhdpi', 96],
  ['xxhdpi', 144],
  ['xxxhdpi', 192],
]) {
  for (const name of ['ic_launcher.png', 'ic_launcher_round.png'])
    await sharp(icon)
      .resize(size, size)
      .png()
      .toFile(resolve(root, `android/app/src/main/res/mipmap-${density}/${name}`));
  await sharp(foreground)
    .resize((size * 108) / 48, (size * 108) / 48)
    .png()
    .toFile(resolve(root, `android/app/src/main/res/mipmap-${density}/ic_launcher_foreground.png`));
}
const res = resolve(root, 'android/app/src/main/res');
for (const dir of await readdir(res)) {
  if (!dir.startsWith('drawable')) continue;
  const path = resolve(res, dir, 'splash.png');
  try {
    const { width, height } = await sharp(path).metadata();
    const data = await sharp(splash).resize(width, height, { fit: 'cover' }).png().toBuffer();
    await writeFile(path, data);
  } catch (error) {
    if (error.message?.includes('Input file is missing')) continue;
    throw error;
  }
}
await sharp(icon)
  .resize(1024, 1024)
  .flatten({ background: '#f6542f' })
  .png()
  .toFile(resolve(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'));
for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'])
  await sharp(splash)
    .png()
    .toFile(resolve(root, `ios/App/App/Assets.xcassets/Splash.imageset/${name}`));
console.log('Updated web, Android and iOS icons and launch artwork.');
