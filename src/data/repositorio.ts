// Repositorio de planes (plan.md §1, D6): datos inyectables vía fixtures mientras la
// spec 002 no entregue data/planes/*.json. P2: un JSON corrupto FALLA con error Zod, nunca en silencio.

import { esquemaPlan } from './esquema.ts';
import fixtures from './fixtures/planes.json' with { type: 'json' };
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

/** Clave única de una carrera: (tipo, sede, planVersion) — nunca solo el nombre (AGENTS.md). */
export function claveDePlan(plan: Plan): string {
  return `${plan.tipo}|${plan.sede}|${plan.planVersion}`;
}

/** Índice por clave única; homónimos (presencial vs. virtual) no colisionan (RF-11). */
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
 * Planes disponibles en la v1 (fixtures mientras la spec 002 genera data/planes/).
 * Se validan al cargar: un fixture corrupto rompe el arranque ruidosamente.
 */
export function planesIniciales(): Plan[] {
  return cargarPlanes(fixtures.planes);
}
