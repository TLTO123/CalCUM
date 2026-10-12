// T7/T4 — Validación con triangulación, control de nombres y parada total
// (RF-2, RF-3, RF-4, RF-5, RF-7, RF-10, RF-13).
//
// Tres fuentes deben decir lo mismo antes de publicar un pensum:
//
//   sitio (manifiesto)  ↔  encabezado del PDF  ↔  suma de las filas extraídas
//
// Si alguna difiere, se acumula un **error con la carrera exacta y los tres valores**
// (RF-2/RF-3) y `publicable` queda en false: el orquestador aborta antes de escribir nada,
// nunca entrega un dataset parcial (RF-13, D2).
//
// El **control de nombres** (RF-5) es el mismo trato aplicado a `nombre`: cinco reglas
// objetivas sobre el texto, sin diccionario, y cualquiera por separado detiene la publicación
// señalando carrera, código y ciclo (RF-4). Mide sobre el nombre tal cual se publicaría: si el
// saneado de RF-1 falló, lo atrapa aquí.
//
// Lo que **no** bloquea (queda como advertencia en el reporte):
//   * la plantilla virtual no publica totales en el encabezado ⇒ se contrasta sitio ↔ filas;
//   * las advertencias del parseo (p. ej. prerrequisito huérfano, RF-10 / D4);
//   * el mismo código con nombres **muy distintos** en dos planes (RF-7): es pista, no prueba;
//     manda el documento y hay que cotejar los dos.
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

// --- RF-4 / RF-5: control de nombres --------------------------------------------------------

/** Glifos que no son texto sino restos de la grilla del PDF: jamás deben publicarse. */
const GLIFOS_PROHIBIDOS = /[|¦[\]{}¡!]/;

/**
 * Preposiciones y conjunciones sueltas. Si una asignatura **termina** en una, el nombre está
 * truncado por la derecha (`Administración de`). Sin `\b`: en JS esa frontera es ASCII y la `ñ`
 * la rompe (medido: 13 falsos positivos), así que se mira el último token directamente.
 */
const FIN_DE_NOMBRE = new Set([
  'de', 'del', 'la', 'el', 'y', 'e', 'en', 'con', 'para', 'por', 'al',
  'los', 'las', 'un', 'una', 'o',
]);

/**
 * Aplica las cinco reglas de RF-5 a un nombre y devuelve los motivos concretos por los que no
 * debe publicarse (lista vacía ⇒ nombre correcto). Reglas sobre el **texto tal cual**: ninguna
 * mira el diccionario, solo la estructura que el daño del OCR deja al descubierto.
 */
function motivosDe(nombre: string): string[] {
  const texto = nombre.trim();
  if (texto === '') return ['está vacío y ninguna asignatura se publica sin nombre (RF-4)'];

  const motivos: string[] = [];
  if (texto.length < 4) {
    motivos.push(`mide ${texto.length} caracteres y hacen falta al menos 4`);
  }
  const glifo = texto.match(GLIFOS_PROHIBIDOS);
  if (glifo) {
    motivos.push(`contiene el glifo «${glifo[0]}», resto de la grilla y no texto (RF-2)`);
  }
  if (/\s{2,}/.test(nombre)) motivos.push('tiene espacios dobles');
  if (nombre !== texto) motivos.push('tiene espacios en los extremos');
  if (/^[a-záéíóúüñ]/.test(texto)) {
    motivos.push('no empieza en mayúscula: posible nombre truncado por la izquierda');
  }

  // Último token con la puntuación final aparte: «Administración de .» también está truncado.
  const ultimo = texto.toLowerCase().split(/\s+/).pop()!.replace(/[.,;:]+$/, '');
  if (FIN_DE_NOMBRE.has(ultimo)) {
    motivos.push(
      `termina en la preposición o conjunción «${ultimo}»: posible nombre truncado por la derecha`,
    );
  }
  return motivos;
}

/**
 * RF-4/RF-5: un nombre que incumple alguna de las cinco reglas detiene la publicación con el
 * mismo trato que un descuadre de UV, y el mensaje lleva carrera, código y ciclo para poder ir
 * directo a la asignatura. Devuelve solo errores: RF-5 no tiene nivel de advertencia (la
 * divergencia entre planes, que sí avisa, es RF-7 y necesita todos los planes: `validar`).
 */
export function revisarNombres(plan: Plan): Error[] {
  const errores: Error[] = [];
  for (const ciclo of plan.ciclos) {
    for (const asignatura of ciclo.asignaturas) {
      const motivos = motivosDe(asignatura.nombre);
      if (motivos.length === 0) continue;
      errores.push(
        new Error(
          `${etiqueta(plan)}: ciclo ${ciclo.numero}, ${asignatura.codigo}: el nombre ` +
            `«${asignatura.nombre}» ${motivos.join('; ')}. No se publica el dataset.`,
        ),
      );
    }
  }
  return errores;
}

// --- RF-7: divergencia entre planes ---------------------------------------------------------

/** Minúsculas y sin acentos ni puntuación: que ni las tildes ni las mayúsculas disfracen la
 * comparación de dos nombres del mismo código en planes distintos. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Palabras con las que se compara: las de 1 letra (`y`, `e`, `a`) no dicen nada de un nombre. */
function palabras(texto: string): Set<string> {
  return new Set(normalizar(texto).split(' ').filter((p) => p.length >= 2));
}

/** Solape de palabras entre dos nombres: 1 = idénticos, 0 = ninguna en común. `null` = no hay
 * con qué comparar (un nombre sin palabras de 2+ letras) y entonces no se juzga. */
function solape(a: string, b: string): number | null {
  const A = palabras(a);
  const B = palabras(b);
  if (A.size === 0 || B.size === 0) return null;
  const comunes = [...A].filter((p) => B.has(p)).length;
  return comunes / Math.max(A.size, B.size);
}

/**
 * RF-7: el mismo código con nombres muy distintos en **planes distintos** ⇒ advertencia, nunca
 * error. Uno de los dos pudo salir mal y el control no puede saber cuál: manda el documento.
 *
 * No compara dentro de un mismo plan (la UDB reusa códigos entre sus ciclos: `EDN902` es
 * legítimo) ni los `-` de las electivas, que comparten ese código sin ser la misma materia.
 */
export function advertirDivergencias(pendientes: PendienteValidacion[]): string[] {
  const porCodigo = new Map<string, Array<{ plan: Plan; ciclo: number; nombre: string }>>();
  for (const { plan } of pendientes) {
    for (const ciclo of plan.ciclos) {
      for (const asignatura of ciclo.asignaturas) {
        if (asignatura.codigo === '-') continue;
        const grupo = porCodigo.get(asignatura.codigo) ?? [];
        grupo.push({ plan, ciclo: ciclo.numero, nombre: asignatura.nombre });
        porCodigo.set(asignatura.codigo, grupo);
      }
    }
  }

  const avisos: string[] = [];
  for (const [codigo, grupo] of porCodigo) {
    for (let i = 0; i < grupo.length; i++) {
      for (let j = i + 1; j < grupo.length; j++) {
        const x = grupo[i]!;
        const y = grupo[j]!;
        if (claveDeCarrera(x.plan) === claveDeCarrera(y.plan)) continue;
        const v = solape(x.nombre, y.nombre);
        if (v === null || v >= 0.5) continue;
        avisos.push(
          `Nombres divergentes para ${codigo}: «${x.nombre}» en ${etiqueta(x.plan)} ` +
            `(ciclo ${x.ciclo}) frente a «${y.nombre}» en ${etiqueta(y.plan)} ` +
            `(ciclo ${y.ciclo}) — comparten el ${Math.round(v * 100)} % de las palabras. ` +
            'Uno de los dos pudo salir mal: cotejar ambos contra su documento (RF-7).',
        );
      }
    }
  }
  return avisos;
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

/** Valida un pensum: triangulación de UV y de nº de materias, ids únicos, control de nombres
 * (RF-5) y las advertencias del parseo. */
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

  // Control de nombres (RF-4/RF-5): mismo trato que un descuadre de UV, con carrera/código/ciclo.
  errores.push(...revisarNombres(plan));

  advertencias.push(...pendiente.advertencias);
  return { errores, advertencias, excepciones };
}

/**
 * Valida el conjunto completo a publicar. **Acumula** todos los errores (nunca se detiene en
 * el primero) para poder reportarlos todos en una sola corrida, y añade las advertencias que
 * solo se ven mirando el conjunto completo (RF-7).
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

  // RF-7: misma asignatura con nombres muy distintos en planes distintos ⇒ aviso para cotejar.
  advertencias.push(...advertirDivergencias(pendientes));

  return { errores, advertencias, excepciones };
}

/** Un solo error basta para detener toda la publicación (RF-13, D2). Las advertencias, no. */
export function publicable(resultado: ResultadoValidacion): boolean {
  return resultado.errores.length === 0;
}
