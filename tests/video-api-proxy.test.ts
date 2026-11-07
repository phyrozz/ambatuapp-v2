import assert from 'node:assert/strict';
import test from 'node:test';

test('video and Dream API rewrites exist in development and production web builds, with native exports excluded', async () => {
  const original = { ...process.env };
  try {
    for (const [index, scenario] of [
      { mode: 'development', native: '0', api: 'https://api.example.test/api/public/', expected: true },
      { mode: 'production', native: '0', api: 'https://api.example.test/api/public/', expected: true },
      { mode: 'production', native: '1', api: 'https://api.example.test/api/public/', expected: false },
      { mode: 'production', native: '0', api: '', expected: false },
    ].entries()) {
      Object.assign(process.env, {
        NODE_ENV: scenario.mode,
        NATIVE_BUILD: scenario.native,
        NEXT_PUBLIC_CHARACTER_API_URL: scenario.api,
      });
      const configUrl = new URL(`../next.config.ts?video-proxy-case=${index}`, import.meta.url);
      const { default: config } = await import(configUrl.href);
      const rules = config.rewrites ? await config.rewrites() : [];
      const videoRule = rules.find((rule: { source: string }) => rule.source === '/api/public/videos/:id');
      assert.equal(Boolean(videoRule), scenario.expected, JSON.stringify(scenario));
      if (videoRule) assert.equal(videoRule.destination, 'https://api.example.test/api/public/videos/:id');
      const dreamRule = rules.find((rule: { source: string }) => rule.source === '/api/public/ambatupost/:path*');
      assert.equal(Boolean(dreamRule), scenario.expected, JSON.stringify(scenario));
      if (dreamRule) assert.equal(dreamRule.destination, 'https://api.example.test/api/public/ambatupost/:path*');
      assert.equal(config.output === 'export', scenario.native === '1');
      if (scenario.mode === 'production') {
        assert.equal(rules.some((rule: { source: string }) => rule.source.includes('/contributions/')), false);
      }
    }
  } finally {
    for (const key of ['NODE_ENV', 'NATIVE_BUILD', 'NEXT_PUBLIC_CHARACTER_API_URL']) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});
