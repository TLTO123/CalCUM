import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sedesParaTipo, carrerasPara, tiposDisponibles } from '../src/domain/cascada.ts';
import type { Plan } from '../src/domain/tipos.ts';

// Índice de prueba que refleja la oferta real (AGENTS.md):
// - Profesorado solo en Soyapango.
// - Técnicos en las 3 sedes.
// - Homónimos con UV distintos: Ing. Computación presencial (161) vs virtual (176).
// - Antiguo Cuscatlán no tiene Profesorados ni Ingenierías distintas a Industrial/Computación.
function planesPrueba(): Plan[] {
  const base = (sobrescritura: Partial<Plan>): Plan => ({
    carrera: 'X',
    sede: 'soyapango',
    tipo: 'ingenieria',
    planVersion: 'plan-2024',
    modalidad: 'Semipresencial',
    uvTotal: 100,
    materiasTotal: 10,
    ciclos: [{ numero: 1, asignaturas: [] }],
    ...sobrescritura,
  });
  return [
    base({ carrera: 'Ingeniería en Ciencias de la Computación', sede: 'soyapango', tipo: 'ingenieria', uvTotal: 161 }),
    base({ carrera: 'Ingeniería en Ciencias de la Computación (a distancia)', sede: 'virtual', tipo: 'ingenieria', uvTotal: 176 }),
    base({ carrera: 'Técnico en Multimedia', sede: 'soyapango', tipo: 'tecnico', uvTotal: 64 }),
    base({ carrera: 'Técnico en Multimedia (Campus Antiguo Cuscatlán)', sede: 'antiguo-cuscatlan', tipo: 'tecnico', uvTotal: 64 }),
    base({ carrera: 'Técnico en Multimedia (a distancia)', sede: 'virtual', tipo: 'tecnico', uvTotal: 64 }),
    base({ carrera: 'Profesorado en Teología Pastoral', sede: 'soyapango', tipo: 'profesorado', uvTotal: 103 }),
  ];
}

test('RF-1: sedesParaTipo devuelve solo sedes con oferta de ese tipo', () => {
  assert.deepEqual(sedesParaTipo(planesPrueba(), 'profesorado'), ['soyapango']);
  assert.deepEqual(sedesParaTipo(planesPrueba(), 'tecnico').sort(), ['antiguo-cuscatlan', 'soyapango', 'virtual']);
});

test('RF-1: un tipo sin oferta devuelve lista vacía (la UI muestra sin resultados)', () => {
  assert.deepEqual(sedesParaTipo(planesPrueba(), 'licenciatura'), []);
});

test('RF-2: carrerasPara filtra por tipo + sede', () => {
  const resultado = carrerasPara(planesPrueba(), 'ingenieria', 'soyapango');
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0]!.uvTotal, 161);

  const virtual = carrerasPara(planesPrueba(), 'ingenieria', 'virtual');
  assert.equal(virtual.length, 1);
  assert.equal(virtual[0]!.uvTotal, 176); // homónimos no se mezclan
});

test('RF-3: combinación sin oferta => lista vacía', () => {
  assert.deepEqual(carrerasPara(planesPrueba(), 'profesorado', 'virtual'), []);
});

test('RF-1: sedes devueltas tienen un orden estable (orden de la UI)', () => {
  const sedes = sedesParaTipo(planesPrueba(), 'tecnico');
  assert.deepEqual(sedes, [...sedes].sort());
});

test('tiposDisponibles lista solo los tipos que existen en el índice', () => {
  assert.deepEqual(tiposDisponibles(planesPrueba()).sort(), ['ingenieria', 'profesorado', 'tecnico']);
});

test('índice vacío => todo vacío, sin excepciones', () => {
  assert.deepEqual(sedesParaTipo([], 'ingenieria'), []);
  assert.deepEqual(carrerasPara([], 'ingenieria', 'soyapango'), []);
  assert.deepEqual(tiposDisponibles([]), []);
});
