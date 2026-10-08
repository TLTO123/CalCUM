// T4 — Extracción por layout (plan §3 y §4). Función pura: sin red, reloj ni filesystem.
//
// El PDF del pensum es infográfico y su texto sale **intercalado entre columnas**: el orden
// lineal no corresponde al visual (caso límite 1). Aquí todo se reconstruye por geometría:
//
//   rótulos "CICLO I…X"  → cada uno abre una región vertical (de ancho = separación entre
//                           títulos, desplazada `margenTitulo` ptos. a la izquierda);
//   fila de código        → [Nº correlativo][-11..2] + [código][21..36];
//   filas siguientes      → nombre (1..n líneas; las marcas '*' y '•' se separan del texto);
//   fila inferior         → [prerrequisito][-22..5] + [UV][28..36];
//   corte por hueco       → un salto grande entre filas de código marca el fin del ciclo
//                           (en la plantilla real, ahí empieza la sección de electivas).
//
// Los offsets son relativos al x del rótulo de su región. La familia "virtual" los mueve
// (T5); por eso viven en `OpcionesParseo` y no incrustados en el algoritmo.

import type { ItemTexto } from './pdf.ts';

export interface AsignaturaCruda {
  /** Código de la asignatura (p. ej. `CAD501`); `-` cuando es electiva sin código fijo (RF-9). */
  codigo: string;
  nombre: string;
  uv: number;
  ciclo: number;
  /** Nº correlativo del documento: de él sale el prerrequisito de otras asignaturas. */
  correlativo: number | null;
  /** Texto crudo de la columna prerrequisito (`Bachillerato`, `6`, `10, 11`, `-`). */
  prerrequisito: string | null;
  /** La marca `•` del documento = prácticas de laboratorio. */
  laboratorio: boolean;
  electiva: boolean;
}

export interface CicloCrudo {
  numero: number;
  asignaturas: AsignaturaCruda[];
}

export interface Totales {
  /** Total de UV declarado en el encabezado del documento (null si no aparece). */
  uvEncabezado: number | null;
  /** `TOTAL DE MATERIAS A CURSAR` del encabezado (null si no aparece). */
  materiasEncabezado: number | null;
  /** Suma de las UV realmente extraídas. */
  uvSuma: number;
  /** Número de asignaturas extraídas. */
  materiasConteo: number;
}

export interface ResultadoParseo {
  ciclos: CicloCrudo[];
  totales: Totales;
  advertencias: string[];
}

export interface OpcionesParseo {
  /** Separación entre el rótulo del ciclo y el borde izquierdo de su región. */
  margenTitulo?: number;
  /** Tolerancia en puntos para considerar dos ítems en la misma fila visual. */
  toleranciaFila?: number;
  /** Hueco máximo entre filas de código, como múltiplo de la mediana (corte de secciones). */
  factorCorte?: number;
  /** Tope superior creíble para una UV. */
  uvMaxima?: number;
  /** Desplazamientos (relativos al rótulo) de cada campo. */
  offsets?: {
    correlativo?: [number, number];
    codigo?: [number, number];
    uv?: [number, number];
    prerrequisito?: [number, number];
  };
  /**
   * Une los ítems de una misma fila separados por ≤ 3 pt. La plantilla virtual
   * emite `AVM941` y `Bachillerato` letra a letra; la presencial los emite
   * enteros y allí el fusionarla pegaría `Bachillerato` con el `4` de su
   * prerrequisito.
   */
  fusionar?: boolean;
  /**
   * Abre una materia cuando solo hay un correlativo en su columna, sin código: así las
   * electivas marcadas solo por correlativo (24/28 en el presencial, 38/42 en el virtual)
   * dejan de perderse. **No** se activa en la fila de UV: en las plantillas con UV y
   * prerrequisito en su propia fila, esa fila también trae un número en la columna del
   * correlativo y, sin este filtro, cada prerrequisito abriría una materia fantasma.
   */
  electivaPorCorrelativo?: boolean;
  /**
   * El prerrequisito del virtual vive en su **propia fila**, por debajo de la
   * de UV (en presencial UV y prerrequisito comparten fila). Mueve también el
   * límite inferior del nombre: sin esto se cortaría en la fila de UV y se
   * perdería la primera línea.
   */
  prerrequisitoEnFilaPropia?: boolean;
}

/** Opciones de la plantilla de la UDB Virtual (`tests/fixtures/pensums/virtual-*.pdf`). */
/**
 * Ancho que la región de una columna se desplaza a la izquierda de su rótulo, en la
 * plantilla de la UDB Virtual. Se exporta porque `ocr.ts` abre sus columnas con el mismo
 * criterio: si uno corrigiera el margen y el otro no, una palabra caería en la fila de otra
 * columna y la fila de código saldría partida.
 */
export const MARGEN_ROTULO_VIRTUAL = 45;

/**
 * Offsets de cada campo respecto al rótulo, en la plantilla de la UDB Virtual. Se exportan
 * porque `ocr.ts` localiza la celda de UV con estos mismos números: si el detector y el
 * parser discreparan en unos puntos, la relectura inyectaría un número donde nadie lo pide,
 * o dejaría de inyectarlo justo donde hace falta.
 */
/** `38` empieza a +11.1 pt del rótulo; el correlativo más a la derecha, a +14.02
 *  (ciclo VIII) y los totales acumulados arrancan a +15.00: el borde derecho no puede
 *  pasarse de 14.5. El izquierdo es el límite blando, porque el número va **centrado** en su
 *  celda: en la rejilla de 4 columnas llega a +3 y en la de 5, a −0.8 (`24`, el glifo más
 *  ancho, en Lic. Diseño Gráfico). Cerrarlo en 0 dejaba esa fila —la `Electiva I` del ciclo
 *  V— fuera de `filasCodigo`: no abría materia y su nombre se colaba en la anterior. */
export const OFFSET_CORRELATIVO_VIRTUAL: [number, number] = [-4, 14.5];
/** `SIO941` empieza a +49.3 pt del rótulo. */
export const OFFSET_CODIGO_VIRTUAL: [number, number] = [41, 60];
/** `4` a −30.3 pt del rótulo; la etiqueta `UV` vive a −41. Los rótulos van centrados y con
 *  anchos distintos (`Ciclo I` 52 pt, `Ciclo III` 62 pt), así que el borde izquierdo cae
 *  entre −43 y −47 según la columna (−47 en la I de las rejillas de 4 columnas) y la
 *  etiqueta, entre −41 y −53. La región se decide por el centro, y ni un dígito de 7 pt ni
 *  la etiqueta de 18 pt pueden empezar antes de −48.5 y −54: −55 cubre ambos extremos sin
 *  alcanzar a la columna vecina. */
export const OFFSET_UV_VIRTUAL: [number, number] = [-55, -25];

/** Tope superior creíble para una UV. */
export const UV_MAXIMA = 60;

export const OPCIONES_VIRTUAL: OpcionesParseo = {
  margenTitulo: MARGEN_ROTULO_VIRTUAL,
  fusionar: true,
  electivaPorCorrelativo: true,
  prerrequisitoEnFilaPropia: true,
  offsets: {
    correlativo: OFFSET_CORRELATIVO_VIRTUAL,
    codigo: OFFSET_CODIGO_VIRTUAL,
    uv: OFFSET_UV_VIRTUAL,
    /** Números en +31..+45, `Bachillerato` en +6..+14, `**` en +36..+42. En la rejilla de
     *  4 columnas los números llegan a +48: quedarse en +46 dejaba sin prerrequisito (y con
     *  el nombre abierto hasta el pie del bloque) a toda la columna VII de Administración. */
    prerrequisito: [4, 52],
  },
};

const RE_CODIGO = /^[A-Z]{2,4}\d{3}$/;
const RE_TITULO = /^CICLO\s+(?:([IVXL]+)|(\d+))$/i;
const RE_UV = /UNIDADES VALORATIVAS:\s*(\d+)/i;
const RE_MATERIAS = /TOTAL DE MATERIAS A CURSAR:\s*(\d+)/i;

/**
 * Misma geometría que `OPCIONES_VIRTUAL`, para un PDF leído **por imagen** (B²).
 *
 * La única diferencia es `fusionar: false`. El fusor existe para la capa de texto de la
 * plantilla virtual, que emite los códigos letra a letra; tesseract ya devuelve la palabra
 * entera, así que con él solo se pegan palabras vecinas: `Pensamiento Social Cristiano`
 * salía `PensamientoSocial Cristiano` y `Diseño de` salía `Diseñode`.
 */
export const OPCIONES_OCR: OpcionesParseo = { ...OPCIONES_VIRTUAL, fusionar: false };

/**
 * ¿Los ítems traen rótulos de ciclo? Un pensum publicado como trazos (los 7 de UDB Virtual,
 * B²) solo deja los dígitos de UV en su capa de texto: sin rótulos no hay plantilla que
 * parsear y hay que pasar al OCR **antes** de que el parser falle por "plantilla no
 * soportada", que sería un diagnóstico falso.
 */
export function hayRotulosDeCiclo(items: readonly ItemTexto[]): boolean {
  return items.some((i) => RE_TITULO.test(i.str.trim()));
}

const DEFECTO = {
  margenTitulo: 18,
  toleranciaFila: 2.5,
  factorCorte: 1.6,
  uvMaxima: UV_MAXIMA,
  electivaPorCorrelativo: true,
  offsets: {
    correlativo: [-11, 2] as [number, number],
    codigo: [21, 36] as [number, number],
    // La UV propia está entre +28 (ingenierías/licenciaturas) y +48 (técnicos y profesorado,
    // que usan la misma plantilla con más aire). El tope en +52 es deliberado: el prerrequisito
    // de la **columna vecina** cae en +54 y no debe robarse como UV.
    uv: [28, 52] as [number, number],
    prerrequisito: [-22, 5] as [number, number],
  },
};

const ROMANOS: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };

/** Hueco máximo (pt) que se tolera al fusionar texto partido de la plantilla virtual. */
const HUECO_MAX_FUSION = 3;

/** Hueco máximo (pt) entre la fila de código y la de correlativo de una misma línea visual. */
const PEGAR_CORRELATIVO = 12;

/** Fila visual: sus ítems comparten y dentro de la tolerancia. */
type Fila = { y: number; items: ItemTexto[] };

/** Formas admitidas en la columna prerrequisito del documento. */
const ES_PRERREQUISITO = /^(?:\d+(?:\s*,\s*\d+)*|bachillerato|-|\*+)$/i;

/** Correlativos sueltos o listas separadas por comas ⇒ códigos unidos con `, `. */
function resolverPrerrequisito(
  codigo: string,
  crudo: string | null,
  codigos: Map<number, string>,
  advertencias: string[],
): string | null {
  if (crudo === null) return null;
  const limpio = crudo.trim();
  if (/^bachillerato$/i.test(limpio) || limpio === '-') return null;
  if (!/^\d+(\s*,\s*\d+)*$/.test(limpio)) return null; // `**` y demás marcas
  const resueltos: string[] = [];
  let huerfano = false;
  for (const parte of limpio.split(',')) {
    const destino = codigos.get(Number(parte.trim()));
    if (destino === undefined || destino === '-') {
      huerfano = true;
      continue;
    }
    resueltos.push(destino);
  }
  if (huerfano) {
    advertencias.push(
      `Prerrequisito «${limpio}» de ${codigo}: el correlativo no corresponde a ninguna materia publicada`,
    );
    return null;
  }
  return resueltos.join(', ');
}

function romanoAEntero(romano: string): number | null {
  let total = 0;
  for (let i = 0; i < romano.length; i++) {
    const actual = ROMANOS[romano[i]!];
    const siguiente = ROMANOS[romano[i + 1] ?? ''];
    if (actual === undefined) return null;
    total += siguiente !== undefined && actual < siguiente ? -actual : actual;
  }
  return total;
}

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2
    ? ordenados[medio]!
    : (ordenados[medio - 1]! + ordenados[medio]!) / 2;
}

/** Agrupa ítems en filas visuales: y dentro de la tolerancia ⇒ misma fila. */
function enFilas(items: ItemTexto[], tolerancia: number): { y: number; items: ItemTexto[] }[] {
  const filas: { y: number; items: ItemTexto[] }[] = [];
  for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const fila = filas.find((f) => Math.abs(f.y - item.y) <= tolerancia);
    if (fila) {
      fila.items.push(item);
      fila.y = fila.items.reduce((suma, i) => suma + i.y, 0) / fila.items.length;
    } else {
      filas.push({ y: item.y, items: [item] });
    }
  }
  return filas.sort((a, b) => b.y - a.y);
}

/** Une los ítems de una misma fila separados por ≤ `hueco` pt (texto partido letra a letra). */
function fusionarPorFila(items: ItemTexto[], tolerancia: number, hueco: number): ItemTexto[] {
  const salida: ItemTexto[] = [];
  for (const fila of enFilas(items, tolerancia)) {
    const ordenados = [...fila.items].sort((a, b) => a.x - b.x);
    let actual = { ...ordenados[0]! };
    for (const it of ordenados.slice(1)) {
      const separacion = it.x - (actual.x + actual.width);
      if (separacion <= hueco) {
        // Mismo texto: lo alargamos en vez de concatenar ciegas (evita duplicar traslapes).
        actual = { ...actual, str: actual.str + it.str, width: it.x + it.width - actual.x };
      } else {
        salida.push(actual);
        actual = { ...it };
      }
    }
    salida.push(actual);
  }
  return salida;
}

/** Totales oficiales del documento; si el texto viene partido, se lee todo el documento unido. */
function leerEncabezado(utiles: ItemTexto[]): {
  uvEncabezado: number | null;
  materiasEncabezado: number | null;
  cuerpo: ItemTexto[];
} {
  let uv: number | null = null;
  let materias: number | null = null;
  const coinciden = new Set<ItemTexto>();

  for (const item of utiles) {
    const mUv = item.str.match(RE_UV);
    if (mUv) {
      uv = Number(mUv[1]);
      coinciden.add(item);
    }
    const mMat = item.str.match(RE_MATERIAS);
    if (mMat) {
      materias = Number(mMat[1]);
      coinciden.add(item);
    }
  }

  if (uv === null || materias === null) {
    const texto = [...utiles]
      .sort((a, b) => b.y - a.y || a.x - b.x)
      .map((i) => i.str)
      .join(' ');
    if (uv === null) uv = texto.match(RE_UV)?.[1] ? Number(texto.match(RE_UV)![1]) : null;
    if (materias === null) {
      materias = texto.match(RE_MATERIAS)?.[1] ? Number(texto.match(RE_MATERIAS)![1]) : null;
    }
  }

  return { uvEncabezado: uv, materiasEncabezado: materias, cuerpo: utiles.filter((i) => !coinciden.has(i)) };
}

/** Rótulos de ciclo agrupados en filas (la plantilla virtual los pone en dos filas). */
function leerTitulos(cuerpo: ItemTexto[]): { y: number; items: { x: number; y: number; numero: number }[] }[] {
  const candidatos: { x: number; y: number; numero: number }[] = [];
  for (const item of cuerpo) {
    const limpio = item.str.trim();
    const m = limpio.match(RE_TITULO);
    if (!m) continue;
    const numero = m[1] ? romanoAEntero(m[1].toUpperCase()) : Number(m[2]);
    if (numero === null || !Number.isFinite(numero) || numero <= 0) continue;
    candidatos.push({ x: item.x, y: item.y, numero });
  }
  const filas: { y: number; items: { x: number; y: number; numero: number }[] }[] = [];
  for (const t of candidatos.sort((a, b) => b.y - a.y || a.x - b.x)) {
    const fila = filas.find((f) => Math.abs(f.y - t.y) <= 5);
    if (!fila) {
      filas.push({ y: t.y, items: [t] });
      continue;
    }
    // Algunos PDF (p. ej. la grilla de Administración) imprimen el mismo rótulo varias veces
    // en la misma posición. Duplicarlo infla `ancho`, desplaza los bordes de región y deja un
    // ciclo entero fuera (40 → 36 materias): se colapsa el duplicado exacto.
    const duplicado = fila.items.some((i) => i.numero === t.numero && Math.abs(i.x - t.x) <= 1);
    if (!duplicado) fila.items.push(t);
  }
  for (const f of filas) f.items.sort((a, b) => a.x - b.x);
  return filas.sort((a, b) => b.y - a.y);
}

export function parsearItems(items: ItemTexto[], opciones: OpcionesParseo = {}): ResultadoParseo {
  const cfg = { ...DEFECTO, ...opciones, offsets: { ...DEFECTO.offsets, ...opciones.offsets } };
  const advertencias: string[] = [];

  const utiles = items.filter((i) => i.str.trim().length > 0);
  const base = cfg.fusionar ? fusionarPorFila(utiles, cfg.toleranciaFila, HUECO_MAX_FUSION) : utiles;
  const { uvEncabezado, materiasEncabezado, cuerpo: sinEncabezado } = leerEncabezado(base);
  const filasTitulo = leerTitulos(sinEncabezado);
  // Los rótulos de ciclo abren regiones: no deben colar dentro de ellas como si fueran texto.
  const cuerpo = sinEncabezado.filter((i) => !RE_TITULO.test(i.str.trim()));
  if (filasTitulo.length === 0) {
    throw new Error('No se encontró ningún rótulo de ciclo (¿plantilla no soportada?)');
  }

  const asignaturas: AsignaturaCruda[] = [];

  for (let f = 0; f < filasTitulo.length; f++) {
    const fila = filasTitulo[f]!;
    const yTope = fila.y;
    const yFondo = filasTitulo[f + 1]?.y ?? Number.NEGATIVE_INFINITY;
    const region = cuerpo.filter((i) => i.y < yTope - 1 && i.y > yFondo);

    const n = fila.items.length;
    const ancho = n > 1 ? (fila.items[n - 1]!.x - fila.items[0]!.x) / (n - 1) : Number.POSITIVE_INFINITY;

    for (let k = 0; k < n; k++) {
      const titulo = fila.items[k]!;
      const izq = titulo.x - cfg.margenTitulo;
      const der = k < n - 1 ? fila.items[k + 1]!.x - cfg.margenTitulo : titulo.x - cfg.margenTitulo + ancho;
      // Las celdas del presencial están centradas: un texto ancho puede empezar
      // antes del borde izquierdo de su columna (p. ej. `Programación de Software`
      // arranca en 578 pt y la columna VIII abre en 579). Se decide por el centro.
      const dentro = region.filter((i) => {
        const centro = i.x + i.width / 2;
        return centro >= izq && centro < der;
      });
      if (dentro.length === 0) {
        advertencias.push(`El ciclo ${titulo.numero} no tiene ningún ítem en su región`);
        continue;
      }
      const desplazamiento = (i: ItemTexto) => i.x - titulo.x;
      const enRango = (v: number, r: [number, number]) => v >= r[0] && v <= r[1];
      const correlativoEnSuColumna = (i: ItemTexto) =>
        enRango(desplazamiento(i), cfg.offsets.correlativo) && /^\d+$/.test(i.str.trim());
      const codigoEnSuColumna = (i: ItemTexto) =>
        RE_CODIGO.test(i.str.trim()) ||
        (enRango(desplazamiento(i), cfg.offsets.codigo) && i.str.trim() === '-');
      const uvEnSuColumna = (i: ItemTexto) =>
        enRango(desplazamiento(i), cfg.offsets.uv) &&
        /^\d+$/.test(i.str.trim()) &&
        Number(i.str) <= cfg.uvMaxima;
      const traeCorrelativo = (f: Fila) => f.items.some(correlativoEnSuColumna);
      const traeCodigo = (f: Fila) => f.items.some(codigoEnSuColumna);
      const traeUv = (f: Fila) => f.items.some(uvEnSuColumna);

      const filasBase = enFilas(dentro, cfg.toleranciaFila);
      // En algunas páginas el correlativo va unos puntos por debajo del código aunque sea la
      // misma línea visual (2.5 a 6 pt en la página 3 del pensum de Administración). Sin este
      // pegote la fila de código se cerraba contra la de correlativo — ni siquiera llegaba a la
      // fila de UV, y tiraba el error — mientras la de correlativo abría una electiva fantasma.
      // Solo se absorbe la fila contigua que aporta lo que falta y que no es una fila de UV
      // (en el presencial el prerrequisito comparte rango con el correlativo).
      const filas: Fila[] = [];
      for (let i = 0; i < filasBase.length; i++) {
        const actual = filasBase[i]!;
        const vecina = filasBase[i + 1];
        const hueco = vecina ? actual.y - vecina.y : Number.POSITIVE_INFINITY;
        const mismaLineaVisual =
          vecina &&
          hueco > 0 &&
          hueco <= PEGAR_CORRELATIVO &&
          !traeUv(vecina) &&
          ((traeCodigo(actual) && !traeCorrelativo(actual) && traeCorrelativo(vecina)) ||
            (traeCorrelativo(actual) && !traeCodigo(actual) && traeCodigo(vecina))) &&
          !traeCodigo(vecina);
        if (mismaLineaVisual) {
          filas.push({ y: actual.y, items: [...actual.items, ...vecina!.items] });
          i++;
        } else {
          filas.push(actual);
        }
      }

      // --- filas de código: abren una asignatura ---
      const filasCodigo = filas.filter(
        (filaCodigo) =>
          traeCodigo(filaCodigo) ||
          // Solo por correlativo, y nunca si la fila ya es una de UV (ahí el número de la
          // izquierda es un prerrequisito, no el correlativo de una electiva).
          (cfg.electivaPorCorrelativo && traeCorrelativo(filaCodigo) && !traeUv(filaCodigo)),
      );
      if (filasCodigo.length === 0) {
        advertencias.push(`El ciclo ${titulo.numero} no tiene filas de código`);
        continue;
      }

      // Corte de sección: un hueco anormalmente grande separa el ciclo de lo que venga después.
      const huecos: number[] = [];
      for (let i = 1; i < filasCodigo.length; i++) huecos.push(filasCodigo[i - 1]!.y - filasCodigo[i]!.y);
      const medianaHueco = mediana(huecos);
      const umbral = medianaHueco === null ? Number.POSITIVE_INFINITY : medianaHueco * cfg.factorCorte;

      for (let i = 0; i < filasCodigo.length; i++) {
        const filaCodigo = filasCodigo[i]!;
        if (i > 0 && filasCodigo[i - 1]!.y - filaCodigo.y > umbral) break; // fin del ciclo

        const enFila = filaCodigo.items;
        const correlativoItem = enFila.find(correlativoEnSuColumna);
        const correlativo = correlativoItem ? Number(correlativoItem.str.trim()) : null;
        const codigoItem =
          enFila.find((it) => RE_CODIGO.test(it.str.trim())) ??
          enFila.find((it) => enRango(desplazamiento(it), cfg.offsets.codigo));
        // Sin código solo se acepta si la fila se abrió por correlativo (electiva del virtual).
        if (!codigoItem && !(cfg.electivaPorCorrelativo && correlativo !== null)) continue;
        const codigo = codigoItem ? codigoItem.str.trim() : '-';

        // Límite inferior de la asignatura: la siguiente fila de código SIN cortar. Si no hay
        // (última de la columna), el bloque se cerraba en el pie del documento y tragaba cifras
        // de leyendas y cajas ajenas: se acota por el mismo hueco que corta las secciones.
        const ySiguiente = filasCodigo[i + 1]?.y ?? filaCodigo.y - umbral;
        const dentroDeLaAsignatura = filas.filter((l) => l.y < filaCodigo.y && l.y > ySiguiente);

        // La fila de UV/prerrequisito es la última de la asignatura y la única con UV en su columna.
        const filaUv = [...dentroDeLaAsignatura]
          .reverse()
          .find((l) =>
            l.items.some((it) => {
              const v = it.str.trim();
              if (!/^\d+$/.test(v)) return false;
              const uv = Number(v);
              return enRango(desplazamiento(it), cfg.offsets.uv) && uv >= 1 && uv <= cfg.uvMaxima;
            }),
          );
        if (!filaUv) {
          throw new Error(
            `No se encontró la UV del ciclo ${titulo.numero}, fila de código ${codigo} (x=${filaCodigo.y.toFixed(1)})`,
          );
        }
        const uvItem = filaUv.items.find((it) => {
          const v = it.str.trim();
          if (!/^\d+$/.test(v)) return false;
          const uv = Number(v);
          return enRango(desplazamiento(it), cfg.offsets.uv) && uv >= 1 && uv <= cfg.uvMaxima;
        })!;
        const uv = Number(uvItem.str.trim());

        const esCampoPrerrequisito = (it: ItemTexto) =>
          enRango(desplazamiento(it), cfg.offsets.prerrequisito) &&
          ES_PRERREQUISITO.test(it.str.trim());

        // El prerrequisito del virtual está en su propia fila, por debajo de la de UV.
        // En presencial comparte fila con la UV (comportamiento de T4, sin cambios).
        const filaPrerr = cfg.prerrequisitoEnFilaPropia
          ? [...dentroDeLaAsignatura]
              .filter((l) => l.y <= filaUv.y)
              .sort((a, b) => b.y - a.y)
              .find((l) => l.items.some(esCampoPrerrequisito))
          : filaUv;
        const prereqItem = filaPrerr
          ? [...filaPrerr.items]
              .filter((it) =>
                cfg.prerrequisitoEnFilaPropia
                  ? esCampoPrerrequisito(it)
                  : enRango(desplazamiento(it), cfg.offsets.prerrequisito),
              )
              .sort((a, b) => a.x - b.x)[0]
          : undefined;
        const prerrequisito = prereqItem ? prereqItem.str.trim() : null;

        // Nombre: las filas que quedan entre la de código y la del prerrequisito (o la de UV).
        // Se une fila a fila (y de arriba abajo) y nunca entre líneas: si no, el orden por x
        // intercala las líneas y el nombre sale revuelto.
        // En la plantilla virtual la fila de UV además trae texto: se excluye solo el valor
        // de UV y su etiqueta, no la línea del nombre que la acompaña. Además, como en el
        // virtual la UV viaja en medio del nombre y una electiva puede no tener prerrequisito,
        // ese nombre se cierra en el fondo del bloque: cortarlo en la fila de UV dejaba las
        // electivas del ciclo IX sin nombre.
        const yLimiteNombre = filaPrerr
          ? filaPrerr.y
          : cfg.prerrequisitoEnFilaPropia
            ? ySiguiente
            : filaUv.y;
        const esRellenoDeUv = (it: ItemTexto) => {
          const v = it.str.trim();
          // El OCR devuelve la etiqueta como `Uv`, `uv` o `UV` según la celda: la etiqueta es
          // relleno en cualquiera de sus formas, y solo se filtra dentro de la columna de UV.
          return enRango(desplazamiento(it), cfg.offsets.uv) && (/^uv$/i.test(v) || /^\d+$/.test(v));
        };
        const crudo = filas
          .filter((l) => l.y < filaCodigo.y && l.y > yLimiteNombre)
          .sort((a, b) => b.y - a.y)
          .map((l) =>
            [...l.items]
              .filter((it) => !(cfg.prerrequisitoEnFilaPropia && esRellenoDeUv(it)))
              .sort((a, b) => a.x - b.x)
              .map((it) => it.str)
              .join(' '),
          )
          .join(' ');
        const laboratorio = crudo.includes('•');
        const nombre = crudo.replace(/[•*]/g, ' ').replace(/\s+/g, ' ').trim();
        if (nombre.length === 0) {
          throw new Error(`La asignatura ${codigo} del ciclo ${titulo.numero} salió sin nombre`);
        }

        asignaturas.push({
          codigo,
          nombre,
          uv,
          ciclo: titulo.numero,
          correlativo,
          prerrequisito,
          laboratorio,
          electiva: codigo === '-' || /^\s*electiva\b/i.test(nombre),
        });
      }
    }
  }

  if (asignaturas.length === 0) {
    throw new Error('El documento no produjo ninguna asignatura');
  }

  // RF-10: el prerrequisito se publica como **código**, nunca como correlativo.
  // `Bachillerato`, `-` y las marcas `**` de las electivas no son prerrequisito:
  // salen vacíos. Un correlativo que no apunte a ninguna materia publicada es
  // huérfano: advertencia + vacío (no bloquea; la parada total vive en T7).
  const codigoPorCorrelativo = new Map<number, string>();
  for (const a of asignaturas) {
    if (a.correlativo !== null) codigoPorCorrelativo.set(a.correlativo, a.codigo);
  }
  for (const a of asignaturas) {
    a.prerrequisito = resolverPrerrequisito(
      a.codigo,
      a.prerrequisito,
      codigoPorCorrelativo,
      advertencias,
    );
  }

  const ciclos: CicloCrudo[] = [];
  for (const numero of [...new Set(asignaturas.map((a) => a.ciclo))].sort((a, b) => a - b)) {
    ciclos.push({
      numero,
      asignaturas: asignaturas.filter((a) => a.ciclo === numero),
    });
  }

  return {
    ciclos,
    totales: {
      uvEncabezado,
      materiasEncabezado,
      uvSuma: asignaturas.reduce((suma, a) => suma + a.uv, 0),
      materiasConteo: asignaturas.length,
    },
    advertencias,
  };
}
