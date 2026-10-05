import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularCum } from '../src/domain/cum.ts';
import type { Plan, RegistroNota } from '../src/domain/tipos.ts';

// Plan mínimo de prueba: 3 asignaturas con UV distintas (4, 6, 2).
function planPrueba(): Plan {
  return {
    carrera: 'Carrera de prueba',
    sede: 'soyapango',
    tipo: 'ingenieria',
    planVersion: 'plan-2024',
    modalidad: 'Semipresencial',
    uvTotal: 12,
    materiasTotal: 3,
    ciclos: [
      {
        numero: 1,
        asignaturas: [
          { id: 'a1', codigo: 'A1', nombre: 'Asignatura Uno', uv: 4, prerrequisito: null, electiva: false, laboratorio: false },
          { id: 'a2', codigo: 'A2', nombre: 'Asignatura Dos', uv: 6, prerrequisito: null, electiva: false, laboratorio: true },
        ],
      },
      {
        numero: 2,
        asignaturas: [
          { id: 'a3', codigo: 'A3', nombre: 'Asignatura Tres', uv: 2, prerrequisito: null, electiva: false, laboratorio: false },
        ],
      },
    ],
  };
}

const reg = (asignaturaId: string, nota: number): RegistroNota => ({ asignaturaId, nota });

test('RF-10: 0 materias cursadas => indicador vacío (null), sin división entre cero', () => {
  const r = calcularCum(planPrueba(), []);
  assert.equal(r.cum, null);
  assert.equal(r.sumaUM, 0);
  assert.equal(r.sumaUV, 0);
  assert.equal(r.contadas, 0);
  assert.equal(r.aprobadas, 0);
  assert.equal(r.reprobadas, 0);
});

test('una materia: U.M = nota × UV y C.U.M = U.M / UV', () => {
  const r = calcularCum(planPrueba(), [reg('a1', 8)]); // 8×4=32; 32/4=8
  assert.equal(r.sumaUM, 32);
  assert.equal(r.sumaUV, 4);
  assert.equal(r.cum, 8);
  assert.equal(r.contadas, 1);
});

test('varias materias: promedio ponderado por UV', () => {
  // a1: 8×4=32 | a2: 9×6=54 | a3: 5×2=10 => 96 / 12 = 8
  const r = calcularCum(planPrueba(), [reg('a1', 8), reg('a2', 9), reg('a3', 5)]);
  assert.equal(r.sumaUM, 96);
  assert.equal(r.sumaUV, 12);
  assert.equal(r.cum, 8);
  assert.equal(r.contadas, 3);
});

test('RF-9: redondea a 2 decimales', () => {
  // a1: 7×4=28 | a3: 8×2=16 => 44 / 6 = 7.3333…
  const r = calcularCum(planPrueba(), [reg('a1', 7), reg('a3', 8)]);
  assert.equal(r.cum, 7.33);
});

test('decimales en la nota participan tal cual (7.5 y 8.25)', () => {
  // a1: 7.5×4=30 | a2: 8.25×6=49.5 => 79.5 / 10 = 7.95
  const r = calcularCum(planPrueba(), [reg('a1', 7.5), reg('a2', 8.25)]);
  assert.equal(r.sumaUM, 79.5);
  assert.equal(r.cum, 7.95);
});

test('bordes de escala: notas 1 y 10 son válidas y participan', () => {
  // a1: 1×4=4 | a2: 10×6=60 => 64 / 10 = 6.4
  const r = calcularCum(planPrueba(), [reg('a1', 1), reg('a2', 10)]);
  assert.equal(r.sumaUM, 64);
  assert.equal(r.sumaUV, 10);
  assert.equal(r.cum, 6.4);
});

test('P1/repitencia: una materia repetida cuenta UNA sola vez con su ÚLTIMA nota', () => {
  const plan = planPrueba();
  const intentos: RegistroNota[] = [reg('a1', 4), reg('a1', 9)]; // dos intentos
  const r = calcularCum(plan, intentos);
  assert.equal(r.contadas, 1); // una sola vez
  assert.equal(r.sumaUV, 4); // sus UV entran UNA vez
  assert.equal(r.sumaUM, 36); // última nota (9), no la primera
  assert.equal(r.cum, 9);
});

test('repitencia: "última nota" = la del final del arreglo recibido', () => {
  const plan = planPrueba();
  const r1 = calcularCum(plan, [reg('a2', 6), reg('a2', 10)]);
  const r2 = calcularCum(plan, [reg('a2', 10), reg('a2', 6)]);
  // "Última" se define por el orden del arreglo recibido.
  assert.equal(r1.sumaUM, 60);
  assert.equal(r2.sumaUM, 36);
});

test('RF-14: nota ≥ 6 cuenta como aprobada, < 6 como reprobada', () => {
  const r = calcularCum(planPrueba(), [reg('a1', 6), reg('a2', 5.99), reg('a3', 10)]);
  assert.equal(r.aprobadas, 2); // a1=6, a3=10
  assert.equal(r.reprobadas, 1); // a2=5.99
  assert.equal(r.contadas, 3);
});

test('RF-14: el indicador NO altera la fórmula (reprobadas entran al cálculo)', () => {
  // a2 reprobada con 5.99 => sigue en el denominador: (7×4 + 5.99×6) / 10 = 63.94/10 = 6.39
  const r = calcularCum(planPrueba(), [reg('a1', 7), reg('a2', 5.99)]);
  assert.equal(r.sumaUV, 10);
  assert.equal(r.cum, 6.39);
  assert.equal(r.reprobadas, 1);
});

test('el denominador incluye TODAS las cursadas, aprobadas y reprobadas (P1)', () => {
  // a2 reprobada con nota 2: (8×4 + 2×6) / 10 = 44/10 = 4.4
  const r = calcularCum(planPrueba(), [reg('a1', 8), reg('a2', 2)]);
  assert.equal(r.sumaUV, 10); // la reprobada SÍ está en el denominador
  assert.equal(r.cum, 4.4);
});

test('id desconocido => lanza (fallar ruidoso, P2)', () => {
  assert.throws(() => calcularCum(planPrueba(), [reg('no-existe', 8)]));
});

test('plan sin ciclos no revienta: behave como 0 materias', () => {
  const vacio: Plan = { ...planPrueba(), ciclos: [] };
  const r = calcularCum(vacio, []);
  assert.equal(r.cum, null);
});
