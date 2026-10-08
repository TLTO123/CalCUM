// Contenido de la imagen que se exporta/comparte (spec 003, RF-1, RF-2, RF-9).
// P5: funciones puras; sin DOM, sin reloj y sin red — el canvas y el `new Date()`
// viven en la capa de interfaz.

import type { CumResult, Plan, Sede } from './tipos.ts';

/** Fecha de generación de la tarjeta: llega como parámetro (nunca `new Date()` aquí). */
export interface Fecha {
  dia: number;
  mes: number;
  anio: number;
}

/**
 * Texto de la tarjeta exportada, ya cuantificado para que la capa de dibujo solo
 * tenga que pintarlo. Es exactamente el estado visible del panel (RF-9).
 */
export interface Tarjeta {
  etiqueta: string;
  /** C.U.M a 2 decimales, o el indicador vacío cuando no hay materias cursadas. */
  valor: string;
  desglose: string;
  /** Avance 0–100 (entero), acotado para la barra de progreso. */
  progreso: number;
  conteo: string;
  carrera: string;
  /** Etiqueta legible de la sede, no su clave ("Campus Soyapango"). */
  sede: string;
  plan: string;
  fecha: Fecha;
}

/**
 * Etiquetas de sede legibles. Espejo de las que usa `FormularioCarrera.tsx`:
 * viven aquí (y no en `domain/cascada`) para que la spec 003 no tenga que tocar
 * el formulario; si cambia una, cambia la otra.
 */
const ETIQUETAS_SEDE: Record<Sede, string> = {
  soyapango: 'Campus Soyapango',
  'antiguo-cuscatlan': 'Campus Antiguo Cuscatlán',
  virtual: 'UDB Virtual',
};

const ETIQUETA_VACIA = 'Aún no has registrado ninguna materia.';
const VALOR_VACIO = '—';

/**
 * Desglose visible `ΣUM / ΣUV`, con las UM a **2 decimales** como el valor del
 * C.U.M: sin eso se cuela el artefacto de coma flotante (`148.39999999999998`).
 * El panel y la tarjeta usan esta misma función, que son idénticos (RF-9).
 */
export function desgloseDe(resultado: CumResult): string {
  if (resultado.cum === null) return ETIQUETA_VACIA;
  return `${resultado.sumaUM.toFixed(2)} UM / ${resultado.sumaUV} UV`;
}

/**
 * Prepara el contenido de la imagen a partir del resultado ya calculado.
 * No recalcula el C.U.M: copia lo que el panel muestra (RF-9).
 */
export function prepararTarjeta(plan: Plan, resultado: CumResult, hoy: Fecha): Tarjeta {
  const vacio = resultado.cum === null;

  // Mismo cálculo de avance que el panel (RF-9); sin total => 0, nunca NaN.
  const progreso =
    plan.materiasTotal > 0
      ? Math.min(100, Math.round((resultado.contadas / plan.materiasTotal) * 100))
      : 0;

  let conteo = `${resultado.contadas} / ${plan.materiasTotal} materias cursadas`;
  if (resultado.contadas > 0) {
    conteo += ` · ${resultado.aprobadas} aprobadas · ${resultado.reprobadas} reprobadas`;
  }

  return {
    etiqueta: 'Tu C.U.M',
    valor: vacio ? VALOR_VACIO : resultado.cum.toFixed(2),
    desglose: desgloseDe(resultado),
    progreso,
    conteo,
    carrera: plan.carrera,
    sede: ETIQUETAS_SEDE[plan.sede],
    plan: plan.planVersion,
    fecha: hoy,
  };
}

/** "07/10/2026" con relleno de ceros (para el pie de la imagen). */
export function formatoFecha(fecha: Fecha): string {
  const dia = String(fecha.dia).padStart(2, '0');
  const mes = String(fecha.mes).padStart(2, '0');
  return `${dia}/${mes}/${fecha.anio}`;
}

/** Texto del pie de la imagen: identifica la app y la fecha de generación. */
export function pieDeTarjeta(tarjeta: Tarjeta): string {
  return `CalCUM UDB · ${formatoFecha(tarjeta.fecha)}`;
}

/** Nombre del archivo exportado: `calcum-<slug-carrera>-<aaaa-mm-dd>.png` (D11). */
export function nombreDeArchivo(tarjeta: Tarjeta): string {
  const dia = String(tarjeta.fecha.dia).padStart(2, '0');
  const mes = String(tarjeta.fecha.mes).padStart(2, '0');
  const iso = `${tarjeta.fecha.anio}-${mes}-${dia}`;
  return `calcum-${aSlug(tarjeta.carrera)}-${iso}.png`;
}

/** Minúsculas sin acentos ni símbolos, con guiones: seguro para un nombre de archivo. */
function aSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Parte `texto` en líneas de como mucho `anchoMax`, usando `medir` para conocer el
 * ancho real (en el navegador es `ctx.measureText`; en los tests, un medidor fijo).
 * No corta palabras salvo que una sola supere el ancho disponible (HU-3, RNF-7).
 */
export function envolverTexto(
  texto: string,
  anchoMax: number,
  medir: (texto: string) => number,
): string[] {
  const lineas: string[] = [];

  for (const parrafo of texto.split('\n')) {
    const palabras = parrafo.split(/\s+/).filter(Boolean);
    if (palabras.length === 0) {
      lineas.push('');
      continue;
    }

    let actual = '';
    for (const palabra of palabras) {
      const candidata = actual === '' ? palabra : `${actual} ${palabra}`;
      if (medir(candidata) <= anchoMax) {
        actual = candidata;
        continue;
      }
      if (actual !== '') {
        lineas.push(actual);
        actual = '';
      }
      if (medir(palabra) <= anchoMax) {
        actual = palabra;
        continue;
      }
      // Palabra sola más larga que el ancho: se parte por caracteres.
      let resto = palabra;
      while (medir(resto) > anchoMax) {
        let corte = 1;
        while (corte < resto.length && medir(resto.slice(0, corte + 1)) <= anchoMax) corte += 1;
        lineas.push(resto.slice(0, corte));
        resto = resto.slice(corte);
      }
      actual = resto;
    }
    if (actual !== '') lineas.push(actual);
  }

  return lineas;
}
