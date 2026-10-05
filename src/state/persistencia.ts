// Persistencia en localStorage (RF-11, RF-12 estructura, RF-16/P6).
// Solo {asignaturaId, nota} por clave de carrera. Nada sale de este almacen (sin red, sin servidor).
// Plan D2: JSON plano suficiente (≤ ~50 registros por carrera); D7: persistir en CADA cambio.

import type { RegistroNota } from '../domain/tipos.ts';

/** Interfaz mínima de almacenamiento (permite un Storage falso en tests). */
export interface Almacen {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
}

/** Una sola clave raíz; dentro, una entrada por carrera. */
export const ALMACEN_DEFECTO = 'calcum-udb:v1';

/** Forma guardada: { [claveCarrera]: { [asignaturaId]: nota } } */
type BlobGuardado = Record<string, Record<string, number>>;

function leerBlob(almacen: Almacen): BlobGuardado {
  const crudo = almacen.getItem(ALMACEN_DEFECTO);
  if (crudo === null) return {};
  try {
    const datos: unknown = JSON.parse(crudo);
    if (typeof datos !== 'object' || datos === null || Array.isArray(datos)) return {};
    return datos as BlobGuardado;
  } catch {
    // Almacenamiento corrupto: no romper el arranque; se ignora y se reconstruye (decisión T7).
    return {};
  }
}

function escribirBlob(almacen: Almacen, blob: BlobGuardado): void {
  almacen.setItem(ALMACEN_DEFECTO, JSON.stringify(blob));
}

/** RF-11: registros de una carrera; [] si no hay nada. */
export function leerRegistros(almacen: Almacen, claveCarrera: string): RegistroNota[] {
  const entradas = leerBlob(almacen)[claveCarrera];
  if (!entradas) return [];
  return Object.entries(entradas).map(([asignaturaId, nota]) => ({ asignaturaId, nota }));
}

/** RF-11: guarda los registros de UNA carrera bajo su clave (tipo|sede|planVersion). */
export function escribirRegistros(
  almacen: Almacen,
  claveCarrera: string,
  registros: RegistroNota[],
): void {
  const blob = leerBlob(almacen);
  // Normaliza a la forma mínima {id: nota} (P6: no persistir campos extra).
  blob[claveCarrera] = Object.fromEntries(registros.map((r) => [r.asignaturaId, r.nota]));
  escribirBlob(almacen, blob);
}

/** Claves de carreras con datos guardados (para restaurar sesiones). */
export function listarClavesDeCarrera(almacen: Almacen): string[] {
  return Object.keys(leerBlob(almacen)).filter(
    (clave) => Object.keys(leerBlob(almacen)[clave] ?? {}).length > 0,
  );
}
