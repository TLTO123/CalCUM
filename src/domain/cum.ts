// Cálculo del C.U.M (RF-7/RF-9/RF-10/RF-14) — constitución P1.
// P5: función pura; sin imports de UI ni de almacenamiento.

import type { CumResult, Plan, RegistroNota } from './tipos.ts';
import { NOTA_MINIMA_APROBACION } from './tipos.ts';

/** Redondea a 2 decimales (RF-9) de forma estable frente a errores de coma flotante. */
function aDosDecimales(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula el C.U.M de un plan dado un conjunto de registros de nota.
 *
 *   U.M (materia i) = Nota_i × UV_i
 *   C.U.M           = Σ (Nota_i × UV_i) / Σ UV_i   sobre TODAS las materias cursadas (P1)
 *
 * - Repitencia: una materia registrada más de una vez cuenta UNA sola vez con su ÚLTIMA nota
 *   (la del final del arreglo), y sus UV entran UNA vez al denominador.
 * - 0 materias cursadas ⇒ cum = null (sin división entre cero, RF-10).
 * - Lanza si un asignaturaId no existe en el plan (fallar ruidoso, P2).
 */
export function calcularCum(plan: Plan, registros: RegistroNota[]): CumResult {
  // Índice de UV por asignatura del plan.
  const uvPorId = new Map<string, number>();
  for (const ciclo of plan.ciclos) {
    for (const asignatura of ciclo.asignaturas) {
      uvPorId.set(asignatura.id, asignatura.uv);
    }
  }

  // Dedupe: última nota gana (recorremos en orden; cada asignatura sobrescribe la anterior).
  const ultimaNota = new Map<string, number>();
  for (const registro of registros) {
    ultimaNota.set(registro.asignaturaId, registro.nota);
  }

  let sumaUM = 0;
  let sumaUV = 0;
  let aprobadas = 0;
  let reprobadas = 0;

  for (const [asignaturaId, nota] of ultimaNota) {
    const uv = uvPorId.get(asignaturaId);
    if (uv === undefined) {
      throw new Error(`Asignatura desconocida en el plan: ${asignaturaId}`);
    }
    sumaUM += nota * uv;
    sumaUV += uv;
    if (nota >= NOTA_MINIMA_APROBACION) aprobadas += 1;
    else reprobadas += 1;
  }

  const contadas = ultimaNota.size;
  const cum = sumaUV === 0 ? null : aDosDecimales(sumaUM / sumaUV);

  return { cum, sumaUM, sumaUV, contadas, aprobadas, reprobadas };
}
