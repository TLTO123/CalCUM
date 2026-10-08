// T3 — Carga de fuentes sin red (plan §2, RF-16, RNF-1, RNF-3). Ampliado en B² con la
// imagen `<nombre>.jpg`, que solo piden los planes cuyo PDF va sin capa de texto.
//
// Los PDF viven en `pipeline/fuentes/` como fuente fija: la generación NO usa la red salvo con
// `--refresco` (decisión D2). Si una fuente falta, se falla ruidosamente en lugar de bajarla
// por las tuyas: la reproducibilidad (RF-12) manda (P2: nunca fallar en silencio).

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Directorio de las fuentes, relativo a la raíz del proyecto (se ejecuta desde ahí). */
export const DIRECTORIO_FUENTES = 'pipeline/fuentes';

/** Red que solo se usa con `--refresco`; se inyecta para poder probar que no se usa. */
export type Descargador = (url: string) => Promise<Uint8Array>;

export interface Fuente {
  /** URL normalizada (siempre `https://`). */
  url: string;
  /** Ruta local del PDF. */
  ruta: string;
  /** Contenido del documento. */
  bytes: Uint8Array;
  /** `local` = leída de disco · `red` = descargada en esta corrida con `--refresco`. */
  origen: 'local' | 'red';
}

export interface OpcionesCarga {
  /** Solo con `true` se permite la red (equivalente a `npm run datos:refrescar`). */
  refresco?: boolean;
  /** Directorio de fuentes; por defecto `pipeline/fuentes`. */
  directorio?: string;
  /** Descargador inyectable; por defecto `fetch`. */
  descargar?: Descargador;
}

/** Enlaces publicados como `http://` redirigen a `https://` (caso límite 8): se normalizan ya. */
export function normalizarUrl(url: string): string {
  return url.replace(/^http:\/\//i, 'https://');
}

/** Nombre local del PDF derivado de su URL: estable y legible (44 URL distintas ⇒ 44 nombres). */
export function nombreDeFuente(url: string): string {
  const ruta = new URL(normalizarUrl(url)).pathname;
  const nombre = decodeURIComponent(ruta.slice(ruta.lastIndexOf('/') + 1));
  if (!nombre.toLowerCase().endsWith('.pdf')) {
    throw new Error(`La URL no apunta a un documento PDF: ${url}`);
  }
  return nombre;
}

/** Ruta local donde (debe) vivir el PDF de esa URL. */
export function rutaDeFuente(url: string, directorio = DIRECTORIO_FUENTES): string {
  return join(directorio, nombreDeFuente(url));
}

/**
 * Nombre local de la **imagen** del pensum: el sitio publica `<mismo nombre>.jpg` al lado del
 * PDF. Es derivado, no curado a mano, para que el manifiesto siga teniendo una sola URL por
 * plan (RF-16) y no haya dos fuentes que puedir desincronizarse.
 */
export function nombreDeImagen(url: string): string {
  return nombreDeFuente(url).replace(/\.pdf$/i, '.jpg');
}

/** Ruta local donde (debe) vivir la imagen de esa URL. */
export function rutaDeImagen(url: string, directorio = DIRECTORIO_FUENTES): string {
  return join(directorio, nombreDeImagen(url));
}

function esPdf(bytes: Uint8Array): boolean {
  const cabecera = new TextDecoder('latin1').decode(bytes.subarray(0, 5));
  return bytes.length > 0 && cabecera.startsWith('%PDF');
}

/** Cabecera JPEG: `FF D8 FF`. Un HTML de error de descarga no la trae. */
function esJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

async function descargarPorRed(url: string): Promise<Uint8Array> {
  const respuesta = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    redirect: 'follow',
  });
  if (!respuesta.ok) {
    throw new Error(`HTTP ${respuesta.status} al descargar ${url}`);
  }
  return new Uint8Array(await respuesta.arrayBuffer());
}

/**
 * Devuelve los bytes del PDF de esa URL.
 *
 * - Sin `--refresco`: **solo lectura de disco**; si falta el archivo lanza un error que ordena
 *   refrescar (nunca descarga por su cuenta).
 * - Con `--refresco`: descarga, valida que sea un PDF y lo guarda en `directorio`.
 */
export async function cargarFuente(url: string, opciones: OpcionesCarga = {}): Promise<Fuente> {
  const { refresco = false, directorio = DIRECTORIO_FUENTES, descargar = descargarPorRed } = opciones;
  const urlNormalizada = normalizarUrl(url);
  const ruta = rutaDeFuente(urlNormalizada, directorio);

  if (!refresco) {
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await readFile(ruta));
    } catch {
      throw new Error(
        `Falta la fuente local "${ruta}" (origen: ${urlNormalizada}). ` +
          'Ejecuta `npm run datos:refrescar` para descargarla; sin ese flag no hay red.',
      );
    }
    if (!esPdf(bytes)) {
      throw new Error(`La fuente local "${ruta}" no es un PDF válido (no empieza por %PDF).`);
    }
    return { url: urlNormalizada, ruta, bytes, origen: 'local' };
  }

  const bytes = await descargar(urlNormalizada);
  if (!esPdf(bytes)) {
    throw new Error(
      `Descarga rechazada para ${urlNormalizada}: el contenido no es un PDF válido ` +
        `(vacío o sin cabecera %PDF).`,
    );
  }
  await mkdir(directorio, { recursive: true });
  await writeFile(ruta, bytes);
  return { url: urlNormalizada, ruta, bytes, origen: 'red' };
}

/**
 * Devuelve los bytes del `.jpg` que acompaña al PDF de esa URL. Solo la piden los planes sin
 * capa de texto (B², RF-14): los demás pasan de largo y el manifiesto no cambia.
 *
 * Mismas reglas que `cargarFuente`: sin `--refresco` **solo disco**, con `--refresco` descarga
 * y valida antes de guardar. Si falta, el error ordena refrescar en lugar de improvisar.
 */
export async function cargarImagen(url: string, opciones: OpcionesCarga = {}): Promise<Uint8Array> {
  const { refresco = false, directorio = DIRECTORIO_FUENTES, descargar = descargarPorRed } = opciones;
  const ruta = rutaDeImagen(url, directorio);
  const urlImagen = normalizarUrl(url).replace(/\.pdf$/i, '.jpg');

  if (!refresco) {
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await readFile(ruta));
    } catch {
      throw new Error(
        `Falta la imagen local "${ruta}" (origen: ${urlImagen}). ` +
          'Ejecuta `npm run datos:refrescar` para descargarla; sin ese flag no hay red.',
      );
    }
    if (!esJpeg(bytes)) {
      throw new Error(`La imagen local "${ruta}" no es un JPEG válido (sin cabecera FF D8 FF).`);
    }
    return bytes;
  }

  const bytes = await descargar(urlImagen);
  if (!esJpeg(bytes)) {
    throw new Error(
      `Descarga rechazada para ${urlImagen}: el contenido no es un JPEG válido ` +
        `(vacío o sin cabecera FF D8 FF).`,
    );
  }
  await mkdir(directorio, { recursive: true });
  await writeFile(ruta, bytes);
  return bytes;
}
