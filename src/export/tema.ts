// Apariencia de la imagen exportada (spec 003, D5: tema claro fijo; D12: constante).
//
// Espejo de la paleta y la tipografía de `src/app/estilos.css`. Se declaran como
// constantes —y no se leen del DOM— para que la imagen sea determinista y testeable
// en Node; si cambian los colores de la app, hay que cambiarlos aquí (checklist de
// cierre, RNF-7).

export interface Tema {
  /** Factor de rasterizado: el lienzo lógico se dibuja a esta escala (RNF-2). */
  escala: number;
  /** Dimensiones lógicas de la tarjeta (el PNG mide ancho×escala por alto×escala). */
  ancho: number;
  alto: number;
  /** Retirada interior de los textos y de la barra. */
  margen: number;
  /** Misma pila de fuentes que `estilos.css` (RNF-7). */
  familia: string;
  colores: {
    fondo: string;
    texto: string;
    textoSuave: string;
    borde: string;
    pista: string;
    acento: string;
    reprobada: string;
  };
  /** Cuerpo en píxeles lógicos de cada bloque de texto. */
  tipografia: {
    etiqueta: number;
    valor: number;
    desglose: number;
    conteo: number;
    carrera: number;
    sede: number;
    pie: number;
  };
}

export const TEMA_CLARO: Tema = {
  escala: 2,
  ancho: 720,
  alto: 440,
  margen: 32,
  familia: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  colores: {
    fondo: '#ffffff',
    texto: '#111827',
    textoSuave: '#4b5563',
    borde: '#e5e7eb',
    pista: '#e5e7eb',
    // Mismos acentos que estilos.css (RNF-7). El verde lleva la barra de progreso;
    // el rojo queda declarado como parte de la paleta aunque el desglose de
    // aprobadas/reprobadas viaje en una sola línea de texto.
    acento: '#2e9e5b',
    reprobada: '#d05252',
  },
  tipografia: {
    etiqueta: 12,
    valor: 72,
    desglose: 15,
    conteo: 14,
    carrera: 16,
    sede: 13,
    pie: 12,
  },
};
