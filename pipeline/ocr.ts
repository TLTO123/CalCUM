// T8 (B²) — OCR de los pensums que UDB Virtual publica sin capa de texto (RF-14).
//
// Los 7 PDF ilegibles vienen de Illustrator: el texto está dibujado como trazos
// (0 operadores `Tj`, sin `ActualText`) y solo sobreviven los dígitos de UV, de modo que
// `itemsDeDocumento` no puede leerlos. La fuente es el `.jpg` que el propio sitio publica
// junto al PDF (`<mismo nombre>.jpg`); el PDF sigue mandando la geometría: su `page.view`
// fija los puntos y la imagen aporta los píxeles.
//
// **Dos pasadas**, porque ningún único modo de segmentación (PSM) ve a la vez el texto
// blanco sobre azul de los rótulos de ciclo y el cuerpo de la tabla:
//   PSM 3 → cuerpo: códigos, correlativos, nombres, UV y prerrequisitos;
//   PSM 6 → los rótulos `Ciclo I…` y las palabras que el PSM 3 se deja (p. ej. el `4` de
//           una celda cuyo nombre también falló).
//
// **Cómo se fusionan**: cada palabra aporta su línea base *propia* (el borde inferior de su
// caja), no la de la línea ajustada por tesseract. Es la clave: el PSM 6 suele pegar en una
// sola línea dos líneas visuales contiguas y su baseline desplazada ~6 pt hacía que la misma
// palabra cayera en filas distintas, con lo que la fusión la duplicaba o intercambiaba el
// orden del nombre. Agrupando por caja de palabra, las dos pasadas caen en la misma línea y
// dentro de ella se resuelve por solape en x: gana la mayor confianza.
//
// **Cada columna se agrupa por su cuenta**: las celdas se centran por separado, así que
// dentro de una columna las líneas reales están a 12 pt, pero entre columnas se intercalan a
// 5–7,6 pt. Ninguna tolerancia global servía: con 6 `DAW901` se quedaba sola (6,3 pt de su
// correlativo, que venía anclado por otra columna) y con 8 `y Matrices` se pegaba a
// `Álgebra Vectorial`. Los límites de columna salen de los rótulos con el mismo criterio que
// `parsearItems` abre sus regiones. Además, en una misma columna se descarta lo que sea la
// misma palabra leída dos veces en filas contiguas (~9 pt de salto entre pasadas, más que la
// tolerancia de línea): sin eso salían `Software Software` o un `Á` suelto por la tilde.
//
// Sin red (RF-12): el core y el worker salen de `node_modules` y el modelo `spa` de
// `pipeline/tessdata` (`langPath` local + `cacheMethod: 'none'`: ni CDN ni caché en disco).

import type { ItemTexto } from './pdf.ts';
// El agrupado abre columnas con el mismo criterio que `parsearItems` (mismo margen de rótulo):
// si uno corrigiera el borde y el otro no, una palabra caería en la fila de otra columna.
// Los offsets de celda van en el mismo paquete: la relectura de UV localiza la celda con los
// números exactos del parser, no con unos equivalentes.
import {
  MARGEN_ROTULO_VIRTUAL,
  OFFSET_CODIGO_VIRTUAL,
  OFFSET_CORRELATIVO_VIRTUAL,
  OFFSET_UV_VIRTUAL,
  UV_MAXIMA,
} from './parsear.ts';

/**
 * Confianza mínima para conservar una palabra que no parece un código. A 60 se pierden
 * los restos de trazos del fondo (`arcado`, `E`, `Ú`, todos con 44–58) y nada de lo real:
 * los dígitos van ≥ 78 y `Bachillerato` ≥ 93.
 */
export const UMBRAL_CONFIANZA = 60;

/** Directorio con `spa.traineddata.gz`, relativo a la raíz del proyecto. */
export const DIRECTORIO_TESSDATA = 'pipeline/tessdata';

/** Auto (3) para el cuerpo, bloque único (6) para los rótulos y línea (7) para una celda. */
const PSM_CUERPO = '3';
const PSM_ROTULOS = '6';
const PSM_CELDA = '7';

/** Alfabeto con el que se relee una celda de código: sin él sale `ElIC901` en vez de `EIC901`. */
const ALFABETO_CODIGO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Alfabeto y PSM con los que se relee una celda de UV (ver `releerUv`). */
const ALFABETO_DIGITO = '0123456789';
const PSM_UV = '6';

/** Padding (pt) alrededor de la celda de UV, sobre el recorte calibrado por sus hermanas. */
const HOLGURA_X_UV = 10;
const HOLGURA_Y_UV = 12;

/**
 * Separación (pt) entre el valor de una celda de UV y su etiqueta `UV`, que va por debajo.
 * Es el hueco en el que tesseract a veces devuelve la etiqueta como número (`10`, `1`).
 */
const RANGO_ETIQUETA_UV: [number, number] = [8, 30];

/** Hueco (pt) por debajo de la última fila de código de una columna, cuando no hay siguiente. */
const HUECO_FINAL_UV = 70;

const RE_DIGITO = /^\d+$/;

/** Separación entre líneas visuales: ~12 pt, y las colas de `g`/`p`/`y` bajan ≤ 4. */
const TOLERANCIA_LINEA = 6;

/** Desalineación máxima (pt) entre `Ciclo` y su romano, y entre dos rótulos de una barra. */
const TOLERANCIA_Y_ROTULO = 10;

/**
 * Separación máxima (pt) entre dos filas que aún pueden ser la misma palabra leída dos veces.
 * Dentro de una columna las líneas reales están a 12 pt, así que 11 no cruza filas de verdad:
 * cubre el salto de ~9 pt con que el PSM 6 repite una palabra que ya leyó el PSM 3.
 */
const TOLERANCIA_FILA_VECINA = 11;

/** Distancia máxima entre `Ciclo` y su romano, en múltiplos del ancho de `Ciclo`. */
const SEPARACION_MAX_ROTULO = 2;

/**
 * Recortes con los que se relee la celda de un código borroso. Ninguno sirve por sí solo:
 * la lectura depende de cuánto glifo entra en el recorte, y con el original (`10/10/45`)
 * ninguno de los tres códigos ilegibles de UDB Virtual se recupera (`DIE9O5`, `1EP920`,
 * `TF0919`). Validado contra los tres: toda geometría con 14–20 pt por arriba en PSM 7 los
 * devuelve bien (`DIE905`, `IEP920`, `TFO919`), así que se combinan seis y gana la mayoría
 * (`mejorCodigo`). Las distancias son respecto a la caja del propio código.
 */
const RECORTES_CODIGO: { arriba: number; abajo: number; radio: number }[] = [
  { arriba: 16, abajo: 10, radio: 45 },
  { arriba: 16, abajo: 14, radio: 45 },
  { arriba: 16, abajo: 8, radio: 45 },
  { arriba: 14, abajo: 14, radio: 45 },
  { arriba: 20, abajo: 14, radio: 45 },
  { arriba: 16, abajo: 10, radio: 60 },
];

const RE_CICLO = /^ciclo$/i;
const RE_TITULO = /^ciclo\s+([ivxl]+)$/i;
/** Códigos del dataset: 2–4 letras y 3 dígitos. */
const RE_CODIGO = /^[A-Z]{2,4}\d{3}$/;
/** Lo que OCR llega a producir: letras y `3` dígitos con `O`/`I`/`l` colados en el número. */
const RE_CODIGO_BORROSO = /[A-Za-z]{2,4}[\dOIl]{3}/;
/** Caracteres con los que tesseract confunde un `I` romano en la barra del rótulo. */
const CONFUNDIBLES_CON_I = /[|¦!l1]/g;

export interface OpcionesOcr {
  /** Directorio con los modelos de idioma; por defecto `pipeline/tessdata`. */
  tessdata?: string;
  /** Confianza mínima para lo que no es código; por defecto {@link UMBRAL_CONFIANZA}. */
  umbral?: number;
}

interface Caja {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface PalabraTesseract {
  text: string;
  confidence: number;
  bbox: Caja;
}

interface LineaTesseract {
  baseline: Caja;
  words: PalabraTesseract[];
}

interface ParrafoTesseract {
  lines: LineaTesseract[];
}

interface BloqueTesseract {
  paragraphs: ParrafoTesseract[];
}

interface Trabajador {
  setParameters(parametros: Record<string, string>): Promise<void>;
  recognize(
    imagen: Uint8Array,
    opciones: Record<string, unknown>,
    salida: Record<string, boolean>,
  ): Promise<{ data: { blocks?: BloqueTesseract[]; text?: string } }>;
  terminate(): Promise<void>;
}

type CreadorDeTrabajador = (
  idiomas?: string,
  oem?: number,
  opciones?: Record<string, unknown>,
) => Promise<Trabajador>;

/** Palabra leída por una de las dos pasadas, en puntos y con `y` creciendo hacia arriba. */
interface Palabra {
  str: string;
  x: number;
  /** Borde inferior de su caja: su propia línea base, independiente del agrupado. */
  y: number;
  width: number;
  conf: number;
  origen: 'cuerpo' | 'respaldo';
}

/** Línea visual: todas sus palabras comparten `y`, que es lo que luego formará la fila. */
interface Linea {
  y: number;
  palabras: Palabra[];
}

/**
 * Barra azul de rótulos: su `y` y los límites `[desde, hasta)` en x de cada una de sus
 * columnas, calculados con el mismo criterio con el que `parsearItems` abre las regiones
 * (`titulo.x - margenTitulo`, y la última hasta `+ ancho`). Si el agrupado no coincidiera
 * con el parser, una palabra se agruparía con la fila de otra columna y la fila de código
 * saldría partida en dos.
 */
interface Barra {
  y: number;
  columnas: [number, number][];
}

/** Palabra ya situada en la fila visual que la contiene: `y` es la mediana de esa fila. */
interface Candidato {
  p: Palabra;
  y: number;
}

interface Escala {
  x0: number;
  y1: number;
  kx: number;
  ky: number;
}

/** Dimensiones en píxeles leyendo el marcador SOF del JPEG. */
export function dimsJpeg(bytes: Uint8Array): { ancho: number; alto: number } {
  let i = 2;
  while (i < bytes.length - 9) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    const marca = bytes[i + 1]!;
    if (marca >= 0xc0 && marca <= 0xc3) {
      return {
        alto: (bytes[i + 5]! << 8) | bytes[i + 6]!,
        ancho: (bytes[i + 7]! << 8) | bytes[i + 8]!,
      };
    }
    // SOI/EOI, RSTn y TEM no llevan longitud.
    if (marca === 0xd8 || (marca >= 0xd0 && marca <= 0xd9) || marca === 0x01) {
      i += 2;
      continue;
    }
    if (marca === 0xda) break; // SOS: después viene el entrelazado, no nos sirve.
    i += 2 + (((bytes[i + 2] ?? 0) << 8) | (bytes[i + 3] ?? 0));
  }
  throw new Error('el JPEG no tiene marcador SOF (¿archivo corrupto?)');
}

/** `page.view` → factores píxel→punto y comprobación de que imagen y página coinciden. */
function factores(vista: readonly number[], dims: { ancho: number; alto: number }): Escala {
  if (vista.length < 4 || !vista.every((v) => Number.isFinite(v))) {
    throw new Error(`view de página inválido: [${vista.join(', ')}]`);
  }
  const [x0, y0, x1, y1] = vista as [number, number, number, number];
  const anchoPt = x1 - x0;
  const altoPt = y1 - y0;
  const kx = anchoPt / dims.ancho;
  const ky = altoPt / dims.alto;
  // Un escalo distinto en x e y solo se tolera si es ruido de redondeo: si la imagen no
  // es el render de esa página, las columnas se leerían desplazadas y el parseo mentiría.
  if (Math.abs(kx - ky) / kx > 0.002) {
    throw new Error(
      `la imagen no corresponde a la página: relación de aspecto ` +
        `${(anchoPt / altoPt).toFixed(4)} (puntos) vs ${(dims.ancho / dims.alto).toFixed(4)} (píxeles)`,
    );
  }
  return { x0, y1, kx, ky };
}

function mediana(valores: number[]): number {
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[medio]! : (orden[medio - 1]! + orden[medio]!) / 2;
}

/** Agrupa palabras por línea visual usando su **propio** borde inferior de caja. */
function agruparPorLinea(palabras: Palabra[]): Linea[] {
  const grupos: { ancla: number; palabras: Palabra[] }[] = [];
  for (const p of [...palabras].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const grupo = grupos.find((g) => Math.abs(g.ancla - p.y) <= TOLERANCIA_LINEA);
    if (grupo) grupo.palabras.push(p);
    else grupos.push({ ancla: p.y, palabras: [p] });
  }
  return grupos.map((g) => ({ y: mediana(g.palabras.map((p) => p.y)), palabras: g.palabras }));
}

/**
 * Clave de agrupado de una palabra: la barra de rótulos que la gobierna y su columna.
 *
 * La barra es la más próxima **por encima** (lo que queda entre dos barras pertenece a la de
 * arriba: son los ciclos de esa tira) y la columna se decide por el centro de la palabra,
 * que es lo que hace `parsearItems`. Sin barra (encabezado, pie) o fuera de toda columna,
 * la palabra cae en un grupo suelto de su banda: se agrupa, pero nunca mezcla columnas.
 */
function claveDeGrupo(p: Palabra, barras: Barra[]): string {
  const porEncima = barras.filter((b) => b.y >= p.y);
  if (porEncima.length === 0) return 'cabecera';
  const barra = porEncima.reduce((a, b) => (b.y < a.y ? b : a));
  const indice = barras.indexOf(barra);
  const centro = p.x + p.width / 2;
  const columna = barra.columnas.findIndex(([desde, hasta]) => centro >= desde && centro < hasta);
  return `${indice}:${columna < 0 ? 'x' : columna}`;
}

/**
 * Parte el cuerpo en grupos de (barra, columna). Cada grupo se agrega después en líneas
 * **por su cuenta**, que es lo que hace falta.
 *
 * Hacía falta porque las celdas se centran por separado: dentro de una columna las líneas
 * están a 12 pt, pero entre columnas se intercalan a 5–7,6 pt, de modo que ninguna
 * tolerancia global servía. Con una sola tolerancia de 6 el ancla salía de otra columna
 * (`DAW901` quedaba a 6,3 pt del `3` de su fila y salía sola); con 8, `y Matrices` se
 * pegaba a `Álgebra Vectorial` y se leían juntas.
 */
function agruparPorColumna(palabras: Palabra[], barras: Barra[]): Palabra[][] {
  const grupos = new Map<string, Palabra[]>();
  for (const p of palabras) {
    const clave = claveDeGrupo(p, barras);
    const grupo = grupos.get(clave);
    if (grupo) grupo.push(p);
    else grupos.set(clave, [p]);
  }
  return [...grupos.values()];
}

/** `|`, `l`, `1`… tal como tesseract los devuelve en los rótulos de ciclo → romano. */
function romanoDe(token: string): string | null {
  const limpio = token.trim().replace(CONFUNDIBLES_CON_I, 'I').toUpperCase();
  return /^[IVXL]+$/.test(limpio) ? limpio : null;
}

/**
 * Separa las líneas que son rótulos de ciclo. Devuelve un ítem `Ciclo <romano>` por rótulo
 * y deja esas bandas fuera del cuerpo: en la barra azul no hay nada más que rótulos. También
 * devuelve los límites de columna de cada barra, que es con lo que se agrupa el cuerpo.
 *
 * Dos atajos que costaron trabajo:
 *  - `Ciclo` y su romano llegan con alturas distintas (hasta 7 pt: el borde inferior de la
 *    caja de `V` o `X` no es el de `Ciclo`), así que se emparejan **por cercanía horizontal**
 *    y no por pertenecer a la misma fila; con la fila estricta, el `Ciclo` de la columna I
 *    se quedaba sin romano o se emparejaba con el `V` de la columna V.
 *  - `leerTitulos` agrupa rótulos con 5 pt: si cada uno va con su y, una barra de 5 columnas
 *    se convierte en 5 filas y todas las regiones salen vacías. Se les da un y común.
 */
function separarTitulos(
  palabras: Palabra[],
): { titulos: ItemTexto[]; cuerpo: Palabra[]; barras: Barra[] } {
  const esRenglon = (p: Palabra): boolean => {
    const t = p.str.trim();
    return RE_CICLO.test(t) || RE_TITULO.test(t);
  };

  // La misma palabra viene de las dos pasadas: sin colapsarla saldría un rótulo duplicado.
  const renglones: Palabra[] = [];
  for (const p of [...palabras].filter(esRenglon).sort((a, b) => b.y - a.y || a.x - b.x)) {
    if (renglones.some((r) => Math.abs(r.x - p.x) <= 1 && Math.abs(r.y - p.y) <= TOLERANCIA_Y_ROTULO)) {
      continue;
    }
    renglones.push(p);
  }

  // Una barra azul = una tira de columnas; se agrupa con la tolerancia holgada.
  const barras: { y: number; items: Palabra[] }[] = [];
  for (const p of renglones) {
    const barra = barras.find((b) => Math.abs(b.y - p.y) <= TOLERANCIA_Y_ROTULO);
    if (barra) barra.items.push(p);
    else barras.push({ y: p.y, items: [p] });
  }

  const usados = new Set<Palabra>();
  const titulos: ItemTexto[] = [];
  const columnas: Barra[] = [];
  for (const barra of barras) {
    barra.y = mediana(barra.items.map((i) => i.y));
    const titulosBarra: ItemTexto[] = [];
    for (const c of [...barra.items].sort((a, b) => a.x - b.x)) {
      const completo = c.str.trim().match(RE_TITULO);
      if (completo) {
        usados.add(c);
        titulosBarra.push({
          str: `Ciclo ${completo[1]!.toUpperCase()}`,
          x: c.x,
          y: barra.y,
          width: c.width,
        });
        continue;
      }
      // El romano es la palabra romana más próxima a la derecha dentro de su celda.
      const pareja = palabras
        .filter(
          (p) =>
            !usados.has(p) &&
            p !== c &&
            Math.abs(p.y - c.y) <= TOLERANCIA_Y_ROTULO &&
            p.x > c.x &&
            p.x - c.x <= c.width * SEPARACION_MAX_ROTULO &&
            romanoDe(p.str) !== null,
        )
        .sort((a, b) => a.x - b.x)[0];
      usados.add(c);
      if (!pareja) continue;
      usados.add(pareja);
      titulosBarra.push({
        str: `Ciclo ${romanoDe(pareja.str)!}`,
        x: c.x,
        y: barra.y,
        width: pareja.x + pareja.width - c.x,
      });
    }
    columnas.push({ y: barra.y, columnas: limitesDeColumnas(titulosBarra) });
    titulos.push(...titulosBarra);
  }

  // De la banda de cada barra no se salva nada al cuerpo, ni siquiera el romano huérfano.
  const cuerpo = palabras.filter(
    (p) => !barras.some((b) => Math.abs(p.y - b.y) <= TOLERANCIA_Y_ROTULO),
  );
  return { titulos, cuerpo, barras: columnas };
}

/**
 * Límites `[desde, hasta)` en x de las columnas de una barra, **idénticos** a los que
 * `parsearItems` calcula para sus regiones: cada columna empieza en `titulo.x - margen`
 * y termina en el título siguiente menos ese margen (la última, `+ ancho`, que es la
 * separación media entre rótulos).
 */
function limitesDeColumnas(titulosBarra: ItemTexto[]): [number, number][] {
  const xs = [...titulosBarra].sort((a, b) => a.x - b.x).map((t) => t.x);
  // Con un solo rótulo no hay rejilla: se agrupa por banda y no por columna.
  if (xs.length < 2) return [];
  const ancho = (xs[xs.length - 1]! - xs[0]!) / (xs.length - 1);
  const limites = xs.map((x) => x - MARGEN_ROTULO_VIRTUAL);
  return xs.map((_, k) => [
    limites[k]!,
    k < xs.length - 1 ? limites[k + 1]! : limites[k]! + ancho,
  ]);
}

const solapa = (a: Palabra, b: Palabra): boolean =>
  a.x < b.x + b.width + 1 && b.x < a.x + a.width + 1;

/**
 * De una línea: filtra por confianza (los códigos borrosos nunca se filtran: `ElIC901` viene
 * con confianza 9 y aún así hay que intentar releeerlo) y resuelve los solapes entre pasadas:
 * gana la mayor confianza y, a igualdad, la palabra más larga. Todas sobrevivientes quedan con
 * la `y` común de la línea, que es lo que `parsearItems` usará para formar filas.
 */
function candidatosDeLinea(linea: Linea, umbral: number): Candidato[] {
  const utiles = linea.palabras.filter(
    (p) => p.str.trim() && (p.conf >= umbral || RE_CODIGO_BORROSO.test(p.str.trim())),
  );
  if (utiles.length === 0) return [];
  const esCodigo = (p: Palabra): boolean => RE_CODIGO_BORROSO.test(p.str.trim());
  const ordenadas = [...utiles].sort(
    (a, b) =>
      // Un código nunca pierde su celda contra una palabra suelta de la otra pasada: si no,
      // el `DWF901` de confianza media se va y la fila queda sin código.
      Number(esCodigo(b)) - Number(esCodigo(a)) ||
      b.conf - a.conf ||
      b.str.length - a.str.length ||
      (a.origen === 'cuerpo' ? -1 : 1),
  );
  const retenidas: Palabra[] = [];
  for (const p of ordenadas) {
    if (retenidas.some((r) => solapa(r, p))) continue;
    retenidas.push(p);
  }
  const y = mediana(retenidas.map((p) => p.y));
  return retenidas.map((p) => ({ p, y }));
}

/** ¿Las dos palabras pueden ser la misma leída dos veces: igual, o una prefijo de la otra? */
const relacionadas = (a: string, b: string): boolean => {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  return x === y || x.startsWith(y) || y.startsWith(x);
};

/**
 * Quita lo que es la misma palabra leída dos veces en filas contiguas de la misma columna.
 *
 * Son ~9 pt de salto entre una pasada y otra, más que la tolerancia de línea, así que
 * quedaban en dos filas: el nombre salía `Software Software` y la tilde de `Álgebra`, leída
 * como letra por el PSM 6, aparecía como un `Á` suelto delante. Solo se descarta si las
 * cajas se solapan y los textos son el mismo o uno es prefijo del otro: palabras distintas
 * de filas vecinas (`y` frente a `Álgebra Vectorial`) no se tocan.
 */
function depurarFilasVecinas(candidatos: Candidato[]): Candidato[] {
  const ordenados = [...candidatos].sort(
    (a, b) =>
      b.p.conf - a.p.conf ||
      b.p.str.length - a.p.str.length ||
      (a.p.origen === 'cuerpo' ? -1 : 1),
  );
  const finales: Candidato[] = [];
  for (const candidato of ordenados) {
    const repetido = finales.some(
      (guardada) =>
        Math.abs(guardada.y - candidato.y) <= TOLERANCIA_FILA_VECINA &&
        relacionadas(guardada.p.str, candidato.p.str) &&
        solapa(guardada.p, candidato.p),
    );
    if (!repetido) finales.push(candidato);
  }
  return finales;
}

/** Ítems de un grupo de (barra, columna): sus líneas, sin duplicados entre filas vecinas. */
function itemsDeGrupo(grupo: Palabra[], umbral: number): ItemTexto[] {
  const candidatos = agruparPorLinea(grupo).flatMap((linea) =>
    candidatosDeLinea(linea, umbral),
  );
  return depurarFilasVecinas(candidatos).map((c) => ({
    str: c.p.str.trim(),
    x: c.p.x,
    y: c.y,
    width: c.p.width,
  }));
}

/** Palabras de la salida `blocks` de tesseract → `Palabra[]` en puntos. */
function aPalabras(
  bloques: BloqueTesseract[] | undefined,
  escala: Escala,
  origen: Palabra['origen'],
): Palabra[] {
  const palabras: Palabra[] = [];
  for (const bloque of bloques ?? []) {
    for (const parrafo of bloque.paragraphs) {
      for (const linea of parrafo.lines) {
        for (const palabra of linea.words) {
          const str = palabra.text.trim();
          if (!str) continue;
          palabras.push({
            str,
            x: escala.x0 + palabra.bbox.x0 * escala.kx,
            y: escala.y1 - palabra.bbox.y1 * escala.ky,
            width: (palabra.bbox.x1 - palabra.bbox.x0) * escala.kx,
            conf: palabra.confidence,
            origen,
          });
        }
      }
    }
  }
  return palabras;
}

/** `tesseract.js` es CJS: en ESM sus export nombrados no siempre sobreviven al lexer. */
async function importarCreador(): Promise<CreadorDeTrabajador> {
  const modulo = (await import('tesseract.js')) as unknown as {
    createWorker?: CreadorDeTrabajador;
    default?: { createWorker?: CreadorDeTrabajador };
  };
  const crear = modulo.createWorker ?? modulo.default?.createWorker;
  if (!crear) throw new Error('tesseract.js no expone createWorker');
  return crear;
}

/**
 * Extrae de un código borroso el código real. La celda se recorta y se relee sola con
 * alfabeto restringido: es lo que separa `EIC901` de `ElIC901`. Si ni así sale un código
 * del dataset, falla en silencio no sirve de nada (P2, RF-13): se detiene todo.
 */
function normalizarCodigo(texto: string): string | null {
  const coincidencia = texto.match(RE_CODIGO_BORROSO);
  if (!coincidencia) return null;
  const crudo = coincidencia[0];
  // En la parte numérica `O` e `I`/`l` son errores de lectura, no dígitos válidos.
  const letras = crudo.slice(0, -3).toUpperCase();
  const digitos = crudo.slice(-3).replace(/[OIl]/g, (c) => (c === 'O' ? '0' : '1'));
  const codigo = `${letras}${digitos}`;
  return RE_CODIGO.test(codigo) ? codigo : null;
}

function rectanguloDe(
  item: ItemTexto,
  escala: Escala,
  recorte: { arriba: number; abajo: number; radio: number },
): Record<string, number> {
  return rectanguloDeRango(
    item.x - recorte.radio,
    item.x + item.width + recorte.radio,
    item.y + recorte.arriba,
    item.y - recorte.abajo,
    escala,
  );
}

/** Recorte en puntos → rectángulo en píxeles. `arriba` va por encima de `abajo`. */
function rectanguloDeRango(
  izquierda: number,
  derecha: number,
  arriba: number,
  abajo: number,
  escala: Escala,
): Record<string, number> {
  return {
    left: Math.max(0, Math.round((izquierda - escala.x0) / escala.kx)),
    top: Math.max(0, Math.round((escala.y1 - arriba) / escala.ky)),
    width: Math.round((derecha - izquierda) / escala.kx),
    height: Math.round((arriba - abajo) / escala.ky),
  };
}

/**
 * Mejor lectura entre las de los varios recortes: gana el código más repetido (que varias
 * geometrías independientes coincidan es la evidencia de que el glifo se leyó bien) y, a
 * igualdad, el más largo —un recorte corto devuelve `TF091` y otro `TFO919`, y el que trae
 * los tres dígitos es el bueno—.
 */
function mejorCodigo(codigos: string[]): string | null {
  if (codigos.length === 0) return null;
  const cuenta = new Map<string, number>();
  for (const c of codigos) cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
  const ordenados = [...cuenta.entries()].sort(
    (a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0]),
  );
  return ordenados[0]![0];
}

async function releerCodigos(
  trabajador: Trabajador,
  imagen: Uint8Array,
  items: ItemTexto[],
  escala: Escala,
): Promise<void> {
  const pendientes = items.filter(
    (i) => !RE_CODIGO.test(i.str) && RE_CODIGO_BORROSO.test(i.str),
  );
  if (pendientes.length === 0) return;
  await trabajador.setParameters({
    tessedit_pageseg_mode: PSM_CELDA,
    tessedit_char_whitelist: ALFABETO_CODIGO,
  });
  for (const item of pendientes) {
    const codigos: string[] = [];
    const brutas: string[] = [];
    for (const recorte of RECORTES_CODIGO) {
      const respuesta = await trabajador.recognize(
        imagen,
        { rectangle: rectanguloDe(item, escala, recorte) },
        { text: true },
      );
      const texto = respuesta.data.text ?? '';
      brutas.push(texto.replace(/\s+/g, ' ').trim().slice(0, 60));
      const codigo = normalizarCodigo(texto);
      if (codigo) codigos.push(codigo);
    }
    const codigo = mejorCodigo(codigos);
    if (!codigo) {
      throw new Error(
        `código de materia ilegible incluso tras releeer su celda con ${RECORTES_CODIGO.length} recortes: ` +
          `«${item.str}» (x=${item.x.toFixed(1)}, y=${item.y.toFixed(1)}) · ` +
          `las celdas dicen ${JSON.stringify(brutas)}`,
      );
    }
    item.str = codigo;
  }
}

/** Dónde cae el dígito de una celda de UV: la posición de las UV legibles de su columna. */
interface CalibracionUv {
  x: number;
  width: number;
  /** Distancia (pt) entre la fila de código y su UV; la celda va por debajo de su correlativo. */
  delta: number;
}

/**
 * Repara la columna de UV de una página ilegible (RF-14), en los dos sentidos: descarta la
 * etiqueta `UV` cuando tesseract la devuelve como número, y recorre las celdas de valor que
 * la página entera no llega a segmentar.
 *
 * El `4` de una celda de UV es un glifo aislado de ~11 px y ninguno de los PSM de página
 * (3, 6, 11, 12, 13), ni tres pases con lista de dígitos, devuelve nada donde la imagen lo
 * muestra: verificado en Lic. Diseño Gráfico, seis celdas ilegibles (cinco `4` y un `8`).
 * Sí se leen con un recorte de la propia celda, y la geometría de ese recorte no se adivina:
 * se toma de las UV que **sí** se leyeron en la misma columna (`CalibracionUv`), que es lo
 * que separa el `8` de la fila 39 de los `14` que el recorte genérico lee en su lugar.
 *
 * La detección replica el criterio de `parsearItems`: cada fila de código (correlativo o
 * código) debe tener una UV entre ella y la siguiente fila de código de su columna. Si la
 * hay, no se toca nada; si no, se recorta y se relee. El parámetro es que **no lanza
 * excepción** cuando la celda sigue sin leerse: `parsearItems` se detiene con su propio
 * mensaje cuando la UV hace falta de verdad (RF-13), y aquí habría filas fuera del corte de
 * sección —las del bloque de electivas, por ejemplo— que el parser ignora y este detector no
 * distingue: lanzar rompería planes que parsean bien.
 *
 * Solo corre sobre documentos con al menos una UV legible en la geometría de la plantilla
 * virtual (la única que publica imágenes): en cualquier otra, no encuentra anclas y no toca
 * nada.
 */
async function releerUv(
  trabajador: Trabajador,
  imagen: Uint8Array,
  items: ItemTexto[],
  escala: Escala,
  barras: Barra[],
): Promise<void> {
  const enRango = (v: number, r: [number, number]) => v >= r[0] && v <= r[1];
  // Mismas regiones que `parsearItems`: banda vertical entre esta barra y la siguiente, y
  // columna decidida por el centro del ítem.
  const columnas: { tx: number; items: ItemTexto[] }[] = [];
  for (let f = 0; f < barras.length; f++) {
    const yTope = barras[f]!.y;
    const yFondo = barras[f + 1]?.y ?? Number.NEGATIVE_INFINITY;
    const banda = items.filter((i) => i.y < yTope - 1 && i.y > yFondo);
    for (const [desde, hasta] of barras[f]!.columnas) {
      const dentro = banda.filter((i) => {
        const centro = i.x + i.width / 2;
        return centro >= desde && centro < hasta;
      });
      columnas.push({ tx: desde + MARGEN_ROTULO_VIRTUAL, items: dentro });
    }
  }

  const correlativos = (col: { tx: number; items: ItemTexto[] }) =>
    col.items.filter((i) => RE_DIGITO.test(i.str) && enRango(i.x - col.tx, OFFSET_CORRELATIVO_VIRTUAL));
  const uvs = (col: { tx: number; items: ItemTexto[] }) =>
    col.items.filter(
      (i) =>
        RE_DIGITO.test(i.str) &&
        Number(i.str) >= 1 &&
        Number(i.str) <= UV_MAXIMA &&
        enRango(i.x - col.tx, OFFSET_UV_VIRTUAL),
    );

  // La etiqueta `UV` vive **por debajo** del valor dentro de la misma celda (8–30 pt más
  // abajo, verificado en las tres rejillas) y a veces tesseract la devuelve como número:
  // `10` en Marketing y `1` en Diseño Gráfico. Al estar en rango de UV y ser la fila más
  // baja de su asignatura, es justo la que `parsearItems` elige, y la suma con el sitio
  // descuadra por ella (+12 y −3 UV). Si hay dos números apilados en una celda, el de abajo
  // es la etiqueta: se descarta antes de calibrar y de buscar huecos.
  const etiquetas: ItemTexto[] = [];
  for (const col of columnas) {
    const numericas = uvs(col);
    for (const u of numericas) {
      if (
        numericas.some(
          (v) => v !== u && v.y - u.y >= RANGO_ETIQUETA_UV[0] && v.y - u.y <= RANGO_ETIQUETA_UV[1],
        )
      ) {
        etiquetas.push(u);
      }
    }
  }
  if (etiquetas.length > 0) {
    const fuera = new Set(etiquetas);
    for (let i = items.length - 1; i >= 0; i--) if (fuera.has(items[i]!)) items.splice(i, 1);
  }

  // Calibración: x del dígito y su distancia al correlativo, medida sobre las UV que sí se
  // leyeron. Si no hay ninguna en todo el documento, no hay geometría fiable que usar.
  const calibraciones: CalibracionUv[][] = [];
  const global: CalibracionUv[] = [];
  for (const col of columnas) {
    const corr = correlativos(col);
    const cal: CalibracionUv[] = [];
    for (const u of uvs(col)) {
      const deltas = corr
        .map((c) => c.y - u.y)
        .filter((h) => h > 0 && h < 60)
        .sort((a, b) => a - b);
      if (deltas[0] === undefined) continue;
      const m: CalibracionUv = { x: u.x, width: u.width, delta: deltas[0]! };
      cal.push(m);
      global.push(m);
    }
    calibraciones.push(cal);
  }
  if (global.length === 0) return;

  await trabajador.setParameters({
    tessedit_pageseg_mode: PSM_UV,
    tessedit_char_whitelist: ALFABETO_DIGITO,
  });

  const reparadas: ItemTexto[] = [];
  for (let c = 0; c < columnas.length; c++) {
    const col = columnas[c]!;
    const anclas = col.items.filter(
      (i) =>
        (RE_DIGITO.test(i.str) && enRango(i.x - col.tx, OFFSET_CORRELATIVO_VIRTUAL)) ||
        (enRango(i.x - col.tx, OFFSET_CODIGO_VIRTUAL) &&
          (RE_CODIGO.test(i.str) || RE_CODIGO_BORROSO.test(i.str))),
    );
    // Correlativo y código van en la misma línea visual: sin agruparlos, el hueco entre dos
    // anclas de una misma fila sería cero y cada fila dispararía una relectura de más.
    const filas: number[] = [];
    for (const a of [...anclas].sort((a, b) => b.y - a.y)) {
      if (filas.length > 0 && Math.abs(filas[filas.length - 1]! - a.y) <= TOLERANCIA_LINEA) continue;
      filas.push(a.y);
    }
    if (filas.length === 0) continue;
    const uv = uvs(col);
    const cal = calibraciones[c]!.length > 0 ? calibraciones[c]! : global;
    for (let i = 0; i < filas.length; i++) {
      const yAncla = filas[i]!;
      const ySiguiente = filas[i + 1] ?? yAncla - HUECO_FINAL_UV;
      if (uv.some((u) => u.y < yAncla && u.y > ySiguiente)) continue;
      const reparada = await repararUv(trabajador, imagen, escala, yAncla, ySiguiente, cal);
      if (reparada) reparadas.push(reparada);
    }
  }
  if (reparadas.length === 0) return;
  items.push(...reparadas);
  items.sort((a, b) => b.y - a.y || a.x - b.x);
}

/**
 * Recorta la celda de UV que le corresponde a la fila `yAncla` y devuelve el ítem leído, o
 * `null` si ni el recorte calibrado devuelve un número creíble (entonces no se toca nada y
 * decide `parsearItems`).
 */
async function repararUv(
  trabajador: Trabajador,
  imagen: Uint8Array,
  escala: Escala,
  yAncla: number,
  ySiguiente: number,
  cal: CalibracionUv[],
): Promise<ItemTexto | null> {
  const deltas = cal.map((c) => c.delta);
  const xs = cal.map((c) => c.x);
  const anchos = cal.map((c) => c.width);
  const izquierda = Math.min(...xs) - HOLGURA_X_UV;
  const derecha = Math.max(...xs.map((x, i) => x + anchos[i]!)) + HOLGURA_X_UV;
  const respuesta = await trabajador.recognize(
    imagen,
    {
      rectangle: rectanguloDeRango(
        izquierda,
        derecha,
        yAncla - Math.min(...deltas) + HOLGURA_Y_UV,
        yAncla - Math.max(...deltas) - HOLGURA_Y_UV,
        escala,
      ),
    },
    { text: true },
  );
  const leido = (respuesta.data.text ?? '').match(/\d+/);
  if (!leido) return null;
  const uv = Number(leido[0]);
  if (!(uv >= 1 && uv <= UV_MAXIMA)) return null;

  // El ítem se inyecta dentro de la asignatura que lo pide, nunca en la fila de su
  // correlativo (que dejaría de abrir una electiva) ni bajo la siguiente fila de código.
  const delta = Math.min(Math.max(mediana(deltas), 10), yAncla - ySiguiente - 5);
  if (delta < 10) return null;
  return { str: String(uv), x: mediana(xs), y: yAncla - delta, width: mediana(anchos) };
}

/**
 * Ítems de texto de un pensum publicado como imagen, en la misma convención que
 * `itemsDeDocumento`: puntos, `y` creciendo hacia arriba y una fila visual por línea.
 *
 * La imagen debe ser el render de `vista` (`page.view` del PDF): si sus relaciones de
 * aspecto no coinciden, falla ruidosamente en lugar de publicar coordenadas inventadas.
 */
export async function itemsDeImagen(
  imagen: Uint8Array,
  vista: readonly number[],
  opciones: OpcionesOcr = {},
): Promise<ItemTexto[]> {
  const umbral = opciones.umbral ?? UMBRAL_CONFIANZA;
  const escala = factores(vista, dimsJpeg(imagen));

  const crear = await importarCreador();
  const trabajador = await crear('spa', 1, {
    langPath: opciones.tessdata ?? DIRECTORIO_TESSDATA,
    cacheMethod: 'none',
    gzip: true,
  });
  try {
    // El core no arranca en PSM 3 (tesseract.js lo restaura): hay que fijarlo.
    await trabajador.setParameters({ tessedit_pageseg_mode: PSM_CUERPO });
    const cuerpo = await trabajador.recognize(imagen, {}, { blocks: true });
    await trabajador.setParameters({ tessedit_pageseg_mode: PSM_ROTULOS });
    const respaldo = await trabajador.recognize(imagen, {}, { blocks: true });

    const palabras = [
      ...aPalabras(cuerpo.data.blocks, escala, 'cuerpo'),
      ...aPalabras(respaldo.data.blocks, escala, 'respaldo'),
    ];
    const { titulos, cuerpo: sinRenglones, barras } = separarTitulos(palabras);
    const items = agruparPorColumna(sinRenglones, barras).flatMap((grupo) =>
      itemsDeGrupo(grupo, umbral),
    );
    // Orden de página: el encabezado se lee en el orden de entrada.
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    await releerCodigos(trabajador, imagen, items, escala);
    await releerUv(trabajador, imagen, items, escala, barras);
    return [...items, ...titulos];
  } finally {
    await trabajador.terminate();
  }
}
