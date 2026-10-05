import { test } from 'node:test';
import assert from 'node:assert/strict';

// Humo: valida que el runner de tests y la compilación TS funcionan antes de escribir lógica.
test('el runner de tests y la resolución de módulos TS operan', async () => {
  const dominio = await import('../src/domain/index.ts');
  assert.equal(typeof dominio, 'object');
  assert.ok(process.version.startsWith('v'));
});
