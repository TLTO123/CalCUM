// T8 (RF-12, RF-13, RF-16, RNF-1) — pipeline/generar.ts: generación del dataset.
//
// RF-12 (reproducibilidad): dos corridas con la misma entrada y la misma `hoy` producen el
// **mismo byte**; `hoy` entra como parámetro y jamás se lee el reloj dentro de la lógica.
// RF-13 (parada total): si una fuente falta o una validación falla, se lanza señalando la
// carrera exacta y **no se escribe nada**.
//
// Se generan los 2 PDF reales de fixtures (presencial + virtual) como si fueran el dataset.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ejecutarGeneracion,
  generarDataset,
  redactarReporte,
  type EntradaGeneracion,
} from '../pipeline/generar.ts';
import type { CorreccionNombre } from '../pipeline/correcciones.ts';
import { prefijoDePlan } from '../pipeline/identificadores.ts';
import { esquemaPlan } from '../src/data/esquema.ts';

const PDF_PRESENCIAL = new URL(
  './fixtures/pensums/presencial-ciencias-computacion-plan-2024.pdf',
  import.meta.url,
);
const PDF_VIRTUAL = new URL('./fixtures/pensums/virtual-ciencias-computacion.pdf', import.meta.url);

const manifiestoReal: Array<Record<string, unknown>> = JSON.parse(
  await readFile(new URL('../pipeline/manifiesto.json', import.meta.url), 'utf8'),
);
const presencial = manifiestoReal.find(
  (e) => e.sede === 'soyapango' && e.urlPensum === 'https://www.udb.edu.sv/udb_files/content_resource/es/pensum/rebranding2024/pensum-ingenieria-en-ciencias-de-la-computacion-plan-2024.pdf',
)!;
const virtual = manifiestoReal.find(
  (e) => e.sede === 'virtual' && e.urlPensum === 'https://www.udbvirtual.edu.sv/lib/pensum/pensum_ingenieria_cc_computacion.pdf',
)!;
assert.ok(presencial && virtual, 'las entradas del manifiesto cambiaron');

const FUENTES = new Map<string, Uint8Array>([
  [presencial.urlPensum as string, new Uint8Array(await readFile(PDF_PRESENCIAL))],
  [virtual.urlPensum as string, new Uint8Array(await readFile(PDF_VIRTUAL))],
]);

// Los 2 fixtures van con capa de texto: el OCR no debe entrar nunca. Si el detector fallara
// y pidiera la imagen, este stub revienta y señala la URL (RF-13, sin fallar en silencio).
const sinImagen = async (url: string): Promise<Uint8Array> => {
  throw new Error(`el OCR no debe pedirse para ${url}`);
};

function entrada(
  hoy: string,
  manifiesto = [presencial, virtual],
  correcciones: readonly CorreccionNombre[] = [],
): EntradaGeneracion {
  return {
    manifiesto: manifiesto as EntradaGeneracion['manifiesto'],
    fuentes: FUENTES,
    cargarImagen: sinImagen,
    correcciones,
    hoy,
  };
}

test('T8: dos corridas con la misma entrada y la misma `hoy` producen el mismo byte (RF-12)', async () => {
  const a = await generarDataset(entrada('2026-10-05'));
  const b = await generarDataset(entrada('2026-10-05'));
  assert.equal(JSON.stringify(a), JSON.stringify(b), 'la generación no es reproducible');
  assert.equal(a.planes.length, 2);
});

test('T8: `hoy` es un parámetro: no cambia los planes, solo la fecha publicada (RF-16)', async () => {
  const a = await generarDataset(entrada('2026-01-02'));
  const b = await generarDataset(entrada('2026-12-31'));
  assert.equal(JSON.stringify(a.planes), JSON.stringify(b.planes), 'los planes dependen del reloj');
  assert.notEqual(JSON.stringify(a.manifiestoPublicado), JSON.stringify(b.manifiestoPublicado));
  assert.deepEqual(
    a.manifiestoPublicado.map((m) => m.origen.fecha),
    ['2026-01-02', '2026-01-02'],
  );
});

test('T8: el dataset generado cumple `esquemaPlan` y conserva los totales del origen (RF-14)', async () => {
  const { planes, manifiestoPublicado } = await generarDataset(entrada('2026-10-05'));
  for (const plan of planes) {
    const r = esquemaPlan.safeParse(plan);
    assert.ok(r.success, `plan inválido: ${r.success ? '' : JSON.stringify(r.error.issues)}`);
  }
  const [p, v] = planes;
  assert.equal(p!.uvTotal, 161);
  assert.equal(p!.materiasTotal, 40);
  assert.equal(p!.ciclos.flatMap((c) => c.asignaturas).length, 40);
  assert.equal(v!.uvTotal, 176);
  assert.equal(v!.materiasTotal, 44);
  // RF-16: cada plan publica de dónde salió y cuándo.
  assert.deepEqual(manifiestoPublicado, [
    { carrera: presencial.carrera, sede: presencial.sede, tipo: presencial.tipo, plan: presencial.plan, origen: { url: presencial.urlPensum, fecha: '2026-10-05' } },
    { carrera: virtual.carrera, sede: virtual.sede, tipo: virtual.tipo, plan: virtual.plan, origen: { url: virtual.urlPensum, fecha: '2026-10-05' } },
  ]);
});

test('T8: falta una fuente ⇒ error que señala la carrera exacta (RF-13)', async () => {
  const sinFuente: EntradaGeneracion = {
    manifiesto: [presencial, virtual] as EntradaGeneracion['manifiesto'],
    fuentes: new Map([[presencial.urlPensum as string, FUENTES.get(presencial.urlPensum as string)!]]),
    cargarImagen: sinImagen,
    correcciones: [],
    hoy: '2026-10-05',
  };
  await assert.rejects(generarDataset(sinFuente), (e: Error) => {
    assert.match(e.message, /UDB Virtual|a distancia/i, `no señala la carrera: ${e.message}`);
    assert.match(e.message, /fuente/i);
    return true;
  });
});

test('T8: un total descuadrado detiene todo y reporta sitio/encabezado/filas (RF-2/RF-13)', async () => {
  const descuadrado = entrada('2026-10-05', [
    { ...presencial, uvTotal: (presencial.uvTotal as number) + 7 },
  ]);
  await assert.rejects(generarDataset(descuadrado), (e: Error) => {
    assert.match(e.message, /Ingeniería en Ciencias de la Computación/);
    assert.match(e.message, /sitio=168/);
    assert.match(e.message, /encabezado=161/);
    assert.match(e.message, /filas=161/);
    return true;
  });
});

test('T8: si algo falla no se escribe nada; si va bien escribe los 3 artefactos', async () => {
  const escrituras: Array<[string, string]> = [];
  const escribir = async (ruta: string, contenido: string) => {
    escrituras.push([ruta, contenido]);
  };

  // Fallo: nada escrito.
  await assert.rejects(
    ejecutarGeneracion({
      manifiesto: [presencial] as EntradaGeneracion['manifiesto'],
      fuentes: new Map(),
      hoy: '2026-10-05',
      escribir,
    }),
    /Ingeniería en Ciencias de la Computación/,
  );
  assert.deepEqual(escrituras, [], 'no puede escribir nada si la generación falla');

  // Éxito: data/planes.json + data/manifiesto.json + docs/02-reporte-dataset.md.
  const r = await ejecutarGeneracion({
    manifiesto: [presencial, virtual] as EntradaGeneracion['manifiesto'],
    fuentes: FUENTES,
    hoy: '2026-10-05',
    escribir,
  });
  assert.deepEqual(
    escrituras.map(([ruta]) => ruta),
    ['data/planes.json', 'data/manifiesto.json', 'docs/02-reporte-dataset.md'],
  );
  const planes = JSON.parse(escrituras[0]![1]);
  assert.equal(planes.length, 2);
  assert.equal(escrituras[1]![1].includes('2026-10-05'), true);
  assert.equal(escrituras[2]![1].includes('Ingeniería en Ciencias de la Computación'), true);
  assert.equal(r.rutas.length, 3);
});

test('T8: el reporte resume totales por carrera, discrepancias y advertencias', async () => {
  const { advertencias } = await generarDataset(entrada('2026-10-05'));
  const dataset = await generarDataset(entrada('2026-10-05'));
  const reporte = redactarReporte({ ...dataset, advertencias });
  assert.match(reporte, /2026-10-05/);
  assert.match(reporte, /Ingeniería en Ciencias de la Computación/);
  assert.match(reporte, /161/);
  assert.match(reporte, /176/);
  assert.match(reporte, /Discrepancias/);
  assert.match(reporte, /Advertencias/);
});

// --- excepción RF-2 aprobada (decisión del usuario, 2026-10-05) -------------------------
//
// La grilla de Ingeniería Eléctrica suma 163 UV y la cabecera del PDF + el sitio dicen 162.
// Sin excepción, RF-13 detiene toda la publicación. Se aprobó publicar la suma real de la
// grilla (163 UV, la que alimenta el cálculo) y dejar la discrepancia 162↔163 documentada en
// el manifiesto publicado y en el reporte. Cualquier otra diferencia sigue bloqueando.

const PDF_ELECTRICA = new URL('./fixtures/pensums/presencial-electrica-plan-2024.pdf', import.meta.url);
const electrica = manifiestoReal.find(
  (e) => e.sede === 'soyapango' && e.carrera === 'Ingeniería Eléctrica',
)!;
assert.ok(electrica, 'la entrada de Ingeniería Eléctrica desapareció del manifiesto');

const FUENTE_ELECTRICA = new Map<string, Uint8Array>([
  [electrica.urlPensum as string, new Uint8Array(await readFile(PDF_ELECTRICA))],
]);

function entradaElectrica(hoy: string): EntradaGeneracion {
  return {
    manifiesto: [electrica] as EntradaGeneracion['manifiesto'],
    fuentes: FUENTE_ELECTRICA,
    cargarImagen: sinImagen,
    correcciones: [],
    hoy,
  };
}

test('T8: la excepción RF-2 aprobada publica la suma de la grilla y documenta la diferencia', async () => {
  const dataset = await generarDataset(entradaElectrica('2026-10-05'));

  // Se publica 163 UV —la suma real de la grilla, la que alimenta el cálculo— no el 162 del sitio.
  const plan = dataset.planes[0]!;
  assert.equal(plan.uvTotal, 163, 'la excepción debe publicar la suma de la grilla');
  const sumaFilas = plan.ciclos.flatMap((c) => c.asignaturas).reduce((n, a) => n + a.uv, 0);
  assert.equal(sumaFilas, 163, 'uvTotal debe seguir cuadrando con las materias publicadas');
  assert.equal(plan.materiasTotal, 40);

  // La discrepancia queda registrada (RF-3/RF-14), no silenciada.
  assert.equal(dataset.excepciones.length, 1, JSON.stringify(dataset.excepciones));
  const ex = dataset.excepciones[0]!;
  assert.equal(ex.carrera, 'Ingeniería Eléctrica');
  assert.equal(ex.concepto, 'UV');
  assert.equal(ex.sitio, 162);
  assert.equal(ex.encabezado, 162);
  assert.equal(ex.filas, 163);
  assert.equal(ex.publicado, 163);

  // El manifiesto publicado deja constancia de dónde se apartó del sitio.
  assert.equal(dataset.manifiestoPublicado[0]!.excepcionRf2?.filas, 163);

  // El reporte la documenta con sus tres valores y la motivación.
  const reporte = redactarReporte(dataset);
  assert.match(reporte, /Excepciones a RF-2/);
  assert.match(reporte, /Ingeniería Eléctrica/);
  assert.match(reporte, /sitio=162/);
  assert.match(reporte, /encabezado=162/);
  assert.match(reporte, /filas=163/);
  assert.match(reporte, /aprobada por el usuario/i);
});

// --- T5 (RF-3, RF-6, RF-8) — correcciones curadas cableadas en la generación -----------------
//
// El registro (`pipeline/correcciones-nombres.json`) entra **inyectado**, como las fuentes (D3),
// y se aplica entre identificar y validar: RF-3 publica el nombre curado, RF-6 deja constancia
// en el manifiesto y en el reporte con su asignatura y su documento, y RF-8 garantiza que no
// cambia **ningún otro campo**. Lo que no se aplica nunca se ignora en silencio (caso límite 8).

/** Corrección de prueba apuntando a la primera asignatura de un plan real ya generado. */
async function correccionDe(hoy: string, nombre: string): Promise<CorreccionNombre> {
  const base = await generarDataset(entrada(hoy));
  const a = base.planes[0]!.ciclos[0]!.asignaturas[0]!;
  return {
    id: a.id,
    nombre,
    fuente: 'pensum-prueba.pdf',
    motivo: 'nombre dañado en la extracción; cotejado contra el PDF del pensum',
  };
}

test('T5: la generación publica el nombre corregido y lo registra (RF-3/RF-6/RF-8)', async () => {
  const hoy = '2026-10-05';
  const base = await generarDataset(entrada(hoy));
  const original = base.planes[0]!.ciclos[0]!.asignaturas[0]!;
  const correccion: CorreccionNombre = {
    id: original.id,
    nombre: 'Nombre Curado En Prueba',
    fuente: 'pensum-prueba.pdf',
    motivo: 'nombre dañado en la extracción; cotejado contra el PDF del pensum',
  };

  const corregido = await generarDataset(entrada(hoy, undefined, [correccion]));

  // RF-3: el plan publicado lleva el nombre curado en la asignatura que lo pedía.
  const salida = corregido.planes[0]!.ciclos[0]!.asignaturas[0]!;
  assert.equal(salida.nombre, 'Nombre Curado En Prueba');
  assert.equal(salida.id, original.id);

  // RF-8: el resto del dataset byte a byte igual — nada más que un nombre cambió.
  const esperado = structuredClone(base.planes);
  esperado[0]!.ciclos[0]!.asignaturas[0]!.nombre = 'Nombre Curado En Prueba';
  assert.deepEqual(corregido.planes, esperado);

  // RF-6: el manifiesto publicado la registra con su asignatura, su nombre previo y su fuente.
  const registro = corregido.manifiestoPublicado[0]!.correcciones;
  assert.equal(registro?.length, 1, JSON.stringify(corregido.manifiestoPublicado));
  assert.equal(registro![0]!.id, original.id);
  assert.equal(registro![0]!.codigo, original.codigo);
  assert.equal(registro![0]!.ciclo, base.planes[0]!.ciclos[0]!.numero);
  assert.equal(registro![0]!.nombreAnterior, original.nombre);
  assert.equal(registro![0]!.fuente, 'pensum-prueba.pdf');
  assert.equal(
    corregido.manifiestoPublicado[1]!.correcciones,
    undefined,
    'el otro plan no tiene correcciones: la clave no aparece',
  );

  // RF-6: el reporte la lista con asignatura, documento y motivo.
  assert.equal(corregido.correcciones.length, 1);
  const reporte = redactarReporte(corregido);
  assert.match(reporte, /Correcciones curadas/);
  assert.match(reporte, /Nombre Curado En Prueba/);
  assert.match(reporte, /pensum-prueba\.pdf/);
  assert.match(reporte, new RegExp(original.codigo));
  assert.match(reporte, /cotejado contra el PDF/);
});

test('T5: una corrección obsoleta detiene todo y no se escribe nada (caso límite 8/RF-13)', async () => {
  const escrituras: Array<[string, string]> = [];
  const obsoleta: CorreccionNombre = {
    // Prefijo del plan real de la fuente: la carrera existe, la asignatura ya no (caso límite 8).
    id: `${prefijoDePlan(presencial)}:1:ZZZ999`,
    nombre: 'Nombre Que Ya No Existe',
    fuente: 'pensum-antiguo.pdf',
    motivo: 'la UDB publicó un pensum nuevo y esa asignatura ya no está',
  };

  await assert.rejects(
    ejecutarGeneracion({
      manifiesto: [presencial] as EntradaGeneracion['manifiesto'],
      fuentes: FUENTES,
      cargarImagen: sinImagen,
      correcciones: [obsoleta],
      hoy: '2026-10-05',
      escribir: async (ruta, contenido) => {
        escrituras.push([ruta, contenido]);
      },
    }),
    (e: Error) => {
      assert.match(e.message, /Ingeniería en Ciencias de la Computación/, 'carrera exacta (RF-13)');
      assert.match(e.message, /ZZZ999/, 'la corrección se señala con su id');
      assert.match(e.message, /id-inexistente/);
      return true;
    },
  );
  assert.deepEqual(escrituras, [], 'no puede escribir nada si la generación falla');
});

test('T5: una corrección de una carrera que ya no está en el manifiesto también detiene', async () => {
  const escrituras: Array<[string, string]> = [];
  const fantasma: CorreccionNombre = {
    id: 'soyapango:ingenieria:plan-1999:correccion-fantasma:1:ZZZ999',
    nombre: 'Nombre Huérfano',
    fuente: 'pensum-antiguo.pdf',
    motivo: 'la carrera ya no figura en el manifiesto',
  };

  await assert.rejects(
    ejecutarGeneracion({
      manifiesto: [presencial] as EntradaGeneracion['manifiesto'],
      fuentes: FUENTES,
      cargarImagen: sinImagen,
      correcciones: [fantasma],
      hoy: '2026-10-05',
      escribir: async (ruta, contenido) => {
        escrituras.push([ruta, contenido]);
      },
    }),
    (e: Error) => {
      assert.match(e.message, /correccion-fantasma/);
      assert.match(e.message, /manifiesto/);
      return true;
    },
  );
  assert.deepEqual(escrituras, []);
});

test('T5: dos corridas con la misma entrada y el mismo registro dan el mismo byte (RF-9/RF-12)', async () => {
  const correccion = await correccionDe('2026-10-05', 'Nombre Curado Repetible');
  const a = await generarDataset(entrada('2026-10-05', undefined, [correccion]));
  const b = await generarDataset(entrada('2026-10-05', undefined, [correccion]));
  assert.equal(JSON.stringify(a), JSON.stringify(b), 'el registro rompió la reproducibilidad');
  assert.equal(a.planes[0]!.ciclos[0]!.asignaturas[0]!.nombre, 'Nombre Curado Repetible');
});
