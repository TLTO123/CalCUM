// Entrega del PNG generado: compartirlo con el sistema o descargarlo (spec 003, RF-3).
//
// `navigator` y `descargar` llegan por parámetro (D6): toda la decisión —compartir,
// cancelar, caer a la descarga, fallar— se prueba en Node con dobles. En el navegador
// real los aporta `CumPanel.tsx`.

/** Resultado del intento de entrega, para que la interfaz anuncie qué pasó (RF-8). */
export type ResultadoEntrega = 'compartido' | 'guardado' | 'cancelado' | 'error';

/** Subconjunto de `Navigator` que se usa (un `Navigator` real lo cumple tal cual). */
export interface NavigatorCompartir {
  canShare?: (datos: { files: File[] }) => boolean;
  share?: (datos: { files: File[]; title?: string }) => Promise<void>;
}

export interface Entorno {
  navigator: NavigatorCompartir;
  /** Descarga local del PNG (en el navegador, un `<a download>` efímero). */
  descargar: (blob: Blob, nombre: string) => void;
}

/**
 * Entrega el PNG al usuario (RF-3, plan §4):
 *
 * - hay `canShare` y lo acepta → `share` → `compartido`;
 * - el usuario cancela (`AbortError`) → `cancelado`, **sin** descargar (D4);
 * - no hay soporte o `share` falla por otra razón → `descargar` → `guardado` (D10);
 * - si la descarga también revienta → `error` (RF-7), siempre como valor y nunca lanzando.
 */
export async function entregarImagen(
  blob: Blob,
  nombre: string,
  entorno: Entorno,
): Promise<ResultadoEntrega> {
  const archivo = new File([blob], nombre, { type: blob.type || 'image/png' });
  const datos = { files: [archivo] };

  if (puedeCompartir(entorno.navigator, datos)) {
    try {
      await entorno.navigator.share?.(datos);
      return 'compartido';
    } catch (error) {
      // Cancelación explícita del usuario: no se descarga nada (D4).
      if (esCancelacion(error)) return 'cancelado';
      // Cualquier otro fallo cae a la descarga para no perder la imagen (D10).
    }
  }

  try {
    entorno.descargar(blob, nombre);
    return 'guardado';
  } catch {
    return 'error';
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

function esCancelacion(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: string }).name === 'AbortError'
  );
}
