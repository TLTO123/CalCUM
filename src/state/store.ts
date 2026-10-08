// Store de la aplicación (plan D2): registros por clave de carrera + selección activa.
// Usa zustand/vanilla para ser testeable en Node sin React (P5); el binding de React se agrega en T8+.
// RF-11 (clave), RF-12 (estructura de restauración), RF-16/P6: sin red, solo {asignaturaId, nota}.

import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import type { RegistroNota } from '../domain/tipos.ts';
import { escribirRegistros, leerRegistros, listarClavesDeCarrera, type Almacen } from './persistencia.ts';

export interface EstadoStore {
  /** Clave (tipo|sede|planVersion|nombre) de la carrera seleccionada, o null (RF-10: sin selección). */
  claveActiva: string | null;
  /** Notas por carrera: { claveCarrera: { asignaturaId: nota } }. */
  registros: Record<string, Record<string, number>>;

  seleccionarCarrera(clave: string | null): void;
  setearNota(claveCarrera: string, asignaturaId: string, nota: number): void;
  eliminarNota(claveCarrera: string, asignaturaId: string): void;
  /** Registros de una carrera en orden de inserción (RF-11 / repitencia: última nota gana). */
  registrosDe(claveCarrera: string): RegistroNota[];
}

/**
 * Crea el store hidratado desde el almacenamiento.
 * `almacen` es inyectable para testear sin localStorage (D6).
 */
export function crearStore(almacen: Almacen): StoreApi<EstadoStore> {
  // Hidratación: todas las carreras guardadas quedan en memoria (RF-12: restaurar al volver).
  const registros: Record<string, Record<string, number>> = {};
  const crudo = almacen.getItem('calcum-udb:v1');
  if (crudo !== null) {
    try {
      const datos: unknown = JSON.parse(crudo);
      if (typeof datos === 'object' && datos !== null && !Array.isArray(datos)) {
        for (const [clave, entradas] of Object.entries(datos as Record<string, unknown>)) {
          if (typeof entradas === 'object' && entradas !== null && !Array.isArray(entradas)) {
            registros[clave] = entradas as Record<string, number>;
          }
        }
      }
    } catch {
      // Corrupto: arrancar vacío (no romper el arranque).
    }
  }

  return createStore<EstadoStore>((set, get) => ({
    claveActiva: null,
    registros,

    seleccionarCarrera(clave) {
      set({ claveActiva: clave });
    },

    setearNota(claveCarrera, asignaturaId, nota) {
      const actuales = get().registros[claveCarrera] ?? {};
      // Map lógico: sobrescribir = última nota gana (repitencia), una sola entrada.
      const actualizados = { ...actuales, [asignaturaId]: nota };
      set((estado) => ({ registros: { ...estado.registros, [claveCarrera]: actualizados } }));
      persistir(almacen, claveCarrera, actualizados);
    },

    eliminarNota(claveCarrera, asignaturaId) {
      const actuales = { ...(get().registros[claveCarrera] ?? {}) };
      delete actuales[asignaturaId];
      set((estado) => ({ registros: { ...estado.registros, [claveCarrera]: actuales } }));
      persistir(almacen, claveCarrera, actuales);
    },

    registrosDe(claveCarrera) {
      const entradas = get().registros[claveCarrera] ?? {};
      return Object.entries(entradas).map(([asignaturaId, nota]) => ({ asignaturaId, nota }));
    },
  }));
}

function persistir(
  almacen: Almacen,
  claveCarrera: string,
  entradas: Record<string, number>,
): void {
  const registros: RegistroNota[] = Object.entries(entradas).map(([asignaturaId, nota]) => ({
    asignaturaId,
    nota,
  }));
  escribirRegistros(almacen, claveCarrera, registros);
}

// Store singleton para la app (el binding de React lo consume en T8+).
export const storeApp = typeof globalThis.localStorage === 'undefined'
  ? undefined
  : crearStore(globalThis.localStorage);

// Reexporta para que la UI no importe de persistencia directamente.
export { leerRegistros, listarClavesDeCarrera };
