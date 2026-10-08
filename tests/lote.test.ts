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

function entrada(hoy: string, manifiesto = [presencial, virtual]): EntradaGeneracion {
  return {
    manifiesto: manifiesto as EntradaGeneracion['manifiesto'],
    fuentes: FUENTES,
    cargarImagen: sinImagen,
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
