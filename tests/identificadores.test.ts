// T6 (RF-11) — pipeline/identificadores.ts: ids de asignatura estables entre regeneraciones.
//
// Un id solo puede depender de campos que la UDB no reordena: sede, tipo, plan, nombre de la
// carrera, **ciclo** y código de la materia. Si el id llevara el índice de posición global,
// agregar una materia al principio del pensum desplazaría todos los demás y las notas guardadas
// por el estudiante quedarían asociadas a la materia equivocada (decisión D8 del plan).
//
// El ciclo entró en D8 porque el propio PDF oficial repite un código: `pensum_licenciatura_en_
// administracion.pdf` usa `EDN902` para «Estadística de Negocios» (ciclo 3) y para «Análisis e
// Interpretación de Estados Financieros» (ciclo 7). Con solo el código colisionaban y RF-11
// hubiera compartido las notas de una materia con la otra.
//
// Las electivas no tienen código (`-`): su bloque es `electiva-<orden>`, con el orden
// **dentro de su ciclo**, nunca un índice global; el ciclo ya va en su propio segmento.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { itemsDeDocumento } from '../pipeline/pdf.ts';
import { parsearItems, OPCIONES_VIRTUAL, type CicloCrudo, type OpcionesParseo } from '../pipeline/parsear.ts';
import {
  identificar,
  identificarCiclos,
  slugificar,
  type CicloConId,
  type MetaCarrera,
} from '../pipeline/identificadores.ts';

const PDF_PRESENCIAL = new URL(
  './fixtures/pensums/presencial-ciencias-computacion-plan-2024.pdf',
  import.meta.url,
);
const PDF_VIRTUAL = new URL(
  './fixtures/pensums/virtual-ciencias-computacion.pdf',
  import.meta.url,
);

const META_PRESENCIAL: MetaCarrera = {
  carrera: 'Ingeniería en Ciencias de la Computación',
  sede: 'soyapango',
  tipo: 'ingenieria',
  plan: 'plan-2024',
};
const META_VIRTUAL: MetaCarrera = {
  carrera: 'Ingeniería en Ciencias de la Computación (a distancia)',
  sede: 'virtual',
  tipo: 'ingenieria',
  plan: 'plan-2024',
};

/** "Corrida" = leer el PDF, parsearlo y derivar los ids, como lo haría `generar.ts`. */
async function correr(pdf: URL, meta: MetaCarrera, opciones?: OpcionesParseo): Promise<CicloConId[]> {
  const items = await itemsDeDocumento(new Uint8Array(await readFile(pdf)));
  return identificarCiclos(meta, parsearItems(items, opciones).ciclos);
}

const ids = (ciclos: CicloConId[]) => ciclos.flatMap((c) => c.asignaturas.map((a) => a.id));

const presencial = identificarCiclos(META_PRESENCIAL, parsearItems(
  await itemsDeDocumento(new Uint8Array(await readFile(PDF_PRESENCIAL))),
).ciclos);

test('T6: dos corridas sobre el mismo PDF producen exactamente los mismos ids (RF-12/RF-11)', async () => {
  const [a, b] = [await correr(PDF_PRESENCIAL, META_PRESENCIAL), await correr(PDF_PRESENCIAL, META_PRESENCIAL)];
  assert.deepEqual(ids(a), ids(b));
  assert.equal(ids(a).length, 40);
});

test('T6: el id tiene la forma sede:tipo:plan:slug:ciclo:código, sin acentos ni espacios', () => {
  const prefijo = 'soyapango:ingenieria:plan-2024:ingenieria-en-ciencias-de-la-computacion';
  for (const id of ids(presencial)) {
    assert.match(
      id,
      new RegExp(`^${prefijo}:([1-9]|10):([A-Z]{2,4}\\d{3}|electiva-\\d+)$`),
      `id con forma inesperada: ${id}`,
    );
    assert.equal(/[\sÁÉÍÓÚÜÑáéíóúüñ]/.test(id), false, `id con acentos o espacios: ${id}`);
  }
});

test('T6: los ids no contienen índices de posición global', () => {
  // Meter una materia nueva al frente del ciclo I desplaza todas las posiciones globales:
  // ningún id original puede cambiar.
  const nueva = {
    codigo: 'ZZZ999',
    nombre: 'Materia Nueva',
    uv: 4,
    ciclo: 1,
    correlativo: null,
    prerrequisito: null,
    laboratorio: false,
    electiva: false,
  };
  const conNueva = presencial.map((c, i) =>
    i === 0 ? { ...c, asignaturas: [nueva, ...c.asignaturas] } : c,
  );
  const originales = new Set(ids(presencial));
  const desplazados = new Set(ids(conNueva));
  for (const id of originales) {
    assert.ok(desplazados.has(id), `el id cambió al insertar una materia al principio: ${id}`);
  }
  assert.equal(desplazados.size, originales.size + 1);

  // Quitar el ciclo I completo tampoco afecta a los demás.
  const sinCicloI = presencial.slice(1);
  for (const id of ids(sinCicloI)) {
    assert.ok(originales.has(id), `el id cambió al eliminar el ciclo I: ${id}`);
  }
});

test('T6: el prefijo distingue sedes y tipos homónimos (D1 de la spec 001)', () => {
  const enAntiguoCuscatlan = identificar(
    { ...META_PRESENCIAL, sede: 'antiguo-cuscatlan' },
    'CAD501',
    1,
    1,
  );
  const enSoyapango = identificar(META_PRESENCIAL, 'CAD501', 1, 1);
  assert.notEqual(enAntiguoCuscatlan, enSoyapango);
  assert.ok(enAntiguoCuscatlan.startsWith('antiguo-cuscatlan:ingenieria:plan-2024:'));
  // Un tipo distinto con la misma carrera también se separa.
  assert.notEqual(
    identificar({ ...META_PRESENCIAL, tipo: 'tecnico' }, 'CAD501', 1, 1),
    enSoyapango,
  );
});

test('T6: las electivas sin código usan electiva-<orden> en su segmento de ciclo', async () => {
  const ciclo = await correr(PDF_VIRTUAL, META_VIRTUAL, OPCIONES_VIRTUAL);
  const porId = ciclo.flatMap((c) => c.asignaturas);
  const electivas = porId.filter((a) => a.codigo === '-');

  const prefijo = 'virtual:ingenieria:plan-2024:ingenieria-en-ciencias-de-la-computacion-a-distancia';
  assert.equal(electivas.length, 2);
  // Ambas son la 2ª materia de su ciclo: el orden es la posición **dentro del ciclo**,
  // no un índice del plan completo (Técnica Electiva I = 2ª de IX, II = 2ª de X).
  assert.deepEqual(electivas.map((e) => e.id), [
    `${prefijo}:9:electiva-2`,
    `${prefijo}:10:electiva-2`,
  ]);
  // Dos corridas seguidas dan el mismo orden (y por tanto el mismo id).
  const otra = ids(await correr(PDF_VIRTUAL, META_VIRTUAL, OPCIONES_VIRTUAL));
  assert.deepEqual(otra, ids(ciclo));
});

// El PDF oficial de Administración repite el código `EDN902` en dos materias distintas
// («Estadística de Negocios», ciclo 3, y «Análisis e Interpretación de Estados Financieros»,
// ciclo 7): verificado en el stream del PDF, es un error de la fuente, no de la extracción.
// Sin el segmento de ciclo ambas compartirían id y RF-11 mezclaría sus notas.
const PDF_VADM = new URL('./fixtures/pensums/virtual-administracion.pdf', import.meta.url);
const META_VADM: MetaCarrera = {
  carrera: 'Licenciatura en Administración de Empresas (a distancia)',
  sede: 'virtual',
  tipo: 'licenciatura',
  plan: 'plan-2024',
};

test('T6: un mismo código en dos ciclos no comparten id (D8 ampliado)', async () => {
  const av = await correr(PDF_VADM, META_VADM, OPCIONES_VIRTUAL);
  const prefijo = 'virtual:licenciatura:plan-2024:licenciatura-en-administracion-de-empresas-a-distancia';
  const todos = ids(av);

  assert.equal(todos.length, 44, `el multipágina dio ${todos.length} materias`);
  assert.equal(new Set(todos).size, todos.length, 'ids duplicados en el multipágina');

  const edn = todos.filter((id) => id.endsWith(':EDN902'));
  assert.deepEqual(edn, [`${prefijo}:3:EDN902`, `${prefijo}:7:EDN902`]);
});

test('T6: los ids no se repiten dentro de un plan', async () => {
  for (const [pdf, meta, opciones, total] of [
    [PDF_PRESENCIAL, META_PRESENCIAL, undefined, 40],
    [PDF_VIRTUAL, META_VIRTUAL, OPCIONES_VIRTUAL, 44],
  ] as const) {
    const propios = ids(await correr(pdf, meta, opciones));
    assert.equal(new Set(propios).size, total, `ids duplicados en ${meta.carrera}`);
  }
});

test('T6: slugificar deja minúsculas, sin acentos y sin separadores peligrosos', () => {
  assert.equal(
    slugificar('Ingeniería en Ciencias de la Computación (a distancia)'),
    'ingenieria-en-ciencias-de-la-computacion-a-distancia',
  );
  assert.equal(slugificar('Técnico en Ingeniería en Computación'), 'tecnico-en-ingenieria-en-computacion');
  assert.equal(slugificar('Antiguo Cuscatlán'), 'antiguo-cuscatlan');
  assert.equal(slugificar('plan-2024'), 'plan-2024');
  assert.equal(slugificar('  '), '', 'un slug vacío no puede partir el id');
  assert.equal(slugificar('a:b/c').includes(':'), false, 'el slug no puede contener `:`');
});
