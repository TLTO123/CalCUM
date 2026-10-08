// Único punto de contacto con pdfjs-dist (plan §2, D1).
// Se usa el build *legacy*: el build moderno exige DOM y falla dentro de Node.

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface ItemTexto {
  /** Texto del ítem tal como aparece en el PDF. */
  str: string;
  /** Coordenada horizontal en puntos. */
  x: number;
  /** Coordenada vertical en puntos; crece hacia arriba. */
  y: number;
  /** Ancho del ítem en puntos. Permite fusionar texto partido (T5: la plantilla virtual
   * emite los códigos letra a letra). */
  width: number;
}

/** Hueco con el que se separa cada página al apilarlas (pt). Debe superar cualquier texto. */
const HUECO_ENTRE_PAGINAS = 100;

/**
 * Devuelve los ítems de texto de **todas** las páginas con sus coordenadas.
 * El PDF del pensum es infográfico: el orden lineal no corresponde al visual,
 * por eso se conserva x/y (RF-8 y caso límite 1).
 *
 * Las páginas se apilan hacia abajo (la N queda bajo la N-1, separadas por un hueco mayor
 * que cualquier texto): así una fila nunca se mezcla con la de la página vecina y cada
 * rótulo de ciclo abre su propia banda. Casi todos los pensums son de una sola página;
 * `pensum_licenciatura_en_administracion.pdf` reparte sus 44 materias en 3, y leer solo la
 * primera dejaba 24 materias fuera.
 */
export async function itemsDeDocumento(bytes: Uint8Array): Promise<ItemTexto[]> {
  // pdfjs **transfiere** el ArrayBuffer al worker y lo desconecta: sin la copia, la segunda
  // corrida con la misma fuente revienta con `Cannot transfer object of unsupported type`
  // y rompería la reproducibilidad (RF-12: dos corridas con la misma entrada ⇒ mismo byte).
  const tarea = getDocument({ data: bytes.slice(), useSystemFonts: true });
  // La destrucción del worker vive en la tarea de carga, no en el documento.
  try {
    const documento = await tarea.promise;
    const items: ItemTexto[] = [];
    let desplazamientoY = 0;
    for (let numero = 1; numero <= documento.numPages; numero++) {
      const pagina = await documento.getPage(numero);
      const contenido = await pagina.getTextContent();
      for (const candidato of contenido.items) {
        // Los TextMarkedContent no llevan texto ni transform: se descartan.
        if (!('str' in candidato)) continue;
        const x = candidato.transform[4];
        const y = candidato.transform[5];
        if (typeof x !== 'number' || typeof y !== 'number') continue;
        const width = candidato.width;
        items.push({
          str: candidato.str,
          x,
          y: y + desplazamientoY,
          width: typeof width === 'number' ? width : 0,
        });
      }
      const [, yMin, , yMax] = pagina.view;
      desplazamientoY -= yMax - yMin + HUECO_ENTRE_PAGINAS;
    }
    return items;
  } finally {
    await tarea.destroy();
  }
}

/**
 * `view` de la primera página en puntos (`[x0, y0, x1, y1]`): la referencia de geometría
 * de un pensum publicado **como imagen** (B²). El PDF fija la escala y la imagen aporta
 * los píxeles; sin este dato el OCR no tendría unidades comparables con el resto.
 */
export async function vistaDeDocumento(bytes: Uint8Array): Promise<readonly number[]> {
  const tarea = getDocument({ data: bytes.slice(), useSystemFonts: true });
  try {
    const documento = await tarea.promise;
    const pagina = await documento.getPage(1);
    return [...(pagina.view as number[])];
  } finally {
    await tarea.destroy();
  }
}
