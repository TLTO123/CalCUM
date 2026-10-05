// Contrato de datos del dominio (P5: sin imports de UI ni de almacenamiento).

/** Sede según la agrupación real del sitio UDB (no confundir con "modalidad"). */
export type Sede = 'soyapango' | 'antiguo-cuscatlan' | 'virtual';

/** Tipo de carrera de pregrado (alcance v1: sin maestrías ni doctorados). */
export type TipoCarrera = 'ingenieria' | 'licenciatura' | 'tecnico' | 'profesorado';

/**
 * Asignatura del pensum. `id` es estable y único dentro del plan
 * (prefijo con sede:tipo:planVersion para evitar colisiones entre homónimos).
 */
export interface Asignatura {
  id: string;
  codigo: string;
  nombre: string;
  uv: number;
  /** Prerrequisito textual del pensum, o null si no tiene ("—" en la UI). */
  prerrequisito: string | null;
  electiva: boolean;
  laboratorio: boolean;
}

/** Ciclo académico (I…X) con sus asignaturas. */
export interface Ciclo {
  numero: number;
  asignaturas: Asignatura[];
}

/**
 * Pensum de una carrera. Clave única: (tipo, sede, planVersion) — nunca solo el nombre,
 * porque existen homónimos con UV distintos (presencial vs. virtual).
 */
export interface Plan {
  carrera: string;
  sede: Sede;
  tipo: TipoCarrera;
  planVersion: string;
  modalidad: string;
  /** Total oficial publicado por la UDB en el PDF (validado contra Σ UV en la spec 002). */
  uvTotal: number;
  /** Total oficial de materias publicado por la UDB. */
  materiasTotal: number;
  ciclos: Ciclo[];
}

/** Registro de una nota capturada por el estudiante. */
export interface RegistroNota {
  asignaturaId: string;
  nota: number;
}

/** Resultado del cálculo del C.U.M (RF-9, RF-10). */
export interface CumResult {
  /** Redondeado a 2 decimales; null cuando no hay materias cursadas (sin división entre cero). */
  cum: number | null;
  sumaUM: number;
  sumaUV: number;
  contadas: number;
  aprobadas: number;
  reprobadas: number;
}

/** Nota mínima para aprobar (decisión del usuario; indicador visual, no altera la fórmula). */
export const NOTA_MINIMA_APROBACION = 6;

/** Rango de la escala de notas (decimales 1–10). */
export const NOTA_MIN = 1;
export const NOTA_MAX = 10;
