// T6 — Identificadores estables (RF-11, decisión D8 del plan).
//
//   id = sede:tipo:plan:slug(carrera):ciclo:código
//
// Reglas:
//   * Solo entran campos que la UDB **no reordena**. Nada de posición de fila, índice global
//     ni fecha: si el pensum crece, las notas guardadas deben seguir apuntando a la misma
//     materia (RF-11).
//   * El **ciclo** va en el id porque el PDF oficial de Administración repite el código
//     `EDN902` en dos materias distintas (ciclo 3 y ciclo 7): sin el segmento de ciclo
//     colisionarían y las notas de una se aplicarían a la otra.
//   * Las electivas no tienen código (`-`): su bloque es `electiva-<orden>`, con el orden
//     contado **dentro de su ciclo** (1-based), de modo que un cambio en otro ciclo no las
//     desplaza (el ciclo ya lleva su propio segmento).
//   * `slugificar` baja a minúsculas, quita acentos y todo lo que no sea `[a-z0-9]` pasa a
//     `-`: así el id no depende de mayúsculas/acentos del nombre publicado y nunca puede
//     romper el formato con `:` o espacios.
//
// Función pura: sin red, reloj ni filesystem.

import type { AsignaturaCruda, CicloCrudo } from './parsear.ts';

/** Metadatos de la carrera de los que depende el id (los del manifiesto). */
export interface MetaCarrera {
  carrera: string;
  sede: string;
  tipo: string;
  plan: string;
}

export interface AsignaturaConId extends AsignaturaCruda {
  id: string;
}

export interface CicloConId {
  numero: number;
  asignaturas: AsignaturaConId[];
}

/** Minúsculas, sin acentos, separadores no alfanuméricos → `-`, sin `:` ni espacios. */
export function slugificar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** `sede:tipo:plan:slug(carrera)` — el prefijo compartido por todas las materias de un plan. */
export function prefijoDePlan(meta: MetaCarrera): string {
  return [meta.sede, meta.tipo, meta.plan, meta.carrera].map(slugificar).join(':');
}

/**
 * Id de una asignatura: prefijo del plan + ciclo + código. `orden` solo se usa con las
 * electivas sin código: es su posición dentro del ciclo (1-based).
 */
export function identificar(meta: MetaCarrera, codigo: string, ciclo: number, orden: number): string {
  const prefijo = prefijoDePlan(meta);
  const limpio = (codigo ?? '').trim().toUpperCase();
  // Sin código fijo (`-`, vacío) ⇒ electiva: identificada por ciclo y orden dentro del ciclo.
  if (!limpio || limpio === '-') {
    return `${prefijo}:${ciclo}:electiva-${orden}`;
  }
  return `${prefijo}:${ciclo}:${limpio}`;
}

/** Deriva los ids de todos los ciclos de un pensum (el `orden` sale de la posición en el ciclo). */
export function identificarCiclos(meta: MetaCarrera, ciclos: CicloCrudo[]): CicloConId[] {
  return ciclos.map((ciclo) => ({
    numero: ciclo.numero,
    asignaturas: ciclo.asignaturas.map((asignatura, i) => ({
      ...asignatura,
      id: identificar(meta, asignatura.codigo, ciclo.numero, i + 1),
    })),
  }));
}
