import assert from 'node:assert/strict';
import test from 'node:test';
import { isMaintenanceAllowed } from '../src/lib/maintenance-mode.ts';

test('maintenance mode allows only the requested sections and their subpages', () => {
  for (const path of ['/maintenance', '/maintenance/', '/games', '/games/ambatusnake/', '/explore/', '/profile/']) {
    assert.equal(isMaintenanceAllowed(path), true, path);
  }
  for (const path of ['/', '/chat/', '/characters/', '/games-extra/', '/profiled/', '/maintenance/other']) {
    assert.equal(isMaintenanceAllowed(path), false, path);
  }
});
