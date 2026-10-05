import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarNota } from '../src/domain/validacion.ts';

test('acepta notas válidas de la escala 1–10', () => {
  assert.deepEqual(validarNota('1'), { ok: true, valor: 1 });
  assert.deepEqual(validarNota('6'), { ok: true, valor: 6 });
  assert.deepEqual(validarNota('10'), { ok: true, valor: 10 });
  assert.deepEqual(validarNota('7.5'), { ok: true, valor: 7.5 });
  assert.deepEqual(validarNota('8.25'), { ok: true, valor: 8.25 });
});

test('acepta espacios alrededor y un único valor numérico', () => {
  assert.deepEqual(validarNota('  9  '), { ok: true, valor: 9 });
});

test('rechaza notas fuera de rango', () => {
  assert.equal(validarNota('0').ok, false);
  assert.equal(validarNota('10.1').ok, false);
  assert.equal(validarNota('-3').ok, false);
});

test('rechaza entradas no numéricas o vacías', () => {
  assert.equal(validarNota('').ok, false);
  assert.equal(validarNota('   ').ok, false);
  assert.equal(validarNota('abc').ok, false);
  assert.equal(validarNota('NaN').ok, false);
  assert.equal(validarNota('Infinity').ok, false);
});

test('los errores son mensajes legibles para la UI', () => {
  const vacio = validarNota('');
  const fuera = validarNota('11');
  assert.equal(vacio.ok, false);
  assert.equal(fuera.ok, false);
  if (!vacio.ok) assert.ok(vacio.error.length > 0);
  if (!fuera.ok) assert.match(fuera.error, /1 y 10/);
});
