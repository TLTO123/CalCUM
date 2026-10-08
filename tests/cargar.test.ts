// T3 — pipeline/cargar.ts: las fuentes viven en disco y solo hay red con `--refresco`
// (RF-16, RNF-1, RNF-3). La red se inyecta: sin `--refresco` no puede haber ninguna.
// B² añade el `.jpg` renderizado del PDF, que solo piden los planes sin capa de texto.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  cargarFuente,
  cargarImagen,
  nombreDeImagen,
  normalizarUrl,
  rutaDeFuente,
  rutaDeImagen,
  type Descargador,
} from '../pipeline/cargar.ts';

// Temp aprobado para uso externo (AGENTS.md).
const TEMP = 'C:/Users/canta/AppData/Local/Temp/opencode';
const FIXTURE = new URL(
  './fixtures/pensums/presencial-ciencias-computacion-plan-2024.pdf',
  import.meta.url,
);
const URL_PENSUM =
  'https://www.udb.edu.sv/udb_files/content_resource/es/pensum/rebranding2024/' +
  'pensum-ingenieria-en-ciencias-de-la-computacion-plan-2024.pdf';

/** Un descargador que revienta: si el código lo llega a invocar, hay red donde no debe haberla. */
const sinRed: Descargador = async () => {
  throw new Error('RED PROHIBIDA: se intentó descargar sin --refresco');
};

async function directorioTemporal(prefijo: string): Promise<string> {
  await mkdir(TEMP, { recursive: true });
  return mkdtemp(join(TEMP, `calcum-${prefijo}-`));
}

test('T3: http:// se normaliza a https:// antes de tocar nada (caso límite 8)', () => {
  assert.equal(
    normalizarUrl('http://www.udb.edu.sv/udb_files/pensum-x.pdf'),
    'https://www.udb.edu.sv/udb_files/pensum-x.pdf',
  );
  assert.equal(normalizarUrl(URL_PENSUM), URL_PENSUM, 'una URL ya https no debe cambiar');
});

test('T3: la ruta local deriva del nombre del documento y es determinista', () => {
  const ruta = rutaDeFuente(URL_PENSUM, 'fuentes');
  assert.equal(ruta, join('fuentes', 'pensum-ingenieria-en-ciencias-de-la-computacion-plan-2024.pdf'));
  assert.equal(rutaDeFuente(URL_PENSUM, 'fuentes'), ruta, 'misma URL ⇒ misma ruta');
});

test('T3: lee una fuente local sin pasar por la red', async () => {
  const dir = await directorioTemporal('local');
  try {
    const destino = join(dir, 'pensum-ingenieria-en-ciencias-de-la-computacion-plan-2024.pdf');
    await copyFile(FIXTURE, destino);

    const fuente = await cargarFuente(URL_PENSUM, { directorio: dir, descargar: sinRed });

    assert.equal(fuente.origen, 'local');
    assert.equal(fuente.url, URL_PENSUM);
    assert.equal(fuente.ruta, destino);
    const original = new Uint8Array(await readFile(FIXTURE));
    assert.equal(fuente.bytes.length, original.length, 'los bytes no coinciden con la fixture');
    assert.equal(new TextDecoder().decode(fuente.bytes.subarray(0, 4)), '%PDF');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('T3: sin la fuente local y sin --refresco, falla ruidosamente y no descarga', async () => {
  const dir = await directorioTemporal('falta');
  try {
    await assert.rejects(
      cargarFuente(URL_PENSUM, { directorio: dir, descargar: sinRed }),
      /refrescar/i,
      'debe exigir `npm run datos:refrescar` en lugar de ir a la red',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('T3: con --refresco descarga y guarda; la corrida siguiente lee de disco', async () => {
  const dir = await directorioTemporal('refresco');
  try {
    const bytes = new Uint8Array(await readFile(FIXTURE));
    let llamadas = 0;
    const descargador: Descargador = async (url) => {
      llamadas++;
      assert.equal(url, URL_PENSUM, 'la descarga debe usar la URL normalizada');
      return bytes;
    };

    const primera = await cargarFuente(URL_PENSUM, { directorio: dir, refresco: true, descargar: descargador });
    assert.equal(primera.origen, 'red');
    assert.equal(llamadas, 1);
    const guardada = await stat(primera.ruta);
    assert.equal(guardada.size, bytes.length, 'el PDF no quedó escrito completo');

    const segunda = await cargarFuente(URL_PENSUM, { directorio: dir, descargar: sinRed });
    assert.equal(segunda.origen, 'local', 'la segunda corrida debe leer del disco');
    assert.equal(segunda.bytes.length, bytes.length);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('T3: rechaza ruidosamente un descargado que no es un PDF (P2)', async () => {
  const dir = await directorioTemporal('basura');
  try {
    await assert.rejects(
      cargarFuente(URL_PENSUM, {
        directorio: dir,
        refresco: true,
        descargar: async () => new TextEncoder().encode('<html>404</html>'),
      }),
      /PDF/i,
    );
    await assert.rejects(
      cargarFuente(URL_PENSUM, { directorio: dir, refresco: true, descargar: async () => new Uint8Array(0) }),
      /PDF|vac/i,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- B² — la imagen del PDF que va sin capa de texto (RF-14) -----------------------------
//
// El sitio publica `<mismo nombre>.jpg` junto al PDF. Se deriva de la URL en vez de curarlo
// en el manifiesto, así que RF-16 sigue teniendo una sola URL por plan y no hay dos fuentes
// que puedan desincronizarse.

/** Cabecera JPEG de mentira (FF D8 FF): alcanza para que el validador la reconozca. */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

test('B²: la imagen se deriva del PDF del que acompaña (mismo nombre, extensión .jpg)', () => {
  assert.equal(
    nombreDeImagen(URL_PENSUM),
    'pensum-ingenieria-en-ciencias-de-la-computacion-plan-2024.jpg',
  );
  assert.equal(rutaDeImagen(URL_PENSUM, 'fuentes'), join('fuentes', `${nombreDeImagen(URL_PENSUM)}`));
  assert.equal(nombreDeImagen(normalizarUrl('http://udb.edu.sv/p/pensum-x.pdf')), 'pensum-x.jpg');
  // Una URL que no es PDF no puede tener imagen derivada: se falla en el origen.
  assert.throws(() => nombreDeImagen('https://udb.edu.sv/p/ficha-de-carrera.html'), /PDF/i);
});

test('B²: sin la imagen local y sin --refresco, falla ruidosamente y no descarga (RF-12)', async () => {
  const dir = await directorioTemporal('imagen-falta');
  try {
    await assert.rejects(
      cargarImagen(URL_PENSUM, { directorio: dir, descargar: sinRed }),
      /refrescar/i,
      'debe exigir `npm run datos:refrescar` en lugar de ir a la red',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('B²: con --refresco descarga el .jpg junto al PDF y la corrida siguiente lee de disco', async () => {
  const dir = await directorioTemporal('imagen-refresco');
  try {
    let llamadas = 0;
    const descargador: Descargador = async (url) => {
      llamadas++;
      assert.equal(
        url,
        URL_PENSUM.replace(/\.pdf$/i, '.jpg'),
        'la imagen vive al lado del PDF en el sitio',
      );
      return JPEG;
    };

    const primera = await cargarImagen(URL_PENSUM, {
      directorio: dir,
      refresco: true,
      descargar: descargador,
    });
    assert.equal(llamadas, 1);
    assert.deepEqual([...primera], [...JPEG]);
    assert.equal((await stat(rutaDeImagen(URL_PENSUM, dir))).size, JPEG.length, 'no quedó escrita');

    // La corrida siguiente no pasa por la red: `sinRed` revienta si se le llega a llamar.
    const segunda = await cargarImagen(URL_PENSUM, { directorio: dir, descargar: sinRed });
    assert.deepEqual([...segunda], [...JPEG]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('B²: rechaza ruidosamente lo que no es un JPEG, bajado o local (P2)', async () => {
  const dir = await directorioTemporal('imagen-basura');
  try {
    await assert.rejects(
      cargarImagen(URL_PENSUM, {
        directorio: dir,
        refresco: true,
        descargar: async () => new TextEncoder().encode('<html>404</html>'),
      }),
      /JPEG/i,
    );

    const ruta = rutaDeImagen(URL_PENSUM, dir);
    await mkdir(dir, { recursive: true });
    await writeFile(ruta, 'esto no es una imagen');
    await assert.rejects(cargarImagen(URL_PENSUM, { directorio: dir, descargar: sinRed }), /JPEG/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
