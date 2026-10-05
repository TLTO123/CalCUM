import { z } from 'zod';

// Esquema Zod del contrato Plan (plan.md §1): valida el JSON al cargarlo (P2: fallar ruidosamente).

export const esquemaAsignatura = z.object({
  id: z.string().min(1),
  codigo: z.string().min(1),
  nombre: z.string().min(1),
  uv: z.number().positive(),
  prerrequisito: z.string().nullable(),
  electiva: z.boolean(),
  laboratorio: z.boolean(),
});

export const esquemaCiclo = z.object({
  numero: z.number().int().positive(),
  asignaturas: z.array(esquemaAsignatura),
});

export const esquemaPlan = z.object({
  carrera: z.string().min(1),
  sede: z.enum(['soyapango', 'antiguo-cuscatlan', 'virtual']),
  tipo: z.enum(['ingenieria', 'licenciatura', 'tecnico', 'profesorado']),
  planVersion: z.string().min(1),
  modalidad: z.string().min(1),
  uvTotal: z.number().positive(),
  materiasTotal: z.number().int().positive(),
  ciclos: z.array(esquemaCiclo).min(1),
});

export type PlanParseado = z.infer<typeof esquemaPlan>;
