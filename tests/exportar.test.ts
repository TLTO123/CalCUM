import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  envolverTexto,
  formatoFecha,
  nombreDeArchivo,
  prepararTarjeta,
} from '../src/domain/exportar.ts';
import type { Fecha, Tarjeta } from '../src/domain/exportar.ts';
import { calcularCum } from '../src/domain/cum.ts';
import type { CumResult, Plan, Sede } from '../src/domain/tipos.ts';

// Fecha fija: la lógica pura nunca llama a new Date() (P5, RF-9).
const HOY: Fecha = { dia: 7, mes: 10, anio: 2026 };

function planPrueba(sede: Sede = 'soyapango', materiasTotal = 43): Plan {
  return {
    carrera: 'Ingeniería en Ciencias de la Computación',
    sede,
    tipo: 'ingenieria',
    planVersion: 'plan-2024',
    modalidad: 'Semipresencial',
    uvTotal: 161,
    materiasTotal,
    ciclos: [
      {
        numero: 1,
        asignaturas: [
          { id: 'soyapango:ingenieria:plan-2024:QUG501', codigo: 'QUG501', nombre: 'Química General', uv: 4, prerrequisito: null, electiva: false, laboratorio: true },
        ],
      },
    ],
  };
}

function resultado(parcial: Partial<CumResult>): CumResult {
  return { cum: null, sumaUM: 0, sumaUV: 0, contadas: 0, aprobadas: 0, reprobadas: 0, ...parcial };
}

/** Medidor falso: 7 px por carácter (para no depender de la tipografía del sistema). */
const medidorFalso = (texto: string): number => texto.length * 7;

test('RF-1: valor a dos decimales, desglose ΣUM/ΣUV y conteo igual al del panel', () => {
  const t = prepararTarjeta(
    planPrueba(),
    resultado({ cum: 8.5, sumaUM: 1234, sumaUV: 145, contadas: 17, aprobadas: 14, reprobadas: 3 }),
    HOY,
  );
  assert.equal(t.etiqueta, 'Tu C.U.M');
  assert.equal(t.valor, '8.50');
  assert.equal(t.desglose, '1234 UM / 145 UV');
  assert.equal(t.conteo, '17 / 43 materias cursadas · 14 aprobadas · 3 reprobadas');
  assert.equal(t.progreso, 40); // 17/43 = 39.5 % → 40 %
});

test('RF-1/RF-10: sin materias cursadas => indicador vacío y desglose de estado vacío', () => {
  const t = prepararTarjeta(planPrueba(), resultado({}), HOY);
  assert.equal(t.valor, '—');
  assert.equal(t.desglose, 'Aún no has registrado ninguna materia.');
  assert.equal(t.conteo, '0 / 43 materias cursadas');
  assert.equal(t.progreso, 0);
});

test('RF-9: la tarjeta muestra lo mismo que el panel; no recalcula nada', () => {
  const plan = planPrueba();
  const registros = [{ asignaturaId: 'soyapango:ingenieria:plan-2024:QUG501', nota: 8.25 }];
  const r = calcularCum(plan, registros);
  const t = prepararTarjeta(plan, r, HOY);
  assert.equal(t.valor, r.cum?.toFixed(2));
  assert.equal(t.valor, '8.25');
  assert.equal(t.progreso, Math.round((r.contadas / plan.materiasTotal) * 100));
});

test('RF-2: la tarjeta identifica carrera, sede legible, plan y fecha', () => {
  const t = prepararTarjeta(planPrueba(), resultado({ cum: 9, contadas: 1, sumaUM: 4, sumaUV: 4, aprobadas: 1 }), HOY);
  assert.equal(t.carrera, 'Ingeniería en Ciencias de la Computación');
  assert.equal(t.sede, 'Campus Soyapango');
  assert.equal(t.plan, 'plan-2024');
  assert.deepEqual(t.fecha, HOY);
});

test('RF-2: las tres sedes tienen etiqueta legible (espejo del formulario)', () => {
  assert.equal(prepararTarjeta(planPrueba('soyapango'), resultado({}), HOY).sede, 'Campus Soyapango');
  assert.equal(
    prepararTarjeta(planPrueba('antiguo-cuscatlan'), resultado({}), HOY).sede,
    'Campus Antiguo Cuscatlán',
  );
  assert.equal(prepararTarjeta(planPrueba('virtual'), resultado({}), HOY).sede, 'UDB Virtual');
});

test('determinismo: dos corridas con el mismo hoy => tarjeta idéntica', () => {
  const plan = planPrueba();
  const r = resultado({ cum: 7.33, sumaUM: 88, sumaUV: 12, contadas: 3, aprobadas: 2, reprobadas: 1 });
  assert.deepEqual(prepararTarjeta(plan, r, HOY), prepararTarjeta(plan, r, { ...HOY }));
});

test('RNF-3: la tarjeta no arrastra datos personales ni campos de más', () => {
  const t = prepararTarjeta(planPrueba(), resultado({ cum: 8, contadas: 1, sumaUM: 4, sumaUV: 4, aprobadas: 1 }), HOY);
  assert.deepEqual(
    Object.keys(t).sort(),
    ['carrera', 'conteo', 'desglose', 'etiqueta', 'fecha', 'plan', 'progreso', 'sede', 'valor'],
  );
  const cadenas = Object.entries(t)
    .filter(([, v]) => typeof v === 'string')
    .map(([, v]) => v as string);
  for (const cadena of cadenas) assert.ok(!cadena.includes('@'), `dato sospechoso: ${cadena}`);
});

test('progreso acotado: nunca supera 100 % y nunca es NaN', () => {
  const lleno = prepararTarjeta(planPrueba('soyapango', 43), resultado({ contadas: 50 }), HOY);
  assert.equal(lleno.progreso, 100);
  const sinTotal = prepararTarjeta(planPrueba('soyapango', 0), resultado({}), HOY);
  assert.equal(sinTotal.progreso, 0);
  assert.ok(Number.isFinite(sinTotal.progreso));
});

test('formatoFecha: relleno de ceros (07/10/2026)', () => {
  assert.equal(formatoFecha({ dia: 7, mes: 10, anio: 2026 }), '07/10/2026');
  assert.equal(formatoFecha({ dia: 5, mes: 1, anio: 2026 }), '05/01/2026');
});

test('nombreDeArchivo: minúsculas, sin acentos ni símbolos, con fecha ISO', () => {
  const t = prepararTarjeta(planPrueba(), resultado({}), HOY);
  assert.equal(
    nombreDeArchivo(t),
    'calcum-ingenieria-en-ciencias-de-la-computacion-2026-10-07.png',
  );
});

test('nombreDeArchivo: un nombre con ñ, acentos y puntos queda legible', () => {
  const plan = planPrueba();
  plan.carrera = 'Lic. en Idiomas con Especialidad en Lenguas Extranjeras';
  const nombre = nombreDeArchivo(prepararTarjeta(plan, resultado({}), HOY));
  assert.equal(nombre, 'calcum-lic-en-idiomas-con-especialidad-en-lenguas-extranjeras-2026-10-07.png');
  assert.ok(!/[A-ZÁÉÍÓÚÑ]/.test(nombre), 'sin mayúscutas ni letras acentuadas');
  assert.ok(!/[^a-z0-9.\-]/.test(nombre), 'solo minúsculas, dígitos, punto y guion');
});

test('envolverTexto: texto corto => una línea idéntica', () => {
  assert.deepEqual(envolverTexto('C.U.M', 100, medidorFalso), ['C.U.M']);
});

test('envolverTexto: nombre largo partido en varias líneas, ninguna sobre el ancho', () => {
  const nombre = 'Lic. en Idiomas con Especialidad en Lenguas Extranjeras';
  const anchoMax = 100; // = 14 caracteres con el medidor falso
  const lineas = envolverTexto(nombre, anchoMax, medidorFalso);
  assert.ok(lineas.length > 1, 'el nombre largo debe partirse en varias líneas');
  for (const linea of lineas) {
    assert.ok(medidorFalso(linea) <= anchoMax, `línea sobre el ancho: "${linea}"`);
  }
  // Ninguna palabra se pierde ni se reordena.
  assert.equal(lineas.join(' ').replace(/\s+/g, ' '), nombre);
});

test('envolverTexto: una sola palabra más larga que el ancho se parte por caracteres', () => {
  const palabra = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const anchoMax = medidorFalso('ABC'); // cabe exactamente 3 caracteres
  const lineas = envolverTexto(palabra, anchoMax, medidorFalso);
  assert.ok(lineas.length > 1);
  for (const linea of lineas) assert.ok(medidorFalso(linea) <= anchoMax);
  assert.equal(lineas.join(''), palabra);
});

test('envolverTexto: respeta los saltos de línea explícitos', () => {
  assert.deepEqual(envolverTexto('Una\nDos', 100, medidorFalso), ['Una', 'Dos']);
});
