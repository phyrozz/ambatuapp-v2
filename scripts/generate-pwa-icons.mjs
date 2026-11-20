// Generate only the web icons using the shared artwork pipeline.
process.argv.push('--web-only');
await import('./native-artwork.mjs');
