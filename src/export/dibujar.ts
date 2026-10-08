// Dibujo de la tarjeta de resultado sobre un `canvas` (spec 003, RF-1, RF-2, RF-9).
//
// El contexto llega por parámetro (D6): así la capa de dibujo se prueba en Node con
// un `Lienzo` grabador y la función sigue siendo pura de hecho. La creación del
// `canvas`, el `toBlob()` y el reloj viven en el componente.

import type { Tarjeta } from '../domain/exportar.ts';
import { envolverTexto, pieDeTarjeta } from '../domain/exportar.ts';
import type { Tema } from './tema.ts';

/**
 * Subconjunto de `CanvasRenderingContext2D` que usa el dibujante: un contexto real
 * lo cumple tal cual, y en los tests se sustituye por un grabador.
 */
export interface Lienzo {
  font: string;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  textAlign: CanvasTextAlign;
  save(): void;
  restore(): void;
  scale(x: number, y: number): void;
  fillRect(x: number, y: number, ancho: number, alto: number): void;
  strokeRect(x: number, y: number, ancho: number, alto: number): void;
  fillText(texto: string, x: number, y: number): void;
  measureText(texto: string): { width: number };
}

/** Altura de la barra de progreso en píxeles lógicos. */
const ALTO_BARRA = 8;
/** Paso vertical entre las líneas del nombre de carrera. */
const PASO_LINEA = 22;

function fuente(peso: number, cuerpo: number, tema: Tema): string {
  return `${peso} ${cuerpo}px ${tema.familia}`;
}

function pintar(
  ctx: Lienzo,
  contenido: string,
  x: number,
  y: number,
  fuenteTexto: string,
  color: string,
  alineacion: CanvasTextAlign = 'left',
): void {
  ctx.font = fuenteTexto;
  ctx.fillStyle = color;
  ctx.textAlign = alineacion;
  ctx.fillText(contenido, x, y);
}

/**
 * Pinta la tarjeta completa en coordenadas lógicas; el `scale(tema.escala)` de aquí
 * hace que salga rasterizada a 2× (RNF-2).
 */
export function dibujarTarjeta(ctx: Lienzo, tarjeta: Tarjeta, tema: Tema): void {
  const { ancho, alto, margen } = tema;
  const anchoUtil = ancho - margen * 2;

  ctx.save();
  ctx.scale(tema.escala, tema.escala);

  // Fondo y filete: versión clara fija (D5), sin depender del modo oscuro del sistema.
  ctx.fillStyle = tema.colores.fondo;
  ctx.fillRect(0, 0, ancho, alto);
  ctx.strokeStyle = tema.colores.borde;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, ancho - 1, alto - 1);

  let y = margen + tema.tipografia.etiqueta;
  pintar(
    ctx,
    tarjeta.etiqueta.toUpperCase(),
    margen,
    y,
    fuente(600, tema.tipografia.etiqueta, tema),
    tema.colores.textoSuave,
  );

  y += 8 + tema.tipografia.valor;
  pintar(
    ctx,
    tarjeta.valor,
    margen,
    y,
    fuente(700, tema.tipografia.valor, tema),
    tema.colores.texto,
  );

  y += 32;
  pintar(
    ctx,
    tarjeta.desglose,
    margen,
    y,
    fuente(400, tema.tipografia.desglose, tema),
    tema.colores.textoSuave,
  );

  // Barra de progreso: pista neutra + relleno con el acento verde de la app.
  const barraY = y + 24;
  ctx.fillStyle = tema.colores.pista;
  ctx.fillRect(margen, barraY, anchoUtil, ALTO_BARRA);
  ctx.fillStyle = tema.colores.acento;
  ctx.fillRect(margen, barraY, (anchoUtil * tarjeta.progreso) / 100, ALTO_BARRA);

  y = barraY + ALTO_BARRA + 24;
  pintar(
    ctx,
    tarjeta.conteo,
    margen,
    y,
    fuente(400, tema.tipografia.conteo, tema),
    tema.colores.textoSuave,
  );

  // Separador tenue antes de la identificación de la carrera.
  y += 28;
  ctx.fillStyle = tema.colores.borde;
  ctx.fillRect(margen, y, anchoUtil, 1);

  // Nombre de carrera ajustado al ancho disponible (HU-3, RNF-7).
  y += 40;
  const fuenteCarrera = fuente(600, tema.tipografia.carrera, tema);
  ctx.font = fuenteCarrera; // se fija ANTES de medir: measureText usa la fuente activa
  const lineas = envolverTexto(tarjeta.carrera, anchoUtil, (texto) => ctx.measureText(texto).width);
  for (const linea of lineas) {
    pintar(ctx, linea, margen, y, fuenteCarrera, tema.colores.texto);
    y += PASO_LINEA;
  }

  y += 10;
  pintar(
    ctx,
    `${tarjeta.sede} · ${tarjeta.plan}`,
    margen,
    y,
    fuente(400, tema.tipografia.sede, tema),
    tema.colores.textoSuave,
  );

  // Pie con la app y la fecha de generación, alineado a la derecha (RF-2).
  pintar(
    ctx,
    pieDeTarjeta(tarjeta),
    ancho - margen,
    alto - margen,
    fuente(400, tema.tipografia.pie, tema),
    tema.colores.textoSuave,
    'right',
  );

  ctx.restore();
}
