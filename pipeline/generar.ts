// T8/T5 — Orquestador del dataset (plan §2, §3, §4 y §5).
//
//   manifiesto.json → cargar.ts (bytes; red solo con `--refresco`) → pdf.ts →
//   (si el PDF va sin capa de texto: cargar.ts aporta su `.jpg` y ocr.ts lo lee, B²) →
//   parsear.ts → identificadores.ts → correcciones-nombres.json (inyectado, D3) →
//   correcciones.ts → validar.ts → data/planes.json · data/manifiesto.json ·
//   docs/02-reporte-dataset.md
//
// Dos garantías:
//   * **RF-12 (reproducibilidad)**: `hoy` entra como parámetro y la lógica pura jamás toca el
//     reloj, la red ni el filesystem; dos corridas con la misma entrada producen el mismo byte.
//     La I/O (leer manifiesto, cargar fuentes, escribir artefactos) vive en `main` y en las
//     dependencias inyectables de `ejecutarGeneracion`.
//   * **RF-13 (parada total)**: cualquier fallo —fuente ausente, PDF ilegible, total
//     descuadrado, contrato violado— se **acumula** con la carrera exacta, se lanza antes de
//     escribir y no se publica ni un byte de dataset parcial.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { itemsDeDocumento, vistaDeDocumento } from './pdf.ts';
import { itemsDeImagen } from './ocr.ts';
import {
  hayRotulosDeCiclo,
  parsearItems,
  OPCIONES_OCR,
  OPCIONES_VIRTUAL,
  type OpcionesParseo,
} from './parsear.ts';
import { identificarCiclos, prefijoDePlan } from './identificadores.ts';
import { aplicarCorrecciones, type CorreccionHuerfana, type CorreccionNombre } from './correcciones.ts';
import {
  claveDeCarrera,
  validar,
  type ExcepcionRf2,
  type PendienteValidacion,
} from './validar.ts';
import { cargarFuente, cargarImagen as cargarImagenLocal } from './cargar.ts';
import { esquemaPlan } from '../src/data/esquema.ts';
import type { Asignatura, Plan } from '../src/domain/tipos.ts';

/** Entrada del manifiesto curado (`pipeline/manifiesto.json`), RF-1/RF-7. */
export interface EntradaManifiesto {
  carrera: string;
  sede: Plan['sede'];
  tipo: Plan['tipo'];
  plan: string;
  modalidad: string;
  /** UV y nº de materias que declara el **sitio** (una de las tres fuentes de la T7). */
  uvTotal: number;
  materiasTotal: number;
  urlPensum: string;
  paginaCarrera?: string | null;
  comparteCon?: string | null;
}

/** Corrección curada aplicada a un plan, con su asignatura: va al manifiesto (RF-6). */
export interface CorreccionAplicada extends CorreccionNombre {
  /** Código de la asignatura, para leer la entrada sin decodificar el id. */
  codigo: string;
  ciclo: number;
  /** Nombre que publicaba la extracción antes de la corrección. */
  nombreAnterior: string;
}

/** Lo mismo, con la carrera a la que pertenece (para el reporte de generación, RF-6). */
export interface CorreccionPublicada extends CorreccionAplicada {
  carrera: string;
  sede: Plan['sede'];
  tipo: Plan['tipo'];
  plan: string;
}

/** `data/manifiesto.json`: audita de dónde salió cada plan publicado (RF-16). */
export interface PublicacionManifiesto {
  carrera: string;
  sede: Plan['sede'];
  tipo: Plan['tipo'];
  plan: string;
  origen: { url: string; fecha: string };
  /** Presente solo cuando el plan se publicó con una excepción RF-2 aprobada. */
  excepcionRf2?: ExcepcionRf2;
  /** Presente solo cuando el plan llevó correcciones curadas de nombres (RF-6). */
  correcciones?: CorreccionAplicada[];
}

/** Excepción RF-2 publicada, con la carrera a la que pertenece (para el reporte). */
export interface ExcepcionPublicada extends ExcepcionRf2 {
  carrera: string;
  sede: Plan['sede'];
  tipo: Plan['tipo'];
  plan: string;
}

export interface DatasetGenerado {
  planes: Plan[];
  manifiestoPublicado: PublicacionManifiesto[];
  advertencias: string[];
  /** Excepciones a RF-2 aprobadas que se aplicaron: van al reporte de generación. */
  excepciones: ExcepcionPublicada[];
  /** Correcciones curadas aplicadas, con su asignatura y su documento (RF-6). */
  correcciones: CorreccionPublicada[];
}

export interface EntradaGeneracion {
  manifiesto: EntradaManifiesto[];
  /** URL → bytes ya cargados por `cargar.ts` (la I/O ocurre fuera de esta función). */
  fuentes: ReadonlyMap<string, Uint8Array>;
  /**
   * Registro de correcciones curadas (`pipeline/correcciones-nombres.json`), leído en `main`
   * y **inyectado** aquí igual que las fuentes (D3): la lógica pura no abre archivos (RF-9/RF-12).
   */
  correcciones: readonly CorreccionNombre[];
  /**
   * URL → bytes del `.jpg` renderizado del PDF. **Solo se pide** si el PDF no tiene capa de
   * texto utilizable (B²); los demás planes jamás la tocan. Es obligatoria porque, como
   * `escribir` y `cargar`, es I/O inyectada: la lógica pura no abre archivos (RF-12).
   */
  cargarImagen: (url: string) => Promise<Uint8Array>;
  /** Fecha de extracción `YYYY-MM-DD`. **Nunca** se lee el reloj aquí (RF-12). */
  hoy: string;
}

/** Nombre exacto del elemento para señalarlo en un error (RF-13). */
function etiqueta(fila: EntradaManifiesto): string {
  return `${fila.carrera} (${fila.sede} · ${fila.tipo} · ${fila.plan})`;
}

/** Igual que `etiqueta`, pero para el Plan publicado (usa `planVersion`). */
function etiquetaPlan(plan: Plan): string {
  return `${plan.carrera} (${plan.sede} · ${plan.tipo} · ${plan.planVersion})`;
}

function esFecha(texto: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(texto);
}

/**
 * Aplica las excepciones a RF-2 aprobadas al plan publicado y deja constancia de cada una en
 * su entrada del manifiesto (RF-16). La validación corrió **antes** con los valores del sitio,
 * así que la triangulación nunca ve el dato corregido: solo se publica lo aprobado.
 *
 * Los índices de `manifiestoPublicado` y `pendientes` coinciden: ambos se empujan juntos en
 * la misma iteración.
 */
function aplicarExcepciones(
  pendientes: PendienteValidacion[],
  manifiestoPublicado: PublicacionManifiesto[],
  excepciones: readonly ExcepcionRf2[],
): ExcepcionPublicada[] {
  const aplicadas: ExcepcionPublicada[] = [];
  for (const excepcion of excepciones) {
    const indice = pendientes.findIndex((p) => claveDeCarrera(p.plan) === excepcion.clave);
    if (indice < 0) continue; // no puede ocurrir: la excepción nació de ese mismo pendiente

    const plan = pendientes[indice]!.plan;
    if (excepcion.concepto === 'UV') plan.uvTotal = excepcion.publicado;
    else plan.materiasTotal = excepcion.publicado;
    manifiestoPublicado[indice]!.excepcionRf2 = excepcion;

    aplicadas.push({
      ...excepcion,
      carrera: plan.carrera,
      sede: plan.sede,
      tipo: plan.tipo,
      plan: plan.planVersion,
    });
  }
  return aplicadas;
}

/** Prefijo del id de un plan (`sede:tipo:plan:slug:`): con él se acota el registro a él (D3). */
function prefijoDe(fila: EntradaManifiesto): string {
  return `${prefijoDePlan(fila)}:`;
}

/** Localiza una asignatura por su id y devuelve su ciclo: describe la corrección sin decodificar el id. */
function situar(plan: Plan, id: string): { ciclo: number; asignatura: Asignatura } | null {
  for (const ciclo of plan.ciclos) {
    for (const asignatura of ciclo.asignaturas) {
      if (asignatura.id === id) return { ciclo: ciclo.numero, asignatura };
    }
  }
  return null;
}

/** Por qué una corrección curada no se aplicó, en una frase (RF-4 / caso límite 8 / D7). */
const MOTIVO_HUERFANA: Record<CorreccionHuerfana['razon'], string> = {
  'id-inexistente':
    'la asignatura ya no existe en el pensum: el registro quedó obsoleto (caso límite 8)',
  'nombre-invalido': 'el nombre de la corrección queda vacío tras el saneado y no se publica vacío',
  'id-duplicado': 'dos correcciones apuntan al mismo id y no dicen cuál manda: no se aplica ninguna',
};

/**
 * Genera el dataset **en memoria**: por cada entrada del manifiesto extrae su PDF, parsea,
 * identifica, aplica las correcciones curadas y valida contra la triangulación. Si algo falla,
 * acumula todos los errores con la carrera exacta y lanza **antes** de que nadie escriba nada
 * (RF-13).
 */
export async function generarDataset(entrada: EntradaGeneracion): Promise<DatasetGenerado> {
  const errores: string[] = [];
  const pendientes: PendienteValidacion[] = [];
  const manifiestoPublicado: PublicacionManifiesto[] = [];
  const correccionesPublicadas: CorreccionPublicada[] = [];

  if (!esFecha(entrada.hoy)) {
    throw new Error(`Fecha de extracción inválida: "${entrada.hoy}" (se espera YYYY-MM-DD).`);
  }

  for (const fila of entrada.manifiesto) {
    try {
      const bytes = entrada.fuentes.get(fila.urlPensum);
      if (!bytes) {
        throw new Error(
          `falta la fuente local de ${fila.urlPensum}; ejecuta \`npm run datos:refrescar\` (no hay red sin ese flag).`,
        );
      }

      let items = await itemsDeDocumento(bytes);
      let opciones: OpcionesParseo | undefined;
      if (hayRotulosDeCiclo(items)) {
        // La UDB Virtual usa otra plantilla (plan §8, riesgo 1): se parametriza por familia.
        opciones = fila.sede === 'virtual' ? OPCIONES_VIRTUAL : undefined;
      } else {
        // B²: 7 pensums de UDB Virtual van dibujados como trazos, sin capa de texto utilizable.
        // El PDF sigue mandando la geometría (`page.view`) y el texto sale de su `.jpg`, con
        // las opciones de plantilla virtual sin fusión (RF-14). Si la imagen falta, el error
        // de `cargarImagen` nombra la ruta y el `catch` añade la carrera exacta (RF-13).
        const imagen = await entrada.cargarImagen(fila.urlPensum);
        items = await itemsDeImagen(imagen, await vistaDeDocumento(bytes));
        opciones = OPCIONES_OCR;
      }
      const parseo = parsearItems(items, opciones);
      if (parseo.ciclos.length === 0) {
        throw new Error('no se detectó ningún ciclo: el documento no corresponde a una plantilla conocida.');
      }

      const ciclos = identificarCiclos(fila, parseo.ciclos).map((ciclo) => ({
        numero: ciclo.numero,
        asignaturas: ciclo.asignaturas.map((a) => ({
          id: a.id,
          codigo: a.codigo,
          nombre: a.nombre,
          uv: a.uv,
          prerrequisito: a.prerrequisito,
          electiva: a.electiva,
          laboratorio: a.laboratorio,
        })),
      }));

      const plan: Plan = {
        carrera: fila.carrera,
        sede: fila.sede,
        tipo: fila.tipo,
        planVersion: fila.plan,
        modalidad: fila.modalidad,
        uvTotal: fila.uvTotal,
        materiasTotal: fila.materiasTotal,
        ciclos,
      };

      // RF-3: orden del plan — parsear → identificar → **corregir** → validar. El registro entra
      // inyectado (D3) y se acota aquí al prefijo de ids de este plan: una corrección que toca a
      // otra carrera no es una corrección obsoleta, y una que toca a esta y no encuentra su
      // asignatura detiene la publicación (caso límite 8 / D7).
      const registro = entrada.correcciones.filter((c) => c.id.startsWith(prefijoDe(fila)));
      const correccion = aplicarCorrecciones(plan, registro);
      for (const huerfana of correccion.huerfanas) {
        errores.push(
          `${etiqueta(fila)}: corrección curada sin aplicar [${huerfana.razon}] ` +
            `"${huerfana.correccion.id}" (${huerfana.correccion.fuente}): ` +
            `${MOTIVO_HUERFANA[huerfana.razon]}. No se publica el dataset.`,
        );
      }

      // P2: el contrato Zod se exige aquí mismo, no al cargarlo en la app (RF-14), y sobre el
      // plan **ya corregido**: lo que se publica es lo que se valida (RF-3/RF-8). Se acumula el
      // error y el plan **sigue a validar** — así un nombre vacío se señala con carrera, código
      // y ciclo (RF-4/RF-5) además de con su ruta en el JSON, y la corrida reporta todo junto
      // en vez de tragarse el resto de diagnósticos de esa carrera (RF-13).
      const contrato = esquemaPlan.safeParse(correccion.plan);
      if (!contrato.success) {
        errores.push(
          `${etiqueta(fila)}: no cumple el contrato de datos: ${contrato.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ')}. No se publica el dataset.`,
        );
      }

      // RF-6: cada corrección aplicada queda registrada con su asignatura y su documento.
      const aplicadas: CorreccionAplicada[] = correccion.aplicadas.map((c) => {
        const situado = situar(plan, c.id);
        if (!situado) throw new Error(`corrección aplicada sin asignatura: ${c.id}`); // no puede ocurrir
        return {
          ...c,
          codigo: situado.asignatura.codigo,
          ciclo: situado.ciclo,
          nombreAnterior: situado.asignatura.nombre,
        };
      });
      correccionesPublicadas.push(
        ...aplicadas.map((c) => ({
          ...c,
          carrera: fila.carrera,
          sede: fila.sede,
          tipo: fila.tipo,
          plan: fila.plan,
        })),
      );

      pendientes.push({
        plan: correccion.plan,
        totales: parseo.totales,
        advertencias: parseo.advertencias,
      });
      manifiestoPublicado.push({
        carrera: fila.carrera,
        sede: fila.sede,
        tipo: fila.tipo,
        plan: fila.plan,
        origen: { url: fila.urlPensum, fecha: entrada.hoy },
        ...(aplicadas.length > 0 ? { correcciones: aplicadas } : {}),
      });
    } catch (e) {
      errores.push(`${etiqueta(fila)}: ${(e as Error).message}`);
    }
  }

  // RF-9/RNF-3: una corrección que no encaja con ninguna carrera del manifiesto no se aplicaría
  // en ningún sitio; se señala aquí para que un id mal escrito en el registro no se quede
  // ignorado en silencio (el mismo criterio del caso límite 8, por el otro lado).
  const prefijos = entrada.manifiesto.map(prefijoDe);
  for (const correccion of entrada.correcciones) {
    if (!prefijos.some((prefijo) => correccion.id.startsWith(prefijo))) {
      errores.push(
        `Corrección curada "${correccion.id}" (${correccion.fuente}): no corresponde a ninguna ` +
          'carrera del manifiesto; el registro quedó obsoleto. No se publica el dataset.',
      );
    }
  }

  const resultado = validar(pendientes);
  errores.push(...resultado.errores.map((e) => e.message));

  if (errores.length > 0) {
    throw new Error(
      `Dataset no publicado (${errores.length} error(es)); no se escribió nada:\n - ` +
        errores.join('\n - '),
    );
  }

  // La validación corrió con los valores del sitio; aquí se aplica lo que se aprobó publicar.
  const excepciones = aplicarExcepciones(pendientes, manifiestoPublicado, resultado.excepciones);

  // P2: el contrato Zod se exige también sobre el plan **ya corregido** por una excepción.
  for (const pendiente of pendientes) {
    const contrato = esquemaPlan.safeParse(pendiente.plan);
    if (!contrato.success) {
      throw new Error(
        `${etiquetaPlan(pendiente.plan)}: el plan corregido por una excepción no cumple el ` +
          `contrato de datos: ${contrato.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ')}`,
      );
    }
  }

  return {
    planes: pendientes.map((p) => p.plan),
    manifiestoPublicado,
    advertencias: resultado.advertencias,
    excepciones,
    correcciones: correccionesPublicadas,
  };
}

/** `docs/02-reporte-dataset.md`: totales por carrera, discrepancias y advertencias. */
export function redactarReporte(dataset: DatasetGenerado): string {
  const fecha = dataset.manifiestoPublicado[0]?.origen.fecha ?? '—';
  const lineas: string[] = [
    '# Reporte de generación del dataset',
    '',
    `- Fecha de extracción: ${fecha}`,
    `- Planes publicados: ${dataset.planes.length}`,
    `- Discrepancias sin aprobar: 0 (cualquiera habría detenido la publicación, RF-13)`,
    `- Discrepancias publicadas por excepción RF-2: ${dataset.excepciones.length}`,
    `- Correcciones curadas de nombres aplicadas: ${dataset.correcciones.length}`,
    `- Advertencias: ${dataset.advertencias.length}`,
    '',
    '## Totales por carrera',
    '',
    '| Carrera | Sede | Tipo | Plan | UV | Materias | Ciclos | Asignaturas |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const plan of dataset.planes) {
    const materias = plan.ciclos.reduce((n, c) => n + c.asignaturas.length, 0);
    lineas.push(
      `| ${plan.carrera} | ${plan.sede} | ${plan.tipo} | ${plan.planVersion} | ${plan.uvTotal} | ` +
        `${plan.materiasTotal} | ${plan.ciclos.length} | ${materias} |`,
    );
  }

  lineas.push('', '## Excepciones a RF-2', '');
  if (dataset.excepciones.length === 0) {
    lineas.push('- Ninguna.');
  } else {
    for (const ex of dataset.excepciones) {
      const encabezado = ex.encabezado ?? '∅';
      lineas.push(
        `- **${ex.carrera}** (${ex.sede} · ${ex.tipo} · ${ex.plan}) · ${ex.concepto}: ` +
          `sitio=${ex.sitio}, encabezado=${encabezado}, filas=${ex.filas} → se publica ${ex.publicado}. ` +
          `${ex.motivo}`,
      );
    }
  }

  lineas.push('', '## Correcciones curadas de nombres (RF-6)', '');
  if (dataset.correcciones.length === 0) {
    lineas.push('- Ninguna.');
  } else {
    for (const correccion of dataset.correcciones) {
      lineas.push(
        `- **${correccion.carrera}** (${correccion.sede} · ${correccion.tipo} · ` +
          `${correccion.plan}) · ciclo ${correccion.ciclo}, ${correccion.codigo}: ` +
          `«${correccion.nombreAnterior}» → «${correccion.nombre}». ` +
          `Fuente: \`${correccion.fuente}\`. ${correccion.motivo}`,
      );
    }
  }

  lineas.push('', '## Advertencias', '');
  if (dataset.advertencias.length === 0) {
    lineas.push('- Ninguna.');
  } else {
    for (const advertencia of dataset.advertencias) lineas.push(`- ${advertencia}`);
  }
  lineas.push('');
  return lineas.join('\n');
}

export interface OpcionesEjecucion {
  manifiesto: EntradaManifiesto[];
  /** `YYYY-MM-DD`; en CLI sale de `--hoy=` o del sistema **fuera** de la lógica pura. */
  hoy: string;
  /** Con `--refresco` se permite la red para (re)bajar las fuentes que falten. */
  refresco?: boolean;
  /** Fuentes ya cargadas; si se omiten se piden a `cargar`. */
  fuentes?: ReadonlyMap<string, Uint8Array>;
  /** Registro de correcciones curadas; por defecto `[]` (lo lee `main` de su JSON, D3). */
  correcciones?: readonly CorreccionNombre[];
  /** Carga de una URL; por defecto `cargarFuente` (solo disco salvo `refresco`). */
  cargar?: (url: string) => Promise<Uint8Array>;
  /** Carga del `.jpg` de un PDF sin capa de texto; por defecto `cargarImagen` de `cargar.ts`. */
  cargarImagen?: (url: string) => Promise<Uint8Array>;
  /** Escritura inyectable: permite probar que **no se escribe nada** si la generación falla. */
  escribir?: (ruta: string, contenido: string) => Promise<void>;
}

export interface ResultadoEjecucion {
  dataset: DatasetGenerado;
  /** Rutas escritas, en orden. */
  rutas: string[];
}

const escribirEnDisco = async (ruta: string, contenido: string): Promise<void> => {
  await mkdir(dirname(ruta), { recursive: true });
  await writeFile(ruta, contenido);
};

/** Genera y escribe los 3 artefactos. La escritura ocurre **solo** si la generación salió bien. */
export async function ejecutarGeneracion(opciones: OpcionesEjecucion): Promise<ResultadoEjecucion> {
  const cargar = opciones.cargar ?? (async (url: string) => (await cargarFuente(url, { refresco: opciones.refresco })).bytes);
  // La imagen solo se pide si un PDF resulta no tener capa de texto; aquí se decide cómo
  // obtenerla, para que `generarDataset` no tenga que conocer `--refresco`.
  const cargarImagen =
    opciones.cargarImagen ??
    (async (url: string) => await cargarImagenLocal(url, { refresco: opciones.refresco }));

  let fuentes = opciones.fuentes;
  if (!fuentes) {
    const mapa = new Map<string, Uint8Array>();
    for (const url of new Set(opciones.manifiesto.map((f) => f.urlPensum))) {
      mapa.set(url, await cargar(url));
    }
    fuentes = mapa;
  }

  const dataset = await generarDataset({
    manifiesto: opciones.manifiesto,
    fuentes,
    cargarImagen,
    correcciones: opciones.correcciones ?? [],
    hoy: opciones.hoy,
  });

  const artefactos: Array<[string, string]> = [
    ['data/planes.json', `${JSON.stringify(dataset.planes, null, 2)}\n`],
    ['data/manifiesto.json', `${JSON.stringify(dataset.manifiestoPublicado, null, 2)}\n`],
    ['docs/02-reporte-dataset.md', redactarReporte(dataset)],
  ];
  const escribir = opciones.escribir ?? escribirEnDisco;
  for (const [ruta, contenido] of artefactos) {
    await escribir(ruta, contenido);
  }

  return { dataset, rutas: artefactos.map(([ruta]) => ruta) };
}

/** Fecha de hoy para el CLI: el único sitio donde se toca el reloj, nunca dentro de la lógica. */
function hoyDeSistema(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Punto de entrada de `npm run datos` y `npm run datos:refrescar`.
 * Opciones: `--refresco` (red) · `--hoy=YYYY-MM-DD` (para regeneraciones auditables).
 */
export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const refresco = argv.includes('--refresco');
  const hoy = argv.find((a) => a.startsWith('--hoy='))?.slice('--hoy='.length) ?? hoyDeSistema();
  if (!esFecha(hoy)) {
    throw new Error(`--hoy inválido: "${hoy}" (se espera YYYY-MM-DD).`);
  }

  const manifiesto: EntradaManifiesto[] = JSON.parse(
    await readFile('pipeline/manifiesto.json', 'utf8'),
  );
  // El registro de correcciones es I/O: se lee aquí, fuera de la lógica pura (D3, RF-9).
  const correcciones: CorreccionNombre[] = JSON.parse(
    await readFile('pipeline/correcciones-nombres.json', 'utf8'),
  );
  const { dataset, rutas } = await ejecutarGeneracion({
    manifiesto,
    correcciones,
    hoy,
    refresco,
  });

  console.log(`Dataset publicado: ${dataset.planes.length} planes · ${hoy}`);
  console.log(`Correcciones curadas aplicadas: ${dataset.correcciones.length}`);
  console.log(`Advertencias: ${dataset.advertencias.length}`);
  for (const ruta of rutas) console.log(`  · ${ruta}`);
}

// Solo se ejecuta como script (`npm run datos`), no al importarlo desde los tests.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((e: Error) => {
    console.error(e.message);
    process.exitCode = 1;
  });
}
