import assert from 'node:assert/strict';
import test from 'node:test';
import { isMaintenanceAllowed } from '../src/lib/maintenance-mode.ts';

test('maintenance mode only allows the maintenance page', () => {
  for (const path of ['/maintenance', '/maintenance/']) {
    assert.equal(isMaintenanceAllowed(path), true, path);
  }
  for (const path of ['/', '/chat/', '/characters/', '/games', '/games/ambatusnake/', '/explore/', '/profile/', '/games-extra/', '/profiled/', '/maintenance/other']) {
    assert.equal(isMaintenanceAllowed(path), false, path);
  }
});
