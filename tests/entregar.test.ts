import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entregarImagen } from '../src/export/entregar.ts';
import type { NavigatorCompartir } from '../src/export/entregar.ts';

const NOMBRE = 'calcum-ingenieria-en-ciencias-de-la-computacion-2026-10-07.png';

function blobPrueba(): Blob {
  return new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
}

interface Espias {
  navigator: NavigatorCompartir;
  descargas: { blob: Blob; nombre: string }[];
  compartidos: { files?: File[] }[];
}

interface Opciones {
  canShare?: boolean | Error;
  share?: 'ok' | 'AbortError' | 'otro';
}

/** `navigator` falso con banderas conmutables para cada ruta del plan (§4). */
function espias(opciones: Opciones = {}): Espias {
  const descargas: Espias['descargas'] = [];
  const compartidos: Espias['compartidos'] = [];
  const navigator: NavigatorCompartir = {};

  if (opciones.canShare !== undefined) {
    navigator.canShare = () => {
      if (opciones.canShare instanceof Error) throw opciones.canShare;
      return opciones.canShare;
    };
  }
  if (opciones.share) {
    navigator.share = async (datos) => {
      compartidos.push(datos);
      if (opciones.share === 'AbortError') throw new DOMException('El usuario canceló', 'AbortError');
      if (opciones.share === 'otro') throw new Error('share no disponible');
    };
  }
  return { navigator, descargas, compartidos };
}

/** Dependencias reales de `entregarImagen`, con las banderas del espía. */
function entornoPrueba(opciones: Opciones = {}) {
  const e = espias(opciones);
  let descargaRota = false;
  return {
    entorno: {
      navigator: e.navigator,
      descargar: (blob: Blob, nombre: string) => {
        if (descargaRota) throw new Error('no se pudo guardar');
        e.descargas.push({ blob, nombre });
      },
    },
    descargas: e.descargas,
    compartidos: e.compartidos,
    romperDescarga: () => {
      descargaRota = true;
    },
  };
}

test('RF-3: con `canShare` se entrega el PNG a la app del sistema y devuelve `compartido`', async () => {
  const { entorno, descargas, compartidos } = entornoPrueba({ canShare: true, share: 'ok' });
  const blob = blobPrueba();
  const r = await entregarImagen(blob, NOMBRE, entorno);

  assert.equal(r, 'compartido');
  assert.equal(compartidos.length, 1, 'share se llamó una sola vez');
  assert.equal(descargas.length, 0, 'no hubo descarga');
  const archivo = compartidos[0]?.files?.[0];
  assert.equal(archivo?.name, NOMBRE);
  assert.equal(archivo?.type, 'image/png');
  assert.ok(archivo && archivo.size > 0, 'el archivo lleva el blob');
});

test('RF-3/D10: sin soporte de compartir se descarga y devuelve `guardado`', async () => {
  const { entorno, descargas, compartidos } = entornoPrueba({ share: 'ok' }); // sin canShare
  const blob = blobPrueba();
  const r = await entregarImagen(blob, NOMBRE, entorno);

  assert.equal(r, 'guardado');
  assert.equal(compartidos.length, 0, 'no se intentó compartir');
  assert.equal(descargas.length, 1);
  assert.equal(descargas[0]?.nombre, NOMBRE);
  assert.equal(descargas[0]?.blob, blob);
});

test('RF-3/D10: `canShare` que responde false => descarga, sin intentar `share`', async () => {
  const { entorno, descargas, compartidos } = entornoPrueba({ canShare: false, share: 'ok' });
  const r = await entregarImagen(blobPrueba(), NOMBRE, entorno);

  assert.equal(r, 'guardado');
  assert.equal(compartidos.length, 0);
  assert.equal(descargas.length, 1);
});

test('RF-3/D4: cancelar el diálogo (`AbortError`) devuelve `cancelado` y NO descarga', async () => {
  const { entorno, descargas, compartidos } = entornoPrueba({ canShare: true, share: 'AbortError' });
  const r = await entregarImagen(blobPrueba(), NOMBRE, entorno);

  assert.equal(r, 'cancelado');
  assert.equal(compartidos.length, 1, 'sí se intentó compartir');
  assert.equal(descargas.length, 0, 'cancelar no dispara una descarga sorpresa');
});

test('D10: si `share` falla por otra razón se cae a la descarga', async () => {
  const { entorno, descargas, compartidos } = entornoPrueba({ canShare: true, share: 'otro' });
  const r = await entregarImagen(blobPrueba(), NOMBRE, entorno);

  assert.equal(r, 'guardado');
  assert.equal(compartidos.length, 1);
  assert.equal(descargas.length, 1, 'fallback a descarga');
});

test('RF-7: si `canShare` revienta, el flujo sigue y termina en descarga', async () => {
  const { entorno, descargas } = entornoPrueba({ canShare: new Error('no soportado'), share: 'ok' });
  const r = await entregarImagen(blobPrueba(), NOMBRE, entorno);

  assert.equal(r, 'guardado');
  assert.equal(descargas.length, 1);
});

test('RF-7: si la descarga también falla devuelve `error` (sin lanzar)', async () => {
  const { entorno, romperDescarga } = entornoPrueba({});
  romperDescarga();
  const r = await entregarImagen(blobPrueba(), NOMBRE, entorno);
  assert.equal(r, 'error');
});

test('un `Navigator` real cumple `NavigatorCompartir` (comprobación de tipos para la T4)', () => {
  // Si `Navigator` dejara de encajar con la interfaz, esto no compila.
  const comoNavigator = (navigator: Navigator): NavigatorCompartir => navigator;
  assert.equal(typeof comoNavigator, 'function');
});

test('RF-5: nada se comparte ni se descarga sin una invocación explícita', () => {
  const { descargas, compartidos } = entornoPrueba({ canShare: true, share: 'ok' });
  assert.equal(descargas.length, 0, 'el módulo no actúa al importarse');
  assert.equal(compartidos.length, 0);
});
