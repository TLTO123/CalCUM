// T4 + T5 (RF-8, RF-9, RF-10, RF-12, RNF-1) — pipeline/parsear.ts: reconstrucción de filas
// por layout sobre las dos plantillas reales (presencial y virtual).
// Contra el PDF presencial: encabezado, títulos CICLO I…X, filas → código/nombre/UV,
// y los totales cuadran con el encabezado (triangulación en miniatura; RF-2/RF-3 en T7).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { itemsDeDocumento } from '../pipeline/pdf.ts';
import {
  hayRotulosDeCiclo,
  parsearItems,
  OPCIONES_OCR,
  OPCIONES_VIRTUAL,
  type ResultadoParseo,
} from '../pipeline/parsear.ts';

const PDF_PRESENCIAL = new URL(
  './fixtures/pensums/presencial-ciencias-computacion-plan-2024.pdf',
  import.meta.url,
);

const items = await itemsDeDocumento(new Uint8Array(await readFile(PDF_PRESENCIAL)));
const resultado = parsearItems(items);

test('T4: detecta en el documento los totales oficiales del encabezado', () => {
  assert.equal(resultado.totales.uvEncabezado, 161);
  assert.equal(resultado.totales.materiasEncabezado, 40);
});

test('T4: localiza los 10 títulos CICLO I…X y agrupa por región', () => {
  assert.equal(resultado.ciclos.length, 10, `ciclos detectados: ${resultado.ciclos.length}`);
  assert.deepEqual(
    resultado.ciclos.map((c) => c.numero),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
});

test('T4: reconstruye la fila → código, nombre, UV, ciclo y prerrequisito (RF-8)', () => {
  const buscar = (codigo: string) =>
    resultado.ciclos.flatMap((c) => c.asignaturas).find((a) => a.codigo === codigo);

  const cad = buscar('CAD501');
  assert.ok(cad, 'no se encontró CAD501');
  assert.equal(cad.ciclo, 1);
  assert.equal(cad.nombre, 'Cálculo Diferencial', 'el nombre salió mal (¿columna equivocada?)');
  assert.equal(cad.uv, 4);
  assert.equal(cad.prerrequisito, null); // RF-10 (T5): 'Bachillerato' no es prerrequisito

  const pre = buscar('PRE104');
  assert.ok(pre, 'no se encontró PRE104');
  assert.equal(pre.ciclo, 1);
  assert.equal(pre.nombre, 'Programación Estructurada');
  assert.equal(pre.uv, 4);

  const cvv = buscar('CVV501');
  assert.ok(cvv, 'no se encontró CVV501');
  assert.equal(cvv.ciclo, 3);
  assert.equal(cvv.nombre, 'Cálculo de Varias Variables');
  assert.equal(cvv.prerrequisito, 'CAI501'); // RF-10 (T5): el correlativo 6 se resuelve a su código
});

test('T4: ΣUV y nº de materias extraídos coinciden con el encabezado', () => {
  assert.equal(resultado.totales.uvSuma, resultado.totales.uvEncabezado);
  assert.equal(resultado.totales.materiasConteo, resultado.totales.materiasEncabezado);
  assert.equal(resultado.totales.materiasConteo, 40);
});

// --- T5 (RF-9, RF-10): casos especiales y plantilla virtual ------------

const PDF_VIRTUAL = new URL(
  './fixtures/pensums/virtual-ciencias-computacion.pdf',
  import.meta.url,
);

const itemsVirtual = await itemsDeDocumento(new Uint8Array(await readFile(PDF_VIRTUAL)));
const virtual = parsearItems(itemsVirtual, OPCIONES_VIRTUAL);

test('T5: la plantilla virtual produce las 44 materias / 176 UV de su grilla', () => {
  assert.equal(virtual.totales.materiasConteo, 44);
  assert.equal(virtual.totales.uvSuma, 176);
  assert.deepEqual(
    virtual.ciclos.map((c) => c.numero),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  // Esta plantilla no publica los totales en el encabezado (solo dice "Unidades Valorativas").
  assert.equal(virtual.totales.uvEncabezado, null);
  assert.equal(virtual.totales.materiasEncabezado, null);
  // Ningún correlativo se pierde: los 44 salen en orden (los ciclos VIII/X tenían
  // su correlativo a +14.02 pt y caían fuera del rango por redondeo).
  assert.deepEqual(
    virtual.ciclos.flatMap((c) => c.asignaturas).map((a) => a.correlativo),
    Array.from({ length: 44 }, (_, i) => i + 1),
  );
});

test('T5: las electivas sin código salen con `-` y `electiva: true`, con sus UV intactas', () => {
  const sinCodigo = virtual.ciclos.flatMap((c) => c.asignaturas).filter((a) => a.codigo === '-');
  assert.deepEqual(
    sinCodigo.map((a) => [a.ciclo, a.correlativo, a.nombre, a.uv, a.electiva]),
    [
      [9, 38, 'Técnica Electiva I', 4, true],
      [10, 42, 'Técnica Electiva II', 4, true],
    ],
  );
  // La sección "Técnicas Electivas" con código (SSI941, STI941…) no se publica.
  const codigos = new Set(virtual.ciclos.flatMap((c) => c.asignaturas).map((a) => a.codigo));
  for (const descartada of ['SSI941', 'STI941', 'SGC941', 'SIN941', 'SNC941', 'SGA941']) {
    assert.equal(codigos.has(descartada), false, `${descartada} no debería publicarse`);
  }
});

// --- marcadores `•` (prácticas de laboratorio) y `*` (nota al pie) ------
//
// El PDF presencial trae 29 `•`: 1 es la leyenda del pie (`• Asignaturas con
// Prácticas de Laboratorio`), 2 acompañan a "Robótica"/"Aplicada a la Salud"
// (fuera de la grilla de 40) y los 25 restantes marcan materias publicadas.

test('T5: el `•` marca laboratorio, el `*` solo se estripa del nombre', () => {
  const presenciales = resultado.ciclos.flatMap((c) => c.asignaturas);
  const enLaboratorio = presenciales.filter((a) => a.laboratorio);
  assert.equal(enLaboratorio.length, 25);

  // Marca con solo `*` (sin `•`): no es laboratorio.
  const soloAsterisco = presenciales.find((a) => a.nombre === 'Cálculo Integral');
  assert.equal(soloAsterisco?.laboratorio, false);

  for (const a of presenciales) {
    assert.equal(/[*•]/.test(a.nombre), false, `${a.codigo} conserva marcadores`);
  }

  const virtuales = virtual.ciclos.flatMap((c) => c.asignaturas);
  assert.equal(virtuales.filter((a) => a.laboratorio).length, 0); // sin `•` en esta plantilla
  for (const a of virtuales) {
    // El virtual marca sus electivas con `**` en la fila del prerrequisito.
    assert.equal(/[*•]/.test(a.nombre), false, `${a.codigo} conserva marcadores`);
  }
});

// --- prerrequisito publicado como código (RF-10) -------------------------

test('T5: el prerrequisito sale como código y `Bachillerato` queda vacío', () => {
  const indice = (r: ResultadoParseo) =>
    new Map(r.ciclos.flatMap((c) => c.asignaturas).map((a) => [a.codigo, a]));

  const p = indice(resultado);
  assert.equal(p.get('CAD501')?.prerrequisito, null); // Bachillerato
  assert.equal(p.get('CVV501')?.prerrequisito, 'CAI501'); // correlativo 6
  assert.equal(p.get('EYM501')?.prerrequisito, 'CDP501'); // correlativo 10
  assert.equal(p.get('-')?.prerrequisito, null); // electiva: `-` no es requisito

  const v = indice(virtual);
  assert.equal(v.get('CAD941')?.prerrequisito, null); // Bachillerato
  assert.equal(v.get('CAI941')?.prerrequisito, 'CAD941'); // correlativo 1
  assert.equal(v.get('CVV941')?.prerrequisito, 'AVM941, CAI941'); // 5, 6
  assert.equal(v.get('EYM941')?.prerrequisito, 'QUG941, CAI941, CDP941'); // 2, 6, 7
  // Las dos Técnica Electiva usan `**`: sin prerrequisito y sin advertencia.
  const electivas = virtual.ciclos.flatMap((c) => c.asignaturas).filter((a) => a.codigo === '-');
  assert.deepEqual(electivas.map((a) => a.prerrequisito), [null, null]);
  assert.deepEqual(virtual.advertencias, []);
});

test('T5: un prerrequisito huérfano deja advertencia y sale vacío (RF-10)', () => {
  const i = (str: string, x: number, y: number) => ({ str, x, y, width: 20 });
  const sintetico = [
    i('CICLO I', 100, 500),
    i('1', 95, 470),
    i('AAA111', 125, 470),
    i('Materia de Prueba', 90, 460),
    i('99', 85, 450), // correlativo inexistente
    i('4', 130, 450),
  ];
  const r = parsearItems(sintetico);
  assert.equal(r.ciclos[0]!.asignaturas[0]!.prerrequisito, null);
  assert.equal(r.advertencias.length, 1, JSON.stringify(r.advertencias));
  assert.match(r.advertencias[0]!, /99/);
});

// --- comprobaciones cruzadas de las dos plantillas ------------------------

test('T5: el PDF virtual reconstruye nombres completos, como el presencial', () => {
  const porCorrelativo = new Map(
    virtual.ciclos.flatMap((c) => c.asignaturas).map((a) => [a.correlativo, a]),
  );
  assert.equal(porCorrelativo.get(1)?.nombre, 'Cálculo Diferencial');
  assert.equal(porCorrelativo.get(3)?.nombre, 'Expresión Oral y Escrita');
  assert.equal(porCorrelativo.get(10)?.nombre, 'Cálculo de Varias Variables');
  assert.equal(
    porCorrelativo.get(40)?.nombre,
    'Administración e Implementación de Servicios de Red con Sistemas Operativos Propietarios',
  );
});

// --- T8: tercera plantilla real: los Técnicos de pregrado -------------------
//
// Mismo esqueleto que el presencial (rótulos CICLO I…, correlativo/código/nombre/UV), pero la
// UV cae a +46..48 pt del rótulo en vez de +28..36, y este documento **no** publica los totales
// en el encabezado. Se valida contra los 79 UV / 20 materias que declara el sitio.

const PDF_TECNICO = new URL(
  './fixtures/pensums/tecnico-control-calidad-plan-2024.pdf',
  import.meta.url,
);
const itemsTecnico = await itemsDeDocumento(new Uint8Array(await readFile(PDF_TECNICO)));

test('T8: la plantilla de Técnicos extrae sus 20 materias / 79 UV', () => {
  const tecnico = parsearItems(itemsTecnico);
  assert.equal(tecnico.totales.materiasConteo, 20);
  assert.equal(tecnico.totales.uvSuma, 79);
  assert.equal(tecnico.totales.uvEncabezado, null); // sin "UNIDADES VALORATIVAS" arriba
  assert.deepEqual(tecnico.ciclos.map((c) => c.numero), [1, 2, 3, 4]);
  assert.deepEqual(tecnico.advertencias, []);

  const porCodigo = new Map(tecnico.ciclos.flatMap((c) => c.asignaturas).map((a) => [a.codigo, a]));
  const antropologia = porCodigo.get('ANF231');
  assert.ok(antropologia, 'no se encontró ANF231');
  assert.equal(antropologia.ciclo, 1);
  assert.equal(antropologia.nombre, 'Antropología Filosófica'); // el `*` se estripa
  assert.equal(antropologia.uv, 3);
  assert.equal(antropologia.prerrequisito, null); // Bachillerato

  // El prerrequisito vive a la izquierda de la UV, en la misma fila: correlativo 2 ⇒ ALG501.
  const diseno = porCodigo.get('DIP106');
  assert.ok(diseno, 'no se encontró DIP106');
  assert.equal(diseno.uv, 4);
  assert.equal(diseno.prerrequisito, 'ALG501');

  // Cada columna tiene su UV: la suma por ciclo cierra en los 79 UV del sitio.
  const uvPorCiclo = tecnico.ciclos.map((c) =>
    c.asignaturas.reduce((suma, a) => suma + a.uv, 0),
  );
  assert.equal(uvPorCiclo.reduce((a, b) => a + b, 0), 79);
  assert.deepEqual(uvPorCiclo, [19, 19, 21, 20]);
});

// --- cuarta plantilla real: grilla con los rótulos impresos varias veces --
//
// Este PDF repite varios rótulos (`CICLO III`…`CICLO X`) tres veces en la misma posición.
// Si no se colapsan, `ancho` de columna se calcula con 26 entradas en vez de 10, los bordes de
// región se desplazan y el ciclo X pierde sus 4 materias enteras (40 → 36).

const PDF_ADMON = new URL(
  './fixtures/pensums/presencial-administracion-plan-2024.pdf',
  import.meta.url,
);
const itemsAdmon = await itemsDeDocumento(new Uint8Array(await readFile(PDF_ADMON)));

test('T8: los rótulos duplicados no rompen las regiones (40 materias / 166 UV)', () => {
  const admon = parsearItems(itemsAdmon);
  assert.equal(admon.totales.materiasConteo, 40);
  assert.equal(admon.totales.uvSuma, 166);
  assert.equal(admon.totales.uvEncabezado, 166);
  assert.deepEqual(
    admon.ciclos.map((c) => c.numero),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.deepEqual(admon.advertencias, []); // ninguna zona "sin ítems"

  // El ciclo X era el que se perdía entero por el `ancho` inflado.
  const cicloX = admon.ciclos.find((c) => c.numero === 10);
  assert.ok(cicloX, 'no se encontró el ciclo X');
  assert.deepEqual(
    cicloX.asignaturas.map((a) => a.codigo),
    ['FLP301', 'IDN302', 'IPE301', 'ALC302'],
  );
});

// --- quinta plantilla real: electivas por correlativo y bloques al fondo --
//
// Dos trampas en un mismo documento:
//   * el ciclo V y el VI traen materias **sin código**, marcadas solo por su correlativo (24/28);
//   * la última materia de cada columna no tiene fila de código debajo, así que su bloque se
//     extendía hasta el pie del documento y se tragaba cifras de la caja "ASIGNATURAS ELECTIVAS"
//     (`DDE295` salía con 20 UV en vez de 4).

const PDF_DG = new URL(
  './fixtures/pensums/presencial-diseno-grafico-plan-2024.pdf',
  import.meta.url,
);
const itemsDg = await itemsDeDocumento(new Uint8Array(await readFile(PDF_DG)));

test('T8: las electivas por correlativo y el bloque acotado cierran en 39 materias / 161 UV', () => {
  const dg = parsearItems(itemsDg);
  assert.equal(dg.totales.materiasConteo, 39);
  assert.equal(dg.totales.uvSuma, 161);
  assert.equal(dg.totales.uvEncabezado, 161);
  assert.equal(dg.totales.materiasEncabezado, 39);

  const porCodigo = new Map(
    dg.ciclos.flatMap((c) => c.asignaturas).map((a) => [a.codigo, a]),
  );
  // Última del ciclo VII: sin acotar, su UV salía de la caja inferior (20 → 4).
  assert.equal(porCodigo.get('DDE295')?.uv, 4);
  assert.equal(porCodigo.get('DDE295')?.ciclo, 7);

  // Las dos electivas solo llevan correlativo (24 en el V, 28 en el VI). La segunda se llama
  // «Electiva Il» porque así viene impresa en el PDF oficial (glifo `l`, no `II`): se publica
  // tal cual la fuente.
  const electivas = dg.ciclos.flatMap((c) => c.asignaturas).filter((a) => a.electiva);
  assert.deepEqual(
    electivas.map((a) => `${a.ciclo}:${a.codigo}:${a.nombre}`),
    ['5:-:Electiva I', '6:-:Electiva Il'],
  );
  assert.deepEqual(
    electivas.map((a) => a.uv),
    [4, 4],
  );
});

// --- variantes del virtual: rejilla de 4 columnas y electiva sin prerrequisito
//
// 1) Aquí los rótulos (`Ciclo I`…`Ciclo IV`) están centrados y son de anchos distintos, así que
//    el dígito de UV de la columna I cae a rel −47 y se salía del rango [−46,−25] ⇒
//    "No se encontró la UV del ciclo 1".
// 2) La electiva del ciclo 9 no tiene fila de prerrequisito: el nombre, que en el virtual sigue
//    por debajo de la fila de UV, se cortaba ahí y salía vacío.

const PDF_VTCC = new URL(
  './fixtures/pensums/virtual-tecnico-control-calidad.pdf',
  import.meta.url,
);
const itemsVtcc = await itemsDeDocumento(new Uint8Array(await readFile(PDF_VTCC)));

test('T8: el virtual de 4 columnas encuentra la UV a rel −47 (20 materias / 80 UV)', () => {
  const tcc = parsearItems(itemsVtcc, OPCIONES_VIRTUAL);
  assert.equal(tcc.totales.materiasConteo, 20);
  assert.equal(tcc.totales.uvSuma, 80);
  assert.deepEqual(tcc.ciclos.map((c) => c.numero), [1, 2, 3, 4]);

  const anf901 = tcc.ciclos[0]!.asignaturas.find((a) => a.codigo === 'ANF901');
  assert.ok(anf901, 'no se encontró ANF901');
  assert.equal(anf901.uv, 4); // era la que fallaba en la columna I
  assert.equal(anf901.nombre, 'Antropologia Filosófica');
});

const PDF_VIND = new URL('./fixtures/pensums/virtual-ing-industrial.pdf', import.meta.url);
const itemsVind = await itemsDeDocumento(new Uint8Array(await readFile(PDF_VIND)));

test('T8: la electiva sin prerrequisito conserva su nombre (44 materias / 176 UV)', () => {
  const ind = parsearItems(itemsVind, OPCIONES_VIRTUAL);
  assert.equal(ind.totales.materiasConteo, 44);
  assert.equal(ind.totales.uvSuma, 176);

  const ciclo9 = ind.ciclos.find((c) => c.numero === 9);
  assert.ok(ciclo9, 'no se encontró el ciclo 9');
  const electivas = ciclo9.asignaturas.filter((a) => a.electiva);
  assert.deepEqual(
    electivas.map((a) => `${a.codigo}:${a.nombre}:${a.uv}`),
    ['-:Técnica Electiva I:4'],
  );
});

// 3) La única fuente multipágina: reparte sus 44 materias en 3 páginas. Leer solo la primera
//    dejaba 24 materias fuera (filas=80 frente al sitio=176).
const PDF_VADM = new URL('./fixtures/pensums/virtual-administracion.pdf', import.meta.url);
const itemsVadm = await itemsDeDocumento(new Uint8Array(await readFile(PDF_VADM)));

test('T8: el multipágina junta sus 3 páginas (44 materias / 176 UV)', () => {
  const av = parsearItems(itemsVadm, OPCIONES_VIRTUAL);
  assert.equal(av.totales.materiasConteo, 44);
  assert.equal(av.totales.uvSuma, 176);
  assert.deepEqual(av.ciclos.map((c) => c.numero), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  // Las páginas no se mezclan: la última materia sigue teniendo su nombre y su UV.
  const ultima = av.ciclos[9]!.asignaturas.at(-1)!;
  assert.equal(ultima.uv, 4);
  assert.ok(ultima.nombre.length > 3, `nombre vacío o diminuto: «${ultima.nombre}»`);
});

// --- B² — puerta de entrada al OCR (los 7 PDF de UDB Virtual sin capa de texto) ---------

test('B²: los PDF con capa de texto traen rótulos de ciclo y no deben pasar por el OCR', () => {
  assert.equal(hayRotulosDeCiclo(items), true, 'el presencial perdió sus rótulos');
  assert.equal(hayRotulosDeCiclo(itemsVirtual), true, 'el virtual perdió sus rótulos');
});

test('B²: sin rótulos de ciclo no hay plantilla que parsear ⇒ toca el OCR', () => {
  // Así se ve el PDF dibujado como trazos: solo sobreviven los dígitos de UV, ningún `CICLO`.
  const sinRotulos = items.filter((i) => !/^CICLO\b/i.test(i.str.trim()));
  assert.ok(sinRotulos.length > 0, 'el fixture debe tener texto de relleno');
  assert.equal(hayRotulosDeCiclo(sinRotulos), false);

  // Un texto que *contiene* un rótulo no vale: tiene que ser el rótulo entero.
  assert.equal(hayRotulosDeCiclo([{ str: 'Ver ciclo I al final', x: 0, y: 0, width: 0 }]), false);
  assert.equal(hayRotulosDeCiclo([{ str: 'CICLO X', x: 0, y: 0, width: 0 }]), true);
});

test('B²: las opciones de OCR heredan la geometría virtual pero no fusionan palabras', () => {
  assert.equal(OPCIONES_OCR.fusionar, false, 'tesseract ya emite la palabra entera');
  assert.equal(OPCIONES_OCR.margenTitulo, OPCIONES_VIRTUAL.margenTitulo);
  assert.equal(OPCIONES_OCR.electivaPorCorrelativo, OPCIONES_VIRTUAL.electivaPorCorrelativo);
  assert.equal(OPCIONES_OCR.prerrequisitoEnFilaPropia, OPCIONES_VIRTUAL.prerrequisitoEnFilaPropia);
  // Misma geometría, distinta fusión: con `fusionar: true` los ítems de tesseract se pegan
  // (`Pensamiento Social` ⇒ `PensamientoSocial`), así que la plantilla no cambia, solo eso.
  assert.deepEqual(OPCIONES_OCR.offsets, OPCIONES_VIRTUAL.offsets);
});

// --- celdas centradas: las columnas no se roban texto entre ellas --------

test('T5: un nombre ancho no se cuela en la columna vecina', () => {
  const porCodigo = new Map(
    resultado.ciclos.flatMap((c) => c.asignaturas).map((a) => [a.codigo, a]),
  );
  assert.equal(porCodigo.get('LIS104')?.nombre, 'Lenguajes Interpretados en el Servidor');
  assert.equal(
    porCodigo.get('DPS104')?.nombre,
    'Diseño y Programación de Software Multiplataforma',
  );
});
