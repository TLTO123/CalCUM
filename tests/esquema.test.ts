import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esquemaPlan } from '../src/data/esquema.ts';
import type { Plan, RegistroNota, CumResult } from '../src/domain/tipos.ts';

const planValido = {
  carrera: 'Ingeniería en Ciencias de la Computación',
  sede: 'soyapango',
  tipo: 'ingenieria',
  planVersion: 'plan-2024',
  modalidad: 'Semipresencial',
  uvTotal: 161,
  materiasTotal: 40,
  ciclos: [
    {
      numero: 1,
      asignaturas: [
        {
          id: 'soyapango:ingenieria:plan-2024:CAD501',
          codigo: 'CAD501',
          nombre: 'Cálculo Diferencial',
          uv: 4,
          prerrequisito: null,
          electiva: false,
          laboratorio: false,
        },
        {
          id: 'soyapango:ingenieria:plan-2024:QUG501',
          codigo: 'QUG501',
          nombre: 'Química General',
          uv: 4,
          prerrequisito: 'Bachillerato',
          electiva: false,
          laboratorio: true,
        },
      ],
    },
  ],
};

test('el esquema acepta un plan válido (con prerrequisito y flags)', () => {
  const resultado = esquemaPlan.safeParse(planValido);
  assert.equal(resultado.success, true);
});

test('el esquema rechaza un plan con UV faltante en una asignatura', () => {
  const { uv, ...sinUv } = planValido.ciclos[0]!.asignaturas[0]!;
  void uv;
  const corrupto = {
    ...planValido,
    ciclos: [{ numero: 1, asignaturas: [sinUv] }],
  };
  const resultado = esquemaPlan.safeParse(corrupto);
  assert.equal(resultado.success, false);
});

test('el esquema rechaza un plan con sede desconocida', () => {
  const resultado = esquemaPlan.safeParse({ ...planValido, sede: 'centro' });
  assert.equal(resultado.success, false);
});

test('el esquema rechaza un plan sin ciclos ni totales', () => {
  const resultado = esquemaPlan.safeParse({ carrera: 'X' });
  assert.equal(resultado.success, false);
});

test('los tipos del dominio admiten registros de nota y resultados de C.U.M', () => {
  const registro: RegistroNota = { asignaturaId: 'soyapango:ingenieria:plan-2024:CAD501', nota: 7.5 };
  const vacio: CumResult = {
    cum: null,
    sumaUM: 0,
    sumaUV: 0,
    contadas: 0,
    aprobadas: 0,
    reprobadas: 0,
  };
  const plan: Plan = planValido as Plan;
  assert.equal(plan.sede, 'soyapango');
  assert.equal(registro.nota, 7.5);
  assert.equal(vacio.cum, null);
});
