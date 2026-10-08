// T7 — Validación con triangulación y parada total (RF-2, RF-3, RF-4, RF-10, RF-13).
//
// Tres fuentes deben decir lo mismo antes de publicar un pensum:
//
//   sitio (manifiesto)  ↔  encabezado del PDF  ↔  suma de las filas extraídas
//
// Si alguna difiere, se acumula un **error con la carrera exacta y los tres valores**
// (RF-2/RF-3) y `publicable` queda en false: el orquestador aborta antes de escribir nada,
// nunca entrega un dataset parcial (RF-13, D2).
//
// Lo que **no** bloquea (queda como advertencia en el reporte):
//   * la plantilla virtual no publica totales en el encabezado ⇒ se contrasta sitio ↔ filas;
//   * las advertencias del parseo (p. ej. prerrequisito huérfano, RF-10 / D4).
//
// Y una categoría aparte: las **excepciones a RF-2 aprobadas por el usuario** y registradas en
// `EXCEPCIONES_RF2` con su tripleta exacta y su motivación. Tampoco son errores: van a
// `excepciones` y de ahí al reporte. Nunca son un patrón general, sino la carrera, el concepto
// y los tres valores concretos que se acordaron publicar.
//
// Función pura: sin red, reloj ni filesystem.

import type { Plan } from '../src/domain/tipos.ts';
import type { Totales } from './parsear.ts';

/** Un pensum ya parseado e identificado, con lo que falta por validar. */
export interface PendienteValidacion {
  /** `uvTotal` / `materiasTotal` son los valores que declara el **sitio** (manifiesto). */
  plan: Plan;
  /** Totales leídos del PDF: encabezado y suma real de las filas extraídas. */
  totales: Totales;
  /** Advertencias del parseo (huérfanos, secciones descartadas…) que deben reportarse. */
  advertencias: string[];
}

/** Excepción a RF-2 aprobada: una discrepancia concreta de la fuente que sí se publica. */
export interface ExcepcionRf2 {
  /** Clave única de carrera (`tipo|sede|plan|nombre`) a la que aplica. */
  clave: string;
  concepto: 'UV' | 'materias';
  /** Tripleta exacta de las tres fuentes: sitio, encabezado del PDF y suma de filas. */
  sitio: number;
  encabezado: number | null;
  filas: number;
  /** Valor que se publica en el dataset (la suma real de la grilla). */
  publicado: number;
  /** Motivo y aprobación: se transcribe al reporte de generación. */
  motivo: string;
}

/**
 * Única excepción aprobada a RF-2 (decisión del usuario, 2026-10-05).
 * Solo admite **esta** clave con **estos** tres valores: cualquier otra diferencia —misma
 * carrera u otros números— vuelve a ser error y detiene la publicación (RF-13).
 */
const EXCEPCIONES_RF2: readonly ExcepcionRf2[] = [
  {
    clave: 'ingenieria|soyapango|plan-2024|Ingeniería Eléctrica',
    concepto: 'UV',
    sitio: 162,
    encabezado: 162,
    filas: 163,
    publicado: 163,
    motivo:
      'La grilla del PDF oficial suma 163 UV en sus 40 materias mientras que la cabecera del ' +
      'PDF y el sitio publican 162; no hay celda contradictoria en todo el corpus (587 códigos ' +
      'consistentes entre sí), así que la discrepancia está en la fuente. Aprobada por el ' +
      'usuario el 2026-10-05: se publica la suma real de la grilla (163 UV) y esta diferencia ' +
      'queda documentada como la única excepción explícita a RF-2.',
  },
];

export interface ResultadoValidacion {
  errores: Error[];
  advertencias: string[];
  /** Excepciones a RF-2 que se aplicaron: van al reporte de generación. */
  excepciones: ExcepcionRf2[];
}

/** Nombre exacto del elemento para señalarlo en el error (RF-13). */
function etiqueta(plan: Plan): string {
  return `${plan.carrera} (${plan.sede} · ${plan.tipo} · ${plan.planVersion})`;
}

/** Clave única de carrera: tipo, sede, plan y nombre (RF-4). */
export function claveDeCarrera(plan: Plan): string {
  return `${plan.tipo}|${plan.sede}|${plan.planVersion}|${plan.carrera}`;
}

/**
 * Compara un total en las fuentes disponibles y, si difieren, acumula un error con los tres
 * valores y la diferencia. `encabezado` puede ser `null` (plantilla que no lo publica): en ese
 * caso solo se contrasta sitio ↔ filas.
 *
 * Único atajo: si la tripleta coincide **exactamente** con una excepción aprobada de
 * `EXCEPCIONES_RF2`, deja de ser error y se registra en `excepciones` (con su motivación)
 * para que el reporte la documente.
 */
function comparar(
  plan: Plan,
  concepto: 'UV' | 'materias',
  sitio: number,
  encabezado: number | null,
  filas: number,
  errores: Error[],
  excepciones: ExcepcionRf2[],
): void {
  if (encabezado !== null && sitio === encabezado && encabezado === filas) return;
  if (encabezado === null && sitio === filas) return;

  const valores = encabezado === null ? [sitio, filas] : [sitio, encabezado, filas];
  const diferencia = Math.max(...valores) - Math.min(...valores);
  const detalle =
    `${concepto} descuadradas — sitio=${sitio}, ` +
    `encabezado=${encabezado ?? '∅'}, filas=${filas} (diferencia ${diferencia}).`;

  const excepcion = EXCEPCIONES_RF2.find(
    (e) =>
      e.clave === claveDeCarrera(plan) &&
      e.concepto === concepto &&
      e.sitio === sitio &&
      e.encabezado === encabezado &&
      e.filas === filas,
  );
  if (excepcion) {
    // No es una advertencia sino una categoría propia: va a `excepciones` y de ahí al
    // reporte, con sus tres valores y su motivación. Duplicarla en `advertencias` solo
    // haría que el mismo texto salga dos veces en el informe.
    excepciones.push(excepcion);
    return;
  }

  errores.push(new Error(`${etiqueta(plan)}: ${detalle} No se publica el dataset.`));
}

/** Valida un pensum: triangulación de UV y de nº de materias, ids únicos y sus advertencias. */
function validarPensum(pendiente: PendienteValidacion): ResultadoValidacion {
  const { plan, totales } = pendiente;
  const errores: Error[] = [];
  const advertencias: string[] = [];
  const excepciones: ExcepcionRf2[] = [];

  if (totales.uvEncabezado === null || totales.materiasEncabezado === null) {
    advertencias.push(
      `${etiqueta(plan)}: el documento no publica los totales en el encabezado; ` +
        'se contrasta solo sitio ↔ suma de filas.',
    );
  }

  comparar(plan, 'UV', plan.uvTotal, totales.uvEncabezado, totales.uvSuma, errores, excepciones);
  comparar(
    plan,
    'materias',
    plan.materiasTotal,
    totales.materiasEncabezado,
    totales.materiasConteo,
    errores,
    excepciones,
  );

  // Un id repetido dentro del plan perdería notas guardadas (RF-11) ⇒ es error, no advertencia.
  const vistos = new Set<string>();
  for (const ciclo of plan.ciclos) {
    for (const asignatura of ciclo.asignaturas) {
      if (vistos.has(asignatura.id)) {
        errores.push(
          new Error(`${etiqueta(plan)}: id de asignatura duplicado "${asignatura.id}".`),
        );
      }
      vistos.add(asignatura.id);
    }
  }

  advertencias.push(...pendiente.advertencias);
  return { errores, advertencias, excepciones };
}

/**
 * Valida el conjunto completo a publicar. **Acumula** todos los errores (nunca se detiene en
 * el primero) para poder reportarlos todos en una sola corrida.
 */
export function validar(pendientes: PendienteValidacion[]): ResultadoValidacion {
  const errores: Error[] = [];
  const advertencias: string[] = [];
  const excepciones: ExcepcionRf2[] = [];

  for (const pendiente of pendientes) {
    const r = validarPensum(pendiente);
    errores.push(...r.errores);
    advertencias.push(...r.advertencias);
    excepciones.push(...r.excepciones);
  }

  // RF-4: dos carreras con (tipo, sede, plan, nombre) idénticos son el mismo registro.
  const claves = new Map<string, Plan>();
  for (const pendiente of pendientes) {
    const clave = claveDeCarrera(pendiente.plan);
    const previo = claves.get(clave);
    if (previo) {
      errores.push(
        new Error(
          `Clave de carrera duplicada "${clave}" entre "${previo.carrera}" y ` +
            `"${pendiente.plan.carrera}" (${pendiente.plan.sede} · ${pendiente.plan.planVersion}).`,
        ),
      );
    } else {
      claves.set(clave, pendiente.plan);
    }
  }

  return { errores, advertencias, excepciones };
}

/** Un solo error basta para detener toda la publicación (RF-13, D2). Las advertencias, no. */
export function publicable(resultado: ResultadoValidacion): boolean {
  return resultado.errores.length === 0;
}
