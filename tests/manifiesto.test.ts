// T2 — pipeline/manifiesto.json: las 59 carreras de pregrado con su origen (RF-1, RF-7, RF-16).
// El manifiesto es la única tabla curada: si miente aquí, todo el dataset miente (P1/P2).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const SEDES = ['soyapango', 'antiguo-cuscatlan', 'virtual'] as const;
const TIPOS = ['ingenieria', 'licenciatura', 'tecnico', 'profesorado'] as const;

type Entrada = {
  carrera: string;
  sede: (typeof SEDES)[number];
  tipo: (typeof TIPOS)[number];
  plan: string;
  modalidad: string;
  uvTotal: number;
  materiasTotal: number;
  urlPensum: string;
  paginaCarrera: string;
  comparteCon: string | null;
};

const manifiesto = JSON.parse(
  await readFile(new URL('../pipeline/manifiesto.json', import.meta.url), 'utf8'),
) as Entrada[];

test('RF-1: el manifiesto tiene exactamente 59 entradas', () => {
  assert.equal(manifiesto.length, 59);
});

test('RF-1: la distribución por sede es 33 Soyapango / 15 Antiguo Cuscatlán / 11 Virtual', () => {
  const porSede = Object.fromEntries(
    SEDES.map(sede => [sede, manifiesto.filter(e => e.sede === sede).length]),
  );
  assert.deepEqual(porSede, {
    soyapango: 33,
    'antiguo-cuscatlan': 15,
    virtual: 11,
  });
});

test('RF-1: solo pregrado (ningún tipo fuera de Ingenierías, Licenciaturas, Técnicos y Profesorados)', () => {
  for (const e of manifiesto) {
    assert.ok(TIPOS.includes(e.tipo), `tipo inesperado: ${e.tipo} (${e.carrera})`);
    assert.ok(SEDES.includes(e.sede), `sede inesperada: ${e.sede} (${e.carrera})`);
  }
});

test('RF-16: toda entrada declara su documento de origen en https://', () => {
  for (const e of manifiesto) {
    assert.match(e.urlPensum, /^https:\/\//, `urlPensum no https: ${e.carrera} → ${e.urlPensum}`);
    assert.match(e.paginaCarrera, /^https:\/\//, `paginaCarrera no https: ${e.carrera}`);
  }
  assert.equal(new Set(manifiesto.map(e => e.urlPensum)).size > 0, true);
});

test('ningún campo obligatorio está vacío y los totales son enteros positivos', () => {
  for (const e of manifiesto) {
    assert.ok(e.carrera.trim().length > 0, 'carrera vacía');
    assert.ok(e.plan.trim().length > 0, `plan vacío: ${e.carrera}`);
    assert.ok(e.modalidad.trim().length > 0, `modalidad vacía: ${e.carrera}`);
    assert.ok(Number.isInteger(e.uvTotal) && e.uvTotal > 0, `uvTotal inválida: ${e.carrera}`);
    assert.ok(
      Number.isInteger(e.materiasTotal) && e.materiasTotal > 0,
      `materiasTotal inválida: ${e.carrera}`,
    );
  }
});

test('RF-7: solo Antiguo Cuscatlán declara carrera compartada, con el mismo documento que Soyapango', () => {
  const soyapango = new Map(manifiesto.filter(e => e.sede === 'soyapango').map(e => [e.carrera, e]));

  for (const e of manifiesto) {
    if (e.sede !== 'antiguo-cuscatlan') {
      assert.equal(e.comparteCon, null, `${e.carrera} (${e.sede}) no debería compartir`);
      continue;
    }
    assert.ok(e.comparteCon, `AC sin comparteCon: ${e.carrera}`);
    const homologa = soyapango.get(e.comparteCon);
    assert.ok(homologa, `comparteCon no apunta a Soyapango: ${e.comparteCon}`);
    assert.equal(e.urlPensum, homologa.urlPensum, `distinto documento para ${e.carrera}`);
    assert.equal(e.uvTotal, homologa.uvTotal, `UV distintas para ${e.carrera}`);
    assert.equal(e.materiasTotal, homologa.materiasTotal, `materias distintas para ${e.carrera}`);
  }
});

test('las claves (tipo, sede, plan, carrera) no se repiten', () => {
  const claves = manifiesto.map(e => `${e.tipo}|${e.sede}|${e.plan}|${e.carrera}`);
  const vistas = new Set<string>();
  for (const k of claves) {
    assert.ok(!vistas.has(k), `clave duplicada: ${k}`);
    vistas.add(k);
  }
});
