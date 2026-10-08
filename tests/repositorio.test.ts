import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cargarPlanes,
  claveDePlan,
  planesIniciales,
  indicePorClave,
} from '../src/data/repositorio.ts';
import muestra from './fixtures/planes-muestra.json' with { type: 'json' };
import type { Plan } from '../src/domain/tipos.ts';

// Carreras homónimas con UV distintas: presencial 161 vs virtual 176 (AGENTS.md).
const planComputacion = {
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
        { id: 'soyapango:ingenieria:plan-2024:CAD501', codigo: 'CAD501', nombre: 'Cálculo Diferencial', uv: 4, prerrequisito: null, electiva: false, laboratorio: false },
      ],
    },
  ],
};

const planComputacionVirtual = {
  ...planComputacion,
  sede: 'virtual',
  modalidad: 'Distancia',
  uvTotal: 176,
  materiasTotal: 44,
  ciclos: [
    {
      numero: 1,
      asignaturas: [
        { id: 'virtual:ingenieria:plan-2024:CAD501', codigo: 'CAD501', nombre: 'Cálculo Diferencial', uv: 4, prerrequisito: null, electiva: false, laboratorio: false },
      ],
    },
  ],
};

test('cargarPlanes valida y devuelve los planes del dataset', () => {
  const planes = cargarPlanes([planComputacion, planComputacionVirtual]);
  assert.equal(planes.length, 2);
  assert.equal(planes[0]!.uvTotal, 161);
  assert.equal(planes[1]!.uvTotal, 176);
});

test('un JSON corrupto (UV faltante) FALLA RUIDOSAMENTE con error de validación', () => {
  const { uvTotal, ...sinTotales } = planComputacion;
  void uvTotal;
  assert.throws(() => cargarPlanes([sinTotales]), /uvTotal/i);
});

test('un plan con sede desconocida también lanza (nunca pasar en silencio)', () => {
  assert.throws(() => cargarPlanes([{ ...planComputacion, sede: 'centro' }]));
});

test('datos no-array (null, objeto suelto) lanzan', () => {
  assert.throws(() => cargarPlanes(null));
  assert.throws(() => cargarPlanes({ planes: [] }));
});

test('RF-4: la clave es (tipo, sede, planVersion, nombre) y separa homónimos por sede', () => {
  const planes = cargarPlanes([planComputacion, planComputacionVirtual]);
  const indice = indicePorClave(planes);
  assert.equal(indice.size, 2); // homónimos NO colisionan
  assert.equal(
    claveDePlan(planComputacion),
    'ingenieria|soyapango|plan-2024|Ingeniería en Ciencias de la Computación',
  );
  assert.equal(
    claveDePlan(planComputacionVirtual),
    'ingenieria|virtual|plan-2024|Ingeniería en Ciencias de la Computación',
  );
  assert.equal(indice.get(claveDePlan(planComputacion))!.uvTotal, 161);
  assert.equal(indice.get(claveDePlan(planComputacionVirtual))!.uvTotal, 176);
});

test('RF-4: con el mismo tipo, sede y plan, solo el nombre evita la colisión', () => {
  // 8 ingenierías de Soyapango comparten `ingenieria|soyapango|plan-2024` en la oferta real;
  // sin el nombre en la clave, las dos primeras serían indistinguibles y se perderían notas.
  const otra = { ...planComputacion, carrera: 'Ingeniería Biomédica', uvTotal: 164 };
  const indice = indicePorClave(cargarPlanes([planComputacion, otra]));
  assert.equal(indice.size, 2);
  assert.equal(indice.get(claveDePlan(planComputacion))!.carrera, planComputacion.carrera);
  assert.equal(indice.get(claveDePlan(otra))!.carrera, 'Ingeniería Biomédica');
});

test('T9: el fixture de muestra de la spec 001 sigue validando en tests/fixtures', () => {
  const planes = cargarPlanes(muestra.planes);
  assert.ok(planes.length > 0);
  assert.equal(indicePorClave(planes).size, planes.length, 'ninguna clave repetida');
});

test('planesIniciales entrega un dataset no vacío y ya validado', () => {
  const planes = planesIniciales();
  assert.ok(planes.length > 0);
  for (const plan of planes) {
    assert.ok(plan.ciclos.length > 0);
    assert.ok(plan.uvTotal > 0);
  }
  // Los homónimos presencial/virtual deben existir y diferir en UV (realidad UDB).
  const computaciones = planes.filter((p: Plan) => p.carrera.includes('Ciencias de la Computación'));
  assert.ok(computaciones.length >= 2);
  const uvs = new Set(computaciones.map((p: Plan) => p.uvTotal));
  assert.ok(uvs.size >= 2);
});
