// Repositorio de planes (plan.md §1, D6): la app lee `data/planes.json`, el dataset completo
// que publica `npm run datos` (spec 002, RF-14). P2: un JSON corrupto FALLA con error Zod,
// nunca en silencio — el contrato se exige aquí, no en cada componente (RNF-2).

import { esquemaPlan } from './esquema.ts';
import datosPublicados from '../../data/planes.json' with { type: 'json' };
import type { Plan } from '../domain/tipos.ts';

/**
 * Valida datos crudos y devuelve los planes parseados.
 * Lanza si los datos no son un array de planes válidos (fallar ruidosamente).
 */
export function cargarPlanes(datosCrudos: unknown): Plan[] {
  if (!Array.isArray(datosCrudos)) {
    throw new Error('El dataset debe ser un arreglo de planes');
  }
  const planes: Plan[] = [];
  for (const [indice, candidato] of datosCrudos.entries()) {
    const resultado = esquemaPlan.safeParse(candidato);
    if (!resultado.success) {
      const detalle = resultado.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      throw new Error(`Plan inválido en la posición ${indice}: ${detalle}`);
    }
    planes.push(resultado.data as Plan);
  }
  return planes;
}

/**
 * Clave única de una carrera: **(tipo, sede, planVersion, nombre)** — RF-4 (spec 002).
 *
 * El nombre **entra** en la clave, al revés de lo que decía la spec 001: en la oferta real
 * el `(tipo, sede, plan)` solo no basta. En `data/planes.json` hay **11 grupos** con varias
 * carreras bajo la misma tripleta — 8 ingenierías de Soyapango `plan-2024` (164, 163, 162,
 * 161, 163, 162, 160, 161 UV) comparten `ingenieria|soyapango|plan-2024`. Sin el nombre,
 * `indicePorClave` lanzaría "Clave duplicada" al arrancar y las notas de una carrera se
 * aplicarían a otra.
 *
 * El nombre también hace de homónimo entre sedes/modalidades: Ing. en Ciencias de la
 * Computación son dos carreras distintas (161 UV/40 materias presencial frente a
 * 176 UV/44 materias virtual) y los 4 campos las separan sin ambigüedad.
 */
export function claveDePlan(plan: Plan): string {
  return `${plan.tipo}|${plan.sede}|${plan.planVersion}|${plan.carrera}`;
}

/** Índice por clave única; dos carreras con la misma clave (RF-4) lanzan ruidosamente. */
export function indicePorClave(planes: Plan[]): Map<string, Plan> {
  const indice = new Map<string, Plan>();
  for (const plan of planes) {
    const clave = claveDePlan(plan);
    if (indice.has(clave)) {
      throw new Error(`Clave duplicada en el dataset: ${clave}`);
    }
    indice.set(clave, plan);
  }
  return indice;
}

/**
 * Las 59 carreras de pregrado publicadas por `npm run datos`.
 * Se validan al cargar: un dataset corrupto o incompleto rompe el arranque ruidosamente
 * (P2), en lugar de mostrar una cascada a medias.
 */
export function planesIniciales(): Plan[] {
  return cargarPlanes(datosPublicados);
}
