import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const soundSource = readFileSync(resolve(root, 'legacy/lib/pages/soundboard.dart'), 'utf8');
const sounds = [
  ...soundSource.matchAll(
    /SoundItem\(\s*name:\s*'([^']+)',\s*soundUrl:\s*'assets\/sounds\/([^']+)'\)/g,
  ),
].map((m, i) => ({
  id: m[2].replace('.mp3', ''),
  name: m[1],
  file: `/assets/sounds/${m[2]}`,
  category: /remix|music|choir|spongebob|kita/i.test(m[1])
    ? 'Remixes'
    : /bunda|bus$|kakangku|nissan|king/i.test(m[1])
      ? 'The crew'
      : 'Classics',
  color: i % 4,
}));
const characters = readdirSync(resolve(root, 'legacy/lib/pages/characters'))
  .filter((f) => f.endsWith('.dart'))
  .map((f) => {
    const source = readFileSync(resolve(root, 'legacy/lib/pages/characters', f), 'utf8');
    const id = f.replace('.dart', '');
    const header = source.match(/bgUrl: '([^']+)',\s*text: '([^']+)'/);
    const paragraphs = [
      ...source.matchAll(/(?:const\s+)?Text\(\s*r?(['"])((?:\\.|(?!\1)[\s\S])*?)\1\s*,/g),
    ]
      .map((m) => m[2].replace(/\\'/g, "'").replace(/\\n/g, '\n'))
      .filter((t) => t.length > 80 && !t.includes('under construction'));
    return {
      id,
      name: header?.[2] || id,
      image: `/assets/${id === 'bus_soldier' ? 'bus_soldier.png' : id + '.jpg'}`,
      header: '/' + (header?.[1] || `assets/${id}.jpg`),
      paragraphs,
      links: [...source.matchAll(/_launchUrl\('(https:[^']+)'\)/g)].map((m) => m[1]),
    };
  })
  .sort((a, b) => (a.id === 'dreamy' ? -1 : b.id === 'dreamy' ? 1 : a.name.localeCompare(b.name)));
writeFileSync(
  resolve(root, 'revamp/src/data/legacy.json'),
  JSON.stringify({ sounds, characters }, null, 2) + '\n',
);
console.log(`Migrated ${sounds.length} sounds and ${characters.length} characters.`);
