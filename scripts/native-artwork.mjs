import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '..');
const artwork = await readFile(resolve(root, 'public/logo.png'));
const background = '#f8f7f2';

// Leave room around the portrait for maskable and adaptive icon crops.
async function icon(size, opaque = false, scale = 0.95) {
  const portrait = await sharp(artwork).resize(Math.round(size * scale), Math.round(size * scale)).png().toBuffer();
  const result = sharp({ create: { width: size, height: size, channels: 4, background: opaque ? background : '#00000000' } })
    .composite([{ input: portrait, gravity: 'centre' }]);
  if (opaque) result.removeAlpha();
  return result.png().toBuffer();
}

for (const size of [180, 192, 512]) {
  await writeFile(resolve(root, `public/app-icon-${size}.png`), await icon(size));
}
await writeFile(resolve(root, 'public/app-icon-maskable-512.png'), await icon(512, true, 0.72));
await writeFile(resolve(root, 'src/app/icon.png'), await icon(192));

if (process.argv.includes('--web-only')) {
  console.log('Updated web icons.');
  process.exit(0);
}

for (const [density, size] of [
  ['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192],
]) {
  for (const name of ['ic_launcher.png', 'ic_launcher_round.png']) {
    await writeFile(resolve(root, `android/app/src/main/res/mipmap-${density}/${name}`), await icon(size));
  }
  const adaptiveSize = (size * 108) / 48;
  await writeFile(resolve(root, `android/app/src/main/res/mipmap-${density}/ic_launcher_foreground.png`), await icon(adaptiveSize, false, 0.48));
}

const splashPortrait = await sharp(artwork).resize(480, 480).png().toBuffer();
const splash = await sharp({ create: { width: 2732, height: 2732, channels: 4, background: '#f8f7f2' } })
  .composite([{ input: splashPortrait, gravity: 'centre' }]).png().toBuffer();
const res = resolve(root, 'android/app/src/main/res');
for (const dir of await readdir(res)) {
  if (!dir.startsWith('drawable')) continue;
  const path = resolve(res, dir, 'splash.png');
  try {
    const { width, height } = await sharp(path).metadata();
    await writeFile(path, await sharp(splash).resize(width, height, { fit: 'cover' }).png().toBuffer());
  } catch (error) {
    if (error.message?.includes('Input file is missing')) continue;
    throw error;
  }
}
await writeFile(resolve(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'), await icon(1024, true, 0.95));
for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  await writeFile(resolve(root, `ios/App/App/Assets.xcassets/Splash.imageset/${name}`), splash);
}
console.log('Updated web, Android and iOS icons and launch artwork.');
