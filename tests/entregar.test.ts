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
  /** Reloj falso en ms: `share` lo adelanta antes de rechazar (D14). */
  ahora: () => number;
  /** Solo con `share: 'pendiente'`: el navegador resuelve tarde, a demanda (D15). */
  tarde: { resolver: () => void; rechazar: (error: unknown) => void };
}

interface Opciones {
  canShare?: boolean | Error;
  share?: 'ok' | 'AbortError' | 'otro' | 'pendiente';
  /** Mensaje del `AbortError` (por defecto, uno de cancelación del usuario). */
  mensaje?: string;
  /** ms que avanzan el reloj antes de que `share` rechace. */
  ms?: number;
  /** ¿El usuario llegó a ver el diálogo de compartir? (D14) */
  dialogo?: boolean;
  /** El plazo se cumple en el acto, sin esperar los 5 s (D15). */
  plazo?: boolean;
}

/** `navigator` falso con banderas conmutables para cada ruta del plan (§4). */
function espias(opciones: Opciones = {}): Espias {
  const descargas: Espias['descargas'] = [];
  const compartidos: Espias['compartidos'] = [];
  const navigator: NavigatorCompartir = {};
  const tarde: Espias['tarde'] = { resolver: () => {}, rechazar: () => {} };
  let reloj = 0;

  if (opciones.canShare !== undefined) {
    navigator.canShare = () => {
      if (opciones.canShare instanceof Error) throw opciones.canShare;
      return opciones.canShare;
    };
  }
  if (opciones.share === 'pendiente') {
    navigator.share = (datos) => {
      compartidos.push(datos);
      return new Promise<void>((resolver, rechazar) => {
        tarde.resolver = resolver;
        tarde.rechazar = rechazar;
      });
    };
  } else if (opciones.share) {
    navigator.share = async (datos) => {
      compartidos.push(datos);
      reloj = opciones.ms ?? 0;
      if (opciones.share === 'AbortError') {
        throw new DOMException(opciones.mensaje ?? 'El usuario canceló', 'AbortError');
      }
      if (opciones.share === 'otro') throw new Error('share no disponible');
    };
  }
  return { navigator, descargas, compartidos, ahora: () => reloj, tarde };
}

/** Dependencias reales de `entregarImagen`, con las banderas del espía. */
function entornoPrueba(opciones: Opciones = {}) {
  const e = espias(opciones);
  let descargaRota = false;
  let reinicios = 0;
  let desinstalados = 0;
  return {
    entorno: {
      navigator: e.navigator,
      descargar: (blob: Blob, nombre: string) => {
        if (descargaRota) throw new Error('no se pudo guardar');
        e.descargas.push({ blob, nombre });
      },
      hoja: {
        reiniciar: () => {
          reinicios += 1;
        },
        huboDialogo: () => opciones.dialogo ?? false,
        desinstalar: () => {
          desinstalados += 1;
        },
      },
      ahora: e.ahora,
      plazo: (): Promise<void> =>
        opciones.plazo ? Promise.resolve() : new Promise<void>(() => {}),
    },
    descargas: e.descargas,
    compartidos: e.compartidos,
    tarde: e.tarde,
    cuentaHoja: () => ({ reinicios, desinstalados }),
    romperDescarga: () => {
      descargaRota = true;
    },
  };
}

/** Deja pasar un ciclo de eventos para que se procesen los asentamientos tardíos. */
function reposar(): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, 0));
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
  const { entorno, descargas, compartidos, cuentaHoja } = entornoPrueba({ share: 'ok' }); // sin canShare
  const blob = blobPrueba();
  const r = await entregarImagen(blob, NOMBRE, entorno);

  assert.equal(r, 'guardado');
  assert.equal(compartidos.length, 0, 'no se intentó compartir');
  assert.equal(descargas.length, 1);
  assert.equal(descargas[0]?.nombre, NOMBRE);
  assert.equal(descargas[0]?.blob, blob);
  assert.equal(cuentaHoja().desinstalados, 1, 'sin compartir también se retiran los oyentes (D16)');
});

test('RF-3/D10: `canShare` que responde false => descarga, sin intentar `share`', async () => {
  const { entorno, descargas, compartidos } = entornoPrueba({ canShare: false, share: 'ok' });
  const r = await entregarImagen(blobPrueba(), NOMBRE, entorno);

  assert.equal(r, 'guardado');
  assert.equal(compartidos.length, 0);
  assert.equal(descargas.length, 1);
});

test('RF-3/D4: cancelar el diálogo (`AbortError`) devuelve `cancelado` y NO descarga', async () => {
  // El usuario llegó a ver la hoja y la cerró: D4 intacto (D14 lo exige comprobar).
  const { entorno, descargas, compartidos, cuentaHoja } = entornoPrueba({
    canShare: true,
    share: 'AbortError',
    dialogo: true,
    ms: 1200,
  });
  const r = await entregarImagen(blobPrueba(), NOMBRE, entorno);

  assert.equal(r, 'cancelado');
  assert.equal(compartidos.length, 1, 'sí se intentó compartir');
  assert.equal(descargas.length, 0, 'cancelar no dispara una descarga sorpresa');
  assert.deepEqual(cuentaHoja(), { reinicios: 1, desinstalados: 1 }, 'los oyentes se retiran');
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

// --- RF-11 / D14 / D15: el compartido que falla sin que aparezca ningún diálogo ---

test('RF-11: sin diálogo, el `AbortError` "Share failed" del navegador cae a la descarga', async () => {
  // Reproduce la incidencia: Chrome/Windows rechaza a los 30 018 ms sin abrir nada.
  const { entorno, descargas, compartidos } = entornoPrueba({
    canShare: true,
    share: 'AbortError',
    mensaje: 'Share failed',
    ms: 30018,
    dialogo: false,
  });
  const r = await entregarImagen(blobPrueba(), NOMBRE, entorno);

  assert.equal(r, 'guardado');
  assert.equal(compartidos.length, 1, 'sí se intentó compartir');
  assert.equal(descargas.length, 1, 'nunca queda sin la imagen');
});

test('RF-11: un `AbortError` instantáneo sin diálogo no pudo venir de un diálogo ⇒ descarga', async () => {
  // Rechazo en 0 ms: no dio tiempo a que el usuario viera y cerrara nada (D14).
  const { entorno, descargas } = entornoPrueba({
    canShare: true,
    share: 'AbortError',
    mensaje: 'Share canceled',
    ms: 0,
    dialogo: false,
  });
  const r = await entregarImagen(blobPrueba(), NOMBRE, entorno);

  assert.equal(r, 'guardado');
  assert.equal(descargas.length, 1);
});

test('RF-11/D14: sin foco perdido, "Share canceled" a los 900 ms sigue siendo cancelación', async () => {
  // Hoja renderizada dentro de la propia pestaña (p. ej. Android): no roba el foco,
  // pero el usuario sí eligió "cancelar" — no se le sorprende con una descarga (D4).
  const { entorno, descargas } = entornoPrueba({
    canShare: true,
    share: 'AbortError',
    mensaje: 'Share canceled',
    ms: 900,
    dialogo: false,
  });
  const r = await entregarImagen(blobPrueba(), NOMBRE, entorno);

  assert.equal(r, 'cancelado');
  assert.equal(descargas.length, 0);
});

test('RF-11/D15: pasado el plazo sin diálogo se descarga y el asentamiento tardío no la duplica', async () => {
  const { entorno, descargas, tarde, cuentaHoja } = entornoPrueba({
    canShare: true,
    share: 'pendiente',
    plazo: true,
    dialogo: false,
  });
  const r = await entregarImagen(blobPrueba(), NOMBRE, entorno);

  assert.equal(r, 'guardado');
  assert.equal(descargas.length, 1, 'no se esperan los 30 s del navegador');
  assert.deepEqual(cuentaHoja(), { reinicios: 1, desinstalados: 1 });

  tarde.rechazar(new DOMException('Share failed', 'AbortError'));
  await reposar();
  assert.equal(descargas.length, 1, 'una sola entrega aunque el navegador rechace tarde');

  const { entorno: entorno2, descargas: descargas2, tarde: tarde2 } = entornoPrueba({
    canShare: true,
    share: 'pendiente',
    plazo: true,
    dialogo: false,
  });
  assert.equal(await entregarImagen(blobPrueba(), NOMBRE, entorno2), 'guardado');
  tarde2.resolver();
  await reposar();
  assert.equal(descargas2.length, 1, 'una sola entrega aunque el navegador comparta tarde');
});

test('RF-11/D15: si el diálogo SÍ apareció, el plazo no dispara y se espera al usuario', async () => {
  const { entorno, descargas, compartidos, tarde } = entornoPrueba({
    canShare: true,
    share: 'pendiente',
    plazo: true,
    dialogo: true,
  });
  const promesa = entregarImagen(blobPrueba(), NOMBRE, entorno);

  await reposar();
  assert.equal(descargas.length, 0, 'el plazo no descarga mientras la hoja está a la vista');

  tarde.resolver();
  assert.equal(await promesa, 'compartido');
  assert.equal(descargas.length, 0);
  assert.equal(compartidos.length, 1);
});
