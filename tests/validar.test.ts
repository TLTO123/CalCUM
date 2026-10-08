// T7 (RF-2, RF-3, RF-4, RF-10, RF-13) — pipeline/validar.ts: triangulación de totales y
// parada total.
//
// Tres fuentes deben decir lo mismo antes de publicar:
//   sitio (manifiesto) ↔ encabezado del PDF ↔ suma de las filas extraídas.
// Si alguna difiere, hay error **con los tres valores y la carrera exacta** (RF-2/RF-3) y
// `publicable` pasa a false: nunca se entrega un dataset parcial (RF-13, D2).
// Las advertencias (prerrequisito huérfano, plantilla sin encabezado…) registran y siguen.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validar, publicable, type PendienteValidacion } from '../pipeline/validar.ts';
import type { Plan } from '../src/domain/tipos.ts';
import type { Totales } from '../pipeline/parsear.ts';

const PLAN_BASE: Plan = {
  carrera: 'Ingeniería de Prueba',
  sede: 'soyapango',
  tipo: 'ingenieria',
  planVersion: 'plan-2099',
  modalidad: 'Semipresencial',
  uvTotal: 12, // lo que declara el sitio (manifiesto)
  materiasTotal: 3,
  ciclos: [
    {
      numero: 1,
      asignaturas: [
        { id: 'soyapango:ingenieria:plan-2099:ingenieria-de-prueba:AAA101', codigo: 'AAA101', nombre: 'Materia Uno', uv: 4, prerrequisito: null, electiva: false, laboratorio: false },
        { id: 'soyapango:ingenieria:plan-2099:ingenieria-de-prueba:AAA102', codigo: 'AAA102', nombre: 'Materia Dos', uv: 4, prerrequisito: 'AAA101', electiva: false, laboratorio: false },
        { id: 'soyapango:ingenieria:plan-2099:ingenieria-de-prueba:electiva-1-3', codigo: '-', nombre: 'Electiva de Prueba', uv: 4, prerrequisito: null, electiva: true, laboratorio: false },
      ],
    },
  ],
};

/** Un pendiente "sano": las 3 fuentes coinciden y no hay advertencias. */
function sano(sobrescribir: {
  plan?: Partial<Plan>;
  totales?: Partial<Totales>;
  advertencias?: string[];
} = {}): PendienteValidacion {
  const plan: Plan = { ...PLAN_BASE, ...sobrescribir.plan };
  const totales: Totales = {
    uvEncabezado: plan.uvTotal,
    materiasEncabezado: plan.materiasTotal,
    uvSuma: plan.uvTotal,
    materiasConteo: plan.materiasTotal,
    ...sobrescribir.totales,
  };
  return { plan, totales, advertencias: sobrescribir.advertencias ?? [] };
}

test('T7: triangulación completa sin diferencias ⇒ sin errores y publicable', () => {
  const r = validar([sano()]);
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.advertencias, []);
  assert.equal(publicable(r), true);
});

test('T7: ΣUV descuadrada ⇒ error con la carrera y los 3 valores (RF-2)', () => {
  const r = validar([
    sano({ totales: { uvEncabezado: 13, uvSuma: 11 } }), // sitio=12, encabezado=13, filas=11
  ]);
  assert.equal(r.errores.length, 1, JSON.stringify(r.errores.map((e) => e.message)));
  const mensaje = r.errores[0]!.message;
  assert.match(mensaje, /Ingeniería de Prueba/, 'el error debe señalar la carrera exacta');
  assert.match(mensaje, /sitio=12/);
  assert.match(mensaje, /encabezado=13/);
  assert.match(mensaje, /filas=11/);
  assert.match(mensaje, /diferencia 2\b/, 'debe reportar la diferencia (máx−mín)');
  assert.equal(publicable(r), false, 'un descuadre de UV impide publicar (RF-13)');
});

test('T7: nº de materias descuadrado ⇒ error con los 3 valores (RF-3)', () => {
  const r = validar([
    sano({ totales: { materiasEncabezado: 4, materiasConteo: 3, uvSuma: 12, uvEncabezado: 12 } }),
  ]);
  assert.equal(r.errores.length, 1, JSON.stringify(r.errores.map((e) => e.message)));
  const mensaje = r.errores[0]!.message;
  assert.match(mensaje, /Ingeniería de Prueba/);
  assert.match(mensaje, /sitio=3/);
  assert.match(mensaje, /encabezado=4/);
  assert.match(mensaje, /filas=3/);
  assert.equal(publicable(r), false);
});

test('T7: sin encabezado (plantilla virtual) ⇒ advertencia, no error', () => {
  const r = validar([sano({ totales: { uvEncabezado: null, materiasEncabezado: null } })]);
  assert.deepEqual(r.errores, [], 'sitio y filas coinciden: el encabezado ausente no bloquea');
  assert.equal(r.advertencias.length, 1);
  assert.match(r.advertencias[0]!, /encabezado/);
  assert.match(r.advertencias[0]!, /Ingeniería de Prueba/);
  assert.equal(publicable(r), true);
});

test('T7: las advertencias del parseo pasan al resultado sin bloquear (RF-10)', () => {
  const r = validar([
    sano({ advertencias: ['Ingeniería de Prueba: prerrequisito 99 sin asignatura, se publica vacío'] }),
  ]);
  assert.deepEqual(r.errores, []);
  assert.equal(r.advertencias.length, 1);
  assert.match(r.advertencias[0]!, /99/);
  assert.equal(publicable(r), true, 'una advertencia nunca detiene la publicación');
});

// --- excepción RF-2 aprobada (decisión del usuario, 2026-10-05) --------------------------
//
// La grilla del PDF oficial de Ingeniería Eléctrica suma 163 UV en sus 40 materias mientras
// que la cabecera del PDF y el sitio publican 162. No hay celda contradictoria en todo el
// corpus, así que la discrepancia está en la fuente. Se aprobó publicar la suma real de la
// grilla (163 UV, la que alimenta el cálculo) y documentar la diferencia como **única**
// excepción explícita a RF-2. Cualquier otra tripleta —misma carrera o mismos números en otra—
// sigue bloqueando.

const ELECTRICA: Plan = {
  ...PLAN_BASE,
  carrera: 'Ingeniería Eléctrica',
  sede: 'soyapango',
  tipo: 'ingenieria',
  planVersion: 'plan-2024',
  uvTotal: 162, // lo que declara el sitio
  materiasTotal: 40,
};

function electrica(totales: Partial<Totales>): PendienteValidacion {
  return {
    plan: ELECTRICA,
    totales: {
      uvEncabezado: 162,
      materiasEncabezado: 40,
      uvSuma: 163,
      materiasConteo: 40,
      ...totales,
    },
    advertencias: [],
  };
}

test('T7: la excepción RF-2 aprobada no bloquea y queda registrada (RF-13 con excepción)', () => {
  const r = validar([electrica({})]);
  assert.deepEqual(r.errores, [], JSON.stringify(r.errores.map((e) => e.message)));
  assert.equal(publicable(r), true, 'la excepción aprobada publica (RF-1)');
  assert.equal(r.excepciones.length, 1, 'la discrepancia debe quedar registrada');

  const ex = r.excepciones[0]!;
  assert.equal(ex.clave, 'ingenieria|soyapango|plan-2024|Ingeniería Eléctrica');
  assert.equal(ex.concepto, 'UV');
  assert.equal(ex.sitio, 162);
  assert.equal(ex.encabezado, 162);
  assert.equal(ex.filas, 163);
  assert.equal(ex.publicado, 163, 'se publica la suma real de la grilla');
  assert.match(ex.motivo, /aprob/i, 'la excepción debe llevar su motivación');

  // No desaparece: la discrepancia queda visible con sus tres valores, no silenciada.
  assert.deepEqual(r.advertencias, [], 'no se duplica como advertencia (el reporte la lista aparte)');
  assert.match(ex.clave, /Ingeniería Eléctrica/);
  assert.match(ex.motivo, /162/, 'la motivación debe citar los valores en disputa');
  assert.match(ex.motivo, /163/);
});

test('T7: la excepción solo cubre su tripleta exacta; lo demás sigue bloqueando', () => {
  // Misma carrera, otra diferencia en las filas ⇒ error.
  const distinta = validar([electrica({ uvSuma: 164 })]);
  assert.equal(distinta.excepciones.length, 0);
  assert.equal(distinta.errores.length, 1, JSON.stringify(distinta.errores.map((e) => e.message)));
  assert.equal(publicable(distinta), false);

  // Mismos números, otra carrera ⇒ error (la excepción no es un patrón general).
  const otraCarrera = validar([
    { ...electrica({}), plan: { ...ELECTRICA, carrera: 'Ingeniería Eléctrica Virtual' } },
  ]);
  assert.equal(otraCarrera.excepciones.length, 0);
  assert.equal(otraCarrera.errores.length, 1);
  assert.equal(publicable(otraCarrera), false);

  // Otra discrepancia del mismo tipo de carrera sin excepción ⇒ error (regresión de RF-2).
  const sinExcepcion = validar([sano({ totales: { uvEncabezado: 13, uvSuma: 11 } })]);
  assert.equal(sinExcepcion.errores.length, 1);
  assert.equal(sinExcepcion.excepciones.length, 0);
});

test('T7: dos planes con la misma clave (tipo, sede, plan, nombre) ⇒ error (RF-4)', () => {
  const r = validar([sano(), sano()]);
  assert.equal(r.errores.length, 1, JSON.stringify(r.errores.map((e) => e.message)));
  assert.match(r.errores[0]!.message, /duplicada/i);
  assert.match(r.errores[0]!.message, /Ingeniería de Prueba/);
  assert.equal(publicable(r), false);

  // Homónimos en otra sede no colisionan.
  const otraSede = sano({ plan: { sede: 'antiguo-cuscatlan' } });
  assert.deepEqual(validar([sano(), otraSede]).errores, []);
  // Otro plan de la misma carrera tampoco.
  const otroPlan = sano({ plan: { planVersion: 'plan-2100' } });
  assert.deepEqual(validar([sano(), otroPlan]).errores, []);
});

test('T7: dos asignaturas con el mismo id dentro de un plan ⇒ error (RF-11/RF-13)', () => {
  const conIdRepetido = sano({
    plan: {
      ciclos: [
        {
          numero: 1,
          asignaturas: [
            PLAN_BASE.ciclos[0]!.asignaturas[0]!,
            { ...PLAN_BASE.ciclos[0]!.asignaturas[1]!, id: PLAN_BASE.ciclos[0]!.asignaturas[0]!.id },
            PLAN_BASE.ciclos[0]!.asignaturas[2]!,
          ],
        },
      ],
    },
  });
  const r = validar([conIdRepetido]);
  assert.equal(r.errores.length, 1, JSON.stringify(r.errores.map((e) => e.message)));
  assert.match(r.errores[0]!.message, /AAA101/);
  assert.match(r.errores[0]!.message, /Ingeniería de Prueba/);
  assert.equal(publicable(r), false);
});

test('T7: los errores se acumulan entre planes y todos impiden publicar (RF-13)', () => {
  const maloA = sano({ plan: { carrera: 'Carrera Mala A' }, totales: { uvSuma: 11 } });
  const maloB = sano({ plan: { carrera: 'Carrera Mala B' }, totales: { materiasConteo: 2 } });
  const sanoC = sano({ plan: { carrera: 'Carrera Buena C' } });
  const r = validar([maloA, maloB, sanoC]);
  assert.equal(r.errores.length, 2, JSON.stringify(r.errores.map((e) => e.message)));
  assert.match(r.errores[0]!.message, /Carrera Mala A/);
  assert.match(r.errores[1]!.message, /Carrera Mala B/);
  assert.equal(publicable(r), false, 'un solo error basta para detener toda la publicación');
});
