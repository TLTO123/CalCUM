// Selección en cascada Tipo → Sede → Carrera (RF-1, RF-2, RF-3).
// P5: funciones puras sobre el índice de planes; sin UI ni almacenamiento.

import type { Plan, Sede, TipoCarrera } from './tipos.ts';

/** Orden estable y determinista para mostrar las opciones en la UI. */
function ordenar<T extends string>(valores: T[]): T[] {
  return [...valores].sort((a, b) => a.localeCompare(b));
}

/** RF-1: sedes que ofrecen al menos una carrera del tipo dado ([] si no hay oferta). */
export function sedesParaTipo(planes: Plan[], tipo: TipoCarrera): Sede[] {
  const sedes = new Set<Sede>();
  for (const plan of planes) {
    if (plan.tipo === tipo) sedes.add(plan.sede);
  }
  return ordenar([...sedes]);
}

/** RF-2: carreras que existen para la combinación (tipo, sede), en orden alfabético. */
export function carrerasPara(planes: Plan[], tipo: TipoCarrera, sede: Sede): Plan[] {
  const resultado = planes.filter((p) => p.tipo === tipo && p.sede === sede);
  return resultado.sort((a, b) => a.carrera.localeCompare(b.carrera, 'es'));
}

/** Tipos con al menos una carrera en el índice (para poblar el primer select). */
export function tiposDisponibles(planes: Plan[]): TipoCarrera[] {
  const tipos = new Set<TipoCarrera>();
  for (const plan of planes) tipos.add(plan.tipo);
  return ordenar([...tipos]);
}
