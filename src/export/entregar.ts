// Entrega del PNG generado: compartirlo con el sistema o descargarlo (spec 003, RF-3, RF-11).
//
// `navigator`, `descargar` y el resto de las dependencias llegan por parámetro (D6): toda la
// decisión —compartir, cancelar, caer a la descarga, fallar— se prueba en Node con dobles. En el
// navegador real los aporta `CumPanel.tsx`.
//
// RF-11/D14: un `AbortError` no alcanza para saber qué pasó — el navegador lo devuelve tanto
// cuando el usuario cancela como cuando no pudo abrir nada. Por eso el intento se acompaña de la
// hoja testigo (`src/export/hoja.ts`, foco/visibilidad de la pestaña), un reloj y un plazo.

import type { Hoja } from './hoja.ts';

/** Resultado del intento de entrega, para que la interfaz anuncie qué pasó (RF-8). */
export type ResultadoEntrega = 'compartido' | 'guardado' | 'cancelado' | 'error';

/** Subconjunto de `Navigator` que se usa (un `Navigator` real lo cumple tal cual). */
export interface NavigatorCompartir {
  canShare?: (datos: { files: File[] }) => boolean;
  share?: (datos: { files: File[]; title?: string }) => Promise<void>;
}

/**
 * Tiempo (ms) que se espera al navegador **sin que aparezca ningún diálogo** antes de rendirse y
 * descargar: el caso medido rechazó a los 30 018 ms sin abrir nada (RF-11, D15).
 */
export const PLAZO_COMPARTIR_MS = 5000;

/**
 * Un rechazo de cancelación más rápido que esto no pudo venir de un diálogo que el usuario vio
 * y cerró (D14): un diálogo real tarda en aparecer milisegundos.
 */
export const MINIMO_DIALOGO_MS = 300;

export interface Entorno {
  navigator: NavigatorCompartir;
  /** Descarga local del PNG (en el navegador, un `<a download>` efímero). */
  descargar: (blob: Blob, nombre: string) => void;
  /**
   * Testigo de "¿hubo un diálogo de compartir?" (D14) — lo crea `src/export/hoja.ts`.
   * Sin él manda el mensaje del error y el plazo, que es un escalón más conservador.
   */
  hoja?: Hoja;
  /** Reloj en ms para medir cuánto tardó el rechazo (D14). Por defecto `Date.now`. */
  ahora?: () => number;
  /** `plazo(ms)` resuelve cuando vence el tiempo límite (D15). Por defecto `setTimeout`. */
  plazo?: (ms: number) => Promise<void>;
}

type Caso = { estado: 'exito' } | { estado: 'fallo'; error: unknown } | { estado: 'plazo' };

/**
 * Entrega el PNG al usuario (RF-3, RF-11, plan §4):
 *
 * - hay `canShare` y lo acepta → `share` → `compartido`;
 * - el usuario cancela **viendo el diálogo** — o con una cancelación tardía en una hoja que no
 *   roba foco → `cancelado`, **sin** descargar (D4);
 * - `share` falla **sin que aparezca el diálogo**: otro error, un `AbortError` que no es de
 *   cancelación o 5 s de silencio → `descargar` → `guardado` (D10 y RF-11);
 * - si la descarga también revienta → `error` (RF-7), siempre como valor y nunca lanzando.
 *
 * Los oyentes de la hoja se retiran en todos los caminos de salida (D16).
 */
export async function entregarImagen(
  blob: Blob,
  nombre: string,
  entorno: Entorno,
): Promise<ResultadoEntrega> {
  const ahora = entorno.ahora ?? Date.now;
  const guardar = (): ResultadoEntrega => {
    try {
      entorno.descargar(blob, nombre);
      return 'guardado';
    } catch {
      return 'error';
    }
  };

  try {
    const archivo = new File([blob], nombre, { type: blob.type || 'image/png' });
    const datos = { files: [archivo] };

    if (!puedeCompartir(entorno.navigator, datos)) return guardar();

    entorno.hoja?.reiniciar();
    const inicio = ahora();
    const intento = entorno.navigator.share?.(datos) ?? Promise.resolve();
    // Un asentamiento posterior al plazo no cuenta como un rechazo sin atender (D15).
    intento.catch(() => undefined);

    const enEspera = intento.then(
      (): Caso => ({ estado: 'exito' }),
      (error: unknown): Caso => ({ estado: 'fallo', error }),
    );
    const limite = plazoDe(entorno, PLAZO_COMPARTIR_MS).then(
      (): Caso => ({ estado: 'plazo' }),
    );

    let caso = await Promise.race([enEspera, limite]);

    if (caso.estado === 'plazo') {
      // 5 s sin que se abriera nada: el navegador no va a poder compartir (RF-11).
      if (!entorno.hoja?.huboDialogo()) return guardar();
      // La hoja está a la vista y el usuario decide: se espera su respuesta (D15).
      caso = await enEspera;
    }

    if (caso.estado === 'fallo') {
      if (esCancelacionDetectada(caso.error, ahora() - inicio, entorno.hoja)) {
        return 'cancelado'; // el usuario vio el diálogo y lo cerró (D4)
      }
      return guardar(); // fallo sin diálogo ⇒ RF-11 · cualquier otro error ⇒ D10
    }

    return 'compartido';
  } finally {
    entorno.hoja?.desinstalar(); // la hoja solo vive durante el intento (D16)
  }
}

/** `canShare` puede faltar o lanzar en navegadores viejos: eso no debe romper el flujo. */
function puedeCompartir(navigator: NavigatorCompartir, datos: { files: File[] }): boolean {
  if (typeof navigator.canShare !== 'function' || typeof navigator.share !== 'function') {
    return false;
  }
  try {
    return navigator.canShare(datos);
  } catch {
    return false;
  }
}

function plazoDe(entorno: Entorno, ms: number): Promise<void> {
  return entorno.plazo ? entorno.plazo(ms) : new Promise((resolver) => setTimeout(resolver, ms));
}

/**
 * ¿Este `AbortError` es el usuario cerrando un diálogo de compartir? (D14)
 *
 * 1. Hubo diálogo (foco/visibilidad perdidos) → sí: él lo cerró.
 * 2. Sin foco perdido, un rechazo instantáneo no pudo venir de nada que el usuario viera.
 * 3. Sin foco perdido, solo manda el mensaje: "Share canceled" de una hoja dentro de la
 *    pestaña (Android) cuenta como cancelación; "Share failed" y demás, no.
 */
function esCancelacionDetectada(error: unknown, transcurrido: number, hoja?: Hoja): boolean {
  if (!esAbortError(error)) return false;
  if (hoja?.huboDialogo()) return true;
  if (transcurrido < MINIMO_DIALOGO_MS) return false;
  return /cancel/i.test(mensajeDe(error));
}

function esAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: string }).name === 'AbortError'
  );
}

function mensajeDe(error: unknown): string {
  const mensaje = (error as { message?: unknown } | null)?.message;
  return typeof mensaje === 'string' ? mensaje : '';
}
