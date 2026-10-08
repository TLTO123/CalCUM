import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dibujarTarjeta } from '../src/export/dibujar.ts';
import type { Lienzo } from '../src/export/dibujar.ts';
import { TEMA_CLARO } from '../src/export/tema.ts';
import { prepararTarjeta } from '../src/domain/exportar.ts';
import type { CumResult, Fecha, Plan, Sede } from '../src/domain/tipos.ts';

const HOY: Fecha = { dia: 7, mes: 10, anio: 2026 };

function planPrueba(sede: Sede = 'soyapango', materiasTotal = 43): Plan {
  return {
    carrera: 'Lic. en Idiomas con Especialidad en Lenguas Extranjeras',
    sede,
    tipo: 'licenciatura',
    planVersion: 'plan-2024',
    modalidad: 'Semipresencial',
    uvTotal: 161,
    materiasTotal,
    ciclos: [],
  };
}

function resultado(parcial: Partial<CumResult>): CumResult {
  return { cum: null, sumaUM: 0, sumaUV: 0, contadas: 0, aprobadas: 0, reprobadas: 0, ...parcial };
}

interface Llamada {
  texto: string;
  x: number;
  y: number;
  fuente: string;
  alineacion: string;
  relleno: string;
}

interface Rect {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  relleno: string;
}

/** `Lienzo` grabador: mide 8 px por carácter y registra todo lo que se pinta. */
function ctxFalso() {
  const textos: Llamada[] = [];
  const rectangulos: Rect[] = [];
  const escalas: number[][] = [];
  const guardados = { save: 0, restore: 0 };

  const ctx: Lienzo = {
    font: '',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    textAlign: 'left',
    save() {
      guardados.save += 1;
    },
    restore() {
      guardados.restore += 1;
    },
    scale(x, y) {
      escalas.push([x, y]);
    },
    fillRect(x, y, ancho, alto) {
      rectangulos.push({ x, y, ancho, alto, relleno: String(ctx.fillStyle) });
    },
    strokeRect() {},
    fillText(texto, x, y) {
      textos.push({
        texto,
        x,
        y,
        fuente: ctx.font,
        alineacion: String(ctx.textAlign),
        relleno: String(ctx.fillStyle),
      });
    },
    measureText(texto) {
      return { width: texto.length * 8 };
    },
  };

  return { ctx, textos, rectangulos, escalas, guardados };
}

/** Ancho que el grabador devuelve para el texto (8 px por carácter). */
const anchoDe = (texto: string): number => texto.length * 8;

function pintar(tarjeta = prepararTarjeta(planPrueba(), resultado({}), HOY)) {
  const falso = ctxFalso();
  dibujarTarjeta(falso.ctx, tarjeta, TEMA_CLARO);
  return falso;
}

test('RNF-2: el lienzo lógico es 720×440 y se rasteriza a escala 2× (1440×880)', () => {
  assert.equal(TEMA_CLARO.ancho, 720);
  assert.equal(TEMA_CLARO.alto, 440);
  assert.equal(TEMA_CLARO.escala, 2);
  assert.equal(TEMA_CLARO.ancho * TEMA_CLARO.escala, 1440);
  assert.equal(TEMA_CLARO.alto * TEMA_CLARO.escala, 880);

  const { escalas } = pintar();
  assert.deepEqual(escalas, [[2, 2]]);
});

test('RF-1/RF-2: se pintan valor, desglose, conteo, carrera, sede, plan y pie', () => {
  const tarjeta = prepararTarjeta(
    planPrueba(),
    resultado({ cum: 8.5, sumaUM: 1234, sumaUV: 145, contadas: 17, aprobadas: 14, reprobadas: 3 }),
    HOY,
  );
  const { textos } = pintar(tarjeta);
  const pintados = textos.map((t) => t.texto);

  assert.ok(pintados.includes('TU C.U.M'), 'etiqueta');
  assert.ok(pintados.includes('8.50'), 'valor a 2 decimales');
  assert.ok(pintados.includes('1234.00 UM / 145 UV'), 'desglose');
  assert.ok(pintados.includes('17 / 43 materias cursadas · 14 aprobadas · 3 reprobadas'), 'conteo');
  assert.ok(pintados.includes(tarjeta.carrera), 'carrera');
  assert.ok(
    pintados.some((t) => t.includes('Campus Soyapango') && t.includes('plan-2024')),
    'sede y plan',
  );
  assert.ok(pintados.some((t) => t.includes('CalCUM UDB') && t.includes('07/10/2026')), 'pie');
});

test('RF-9/RF-10: con el indicador vacío también se pinta la tarjeta', () => {
  const { textos } = pintar();
  assert.ok(textos.some((t) => t.texto === '—'));
  assert.ok(textos.some((t) => t.texto.includes('Aún no has registrado')));
});

test('RNF-7: ningún texto se sale de los límites del lienzo', () => {
  const tarjeta = prepararTarjeta(
    planPrueba(),
    resultado({ cum: 7.33, sumaUM: 88, sumaUV: 12, contadas: 3, aprobadas: 2, reprobadas: 1 }),
    HOY,
  );
  const { textos } = pintar(tarjeta);
  assert.ok(textos.length >= 6, 'hay texto que pintar');

  for (const t of textos) {
    const ancho = anchoDe(t.texto);
    const izquierda = t.alineacion === 'right' ? t.x - ancho : t.x;
    const derecha = t.alineacion === 'right' ? t.x : t.x + ancho;
    assert.ok(izquierda >= 0, `"${t.texto}" se sale por la izquierda (${izquierda})`);
    assert.ok(derecha <= TEMA_CLARO.ancho, `"${t.texto}" se sale por la derecha (${derecha})`);
    assert.ok(t.y > 0 && t.y <= TEMA_CLARO.alto, `"${t.texto}" sale por arriba/abajo (${t.y})`);
  }
});

test('RNF-7: todos los textos usan la tipografía y la paleta clara de la app', () => {
  const { textos, rectangulos } = pintar();

  for (const t of textos) {
    assert.ok(t.fuente.includes(TEMA_CLARO.familia), `fuente fuera de la app: "${t.fuente}"`);
    assert.ok(
      [TEMA_CLARO.colores.texto, TEMA_CLARO.colores.textoSuave].includes(t.relleno),
      `color fuera de la paleta clara: ${t.relleno}`,
    );
  }
  // El fondo es blanco (versión clara, D5) y la pista de la barra es neutra.
  const fondo = rectangulos.find((r) => r.x === 0 && r.y === 0);
  assert.equal(fondo?.relleno, '#ffffff');
});

test('RF-9: la barra de progreso mide 0 %, 50 % y 100 % del ancho disponible', () => {
  const anchoBarra = TEMA_CLARO.ancho - TEMA_CLARO.margen * 2;
  const casos = [
    { total: 43, contadas: 0, esperado: 0 },
    { total: 40, contadas: 20, esperado: 50 },
    { total: 43, contadas: 43, esperado: 100 },
  ];

  for (const { total, contadas, esperado } of casos) {
    const tarjeta = prepararTarjeta(
      planPrueba('soyapango', total),
      resultado({ contadas }),
      HOY,
    );
    assert.equal(tarjeta.progreso, esperado);
    const { rectangulos } = pintar(tarjeta);

    const pista = rectangulos.find((r) => r.relleno === TEMA_CLARO.colores.pista);
    assert.ok(pista, 'la pista de la barra existe');
    assert.equal(Math.round(pista.ancho), anchoBarra);

    const relleno = rectangulos.find((r) => r.relleno === TEMA_CLARO.colores.acento);
    assert.ok(relleno, 'el relleno de la barra existe');
    assert.equal(Math.round(relleno.ancho), Math.round((anchoBarra * esperado) / 100));
    assert.equal(relleno.alto, pista.alto);
    assert.equal(relleno.x, pista.x);
    assert.equal(relleno.y, pista.y);
  }
});

test('RF-9: la tarjeta se pinta igual para las tres sedes y no rompe con plan vacío', () => {
  for (const sede of ['soyapango', 'antiguo-cuscatlan', 'virtual'] as const) {
    const { textos, rectangulos } = pintar(
      prepararTarjeta(planPrueba(sede), resultado({ cum: 9, contadas: 1, sumaUM: 4, sumaUV: 4, aprobadas: 1 }), HOY),
    );
    assert.ok(textos.length > 0);
    assert.ok(rectangulos.length > 0);
    for (const t of textos) assert.ok(Number.isFinite(t.x) && Number.isFinite(t.y));
  }
});

test('un contexto de canvas real cumple `Lienzo` (comprobación de tipos para la T4)', () => {
  // Si `CanvasRenderingContext2D` dejara de encajar con `Lienzo`, esto no compila.
  const comoLienzo = (ctx: CanvasRenderingContext2D): Lienzo => ctx;
  assert.equal(typeof comoLienzo, 'function');
});

test('dibujo determinista: dos pinturas de la misma tarjeta hacen las mismas llamadas', () => {
  const tarjeta = prepararTarjeta(
    planPrueba(),
    resultado({ cum: 9.1, sumaUM: 91, sumaUV: 10, contadas: 2, aprobadas: 2 }),
    HOY,
  );
  const primera = pintar(tarjeta);
  const segunda = pintar(tarjeta);
  assert.deepEqual(primera.textos, segunda.textos);
  assert.deepEqual(primera.rectangulos, segunda.rectangulos);
  assert.equal(primera.guardados.save, primera.guardados.restore);
});
