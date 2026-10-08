// Señal de "¿el usuario llegó a ver un diálogo de compartir?" (spec 003, RF-11, decisiones D14/D16).
//
// Mientras `share()` está pendiente, una hoja de compartir del sistema **roba el foco** a la
// pestaña (o la oculta, en móvil). El fallo que motivó el RF-11 no abrió nada: la página nunca
// perdió el foco y el navegador rechazó a los 30 s. Con esa marca se distingue una cancelación
// real —que no descarga, D4— de un navegador que simplemente no pudo compartir —que descarga—.
//
// `window` y `document` llegan por parámetro (D16): la pieza se prueba en Node con dobles y en
// el navegador real la aporta `CumPanel.tsx`.

/** Subconjunto de `Window` que se usa (un `window` real lo cumple tal cual). */
export interface VentanaHoja {
  addEventListener(tipo: string, oyente: () => void): void;
  removeEventListener(tipo: string, oyente: () => void): void;
}

/** Subconjunto de `Document` que se usa (un `document` real lo cumple tal cual). */
export interface DocumentoHoja {
  readonly visibilityState: 'visible' | 'hidden' | string;
  addEventListener(tipo: string, oyente: () => void): void;
  removeEventListener(tipo: string, oyente: () => void): void;
}

export interface Hoja {
  /** Limpia la marca y se asegura de estar escuchando: se llama antes de cada intento. */
  reiniciar(): void;
  /** `true` si, mientras `share()` estaba pendiente, la pestaña perdió foco u ocultación. */
  huboDialogo(): boolean;
  /** Quita los oyentes (siempre, por cada camino de salida). La marca se conserva. */
  desinstalar(): void;
}

/**
 * Crea el vigilante ya instalado: escucha `blur` de la ventana y `visibilitychange` del
 * documento. Marca al primero de los dos y no se desmarca nunca (D14).
 */
export function crearHoja(ventana: VentanaHoja, documento: DocumentoHoja): Hoja {
  let vista = false;
  let instalado = false;

  const alPerderFoco = (): void => {
    vista = true;
  };

  const alCambiarVisibilidad = (): void => {
    if (documento.visibilityState !== 'visible') vista = true;
  };

  const instalar = (): void => {
    if (instalado) return;
    ventana.addEventListener('blur', alPerderFoco);
    documento.addEventListener('visibilitychange', alCambiarVisibilidad);
    instalado = true;
  };

  const desinstalar = (): void => {
    if (!instalado) return;
    ventana.removeEventListener('blur', alPerderFoco);
    documento.removeEventListener('visibilitychange', alCambiarVisibilidad);
    instalado = false;
  };

  instalar();

  return {
    reiniciar: () => {
      vista = false;
      instalar();
    },
    huboDialogo: () => vista,
    desinstalar,
  };
}
