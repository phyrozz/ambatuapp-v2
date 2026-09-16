import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
const root = resolve(import.meta.dirname, '..');
const icon = await readFile(resolve(root, 'src/app/icon.svg'));
const foreground = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><path d="M32 75 49 33h10l17 42H63l-3-9H46l-3 9Zm18-19h7l-3.5-12Z" fill="#fff9e9"/></svg>',
);
const splash = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732"><rect width="2732" height="2732" fill="#f8f7f2"/><g transform="translate(1246 1246) scale(3.75)"><rect width="64" height="64" rx="18" fill="#f6542f"/><path d="M17 45 29 17h7l12 28h-9l-2-6H27l-2 6Zm13-13h5l-2.5-8Z" fill="#fff9e9"/></g></svg>',
);
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
console.log('Updated Android and iOS icons and launch artwork.');
