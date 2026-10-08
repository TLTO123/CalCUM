// Panel de resultado: C.U.M en vivo + desglose + progreso (RF-9, RF-10, RF-14).
// Recalcula con cada cambio de registros (RNF-1: memoización barata, ~50 materias).
// Exportar/compartir el resultado como PNG (spec 003: RF-1, RF-4, RF-5, RF-10).
//
// Aquí viven los bordes de la interfaz —`new Date()`, `document.createElement`,
// `toBlob` y el `<a download>`—; todo lo demás es lógica pura de `domain/` y de
// `export/`, que entra por parámetro (P5).

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Plan, RegistroNota } from '../domain/tipos.ts';
import { calcularCum } from '../domain/cum.ts';
import { nombreDeArchivo, prepararTarjeta } from '../domain/exportar.ts';
import type { Fecha, Tarjeta } from '../domain/exportar.ts';
import { dibujarTarjeta } from '../export/dibujar.ts';
import { entregarImagen } from '../export/entregar.ts';
import type { ResultadoEntrega } from '../export/entregar.ts';
import { TEMA_CLARO } from '../export/tema.ts';

export interface CumPanelProps {
  plan: Plan;
  registros: RegistroNota[];
}

/** Estados del flujo de exportación (plan §5). */
type EstadoExportacion = 'inactivo' | 'generando' | 'listo' | 'error';

const MENSAJES: Record<ResultadoEntrega, string> = {
  compartido: 'Imagen compartida.',
  guardado: 'Imagen guardada en tus descargas.',
  cancelado: 'Compartir cancelado; tu resultado sigue en pantalla.',
  error: 'No se pudo generar la imagen. Inténtalo de nuevo.',
};

/** Único punto con reloj del flujo (P5: la lógica recibe la fecha, no la pide). */
function hoyDe(): Fecha {
  const ahora = new Date();
  return { dia: ahora.getDate(), mes: ahora.getMonth() + 1, anio: ahora.getFullYear() };
}

/**
 * Lienzo en memoria a escala 2× → PNG. Devuelve `null` si el navegador no da
 * contexto 2D o si `toBlob` no produce blob (RF-7: nunca una imagen a medias).
 */
async function generarPng(tarjeta: Tarjeta): Promise<Blob | null> {
  const lienzo = document.createElement('canvas');
  lienzo.width = TEMA_CLARO.ancho * TEMA_CLARO.escala;
  lienzo.height = TEMA_CLARO.alto * TEMA_CLARO.escala;

  const ctx = lienzo.getContext('2d');
  if (!ctx) return null;
  dibujarTarjeta(ctx, tarjeta, TEMA_CLARO);

  return await new Promise<Blob | null>((resolver) => {
    lienzo.toBlob((blob) => resolver(blob), 'image/png');
  });
}

/** Fallback de RF-3: descarga local sin pasar por ningún servidor. */
function descargarLocal(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  // Se revoca tras un ciclo: Firefox aborta la descarga si se revoca en el acto.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CumPanel({ plan, registros }: CumPanelProps) {
  // Memo por registros: solo se recalcula cuando cambian las notas (RNF-1).
  const resultado = useMemo(() => calcularCum(plan, registros), [plan, registros]);

  const progreso = Math.min(100, Math.round((resultado.contadas / plan.materiasTotal) * 100));

  const [estado, setEstado] = useState<EstadoExportacion>('inactivo');
  const [mensaje, setMensaje] = useState('');
  const botonRef = useRef<HTMLButtonElement>(null);

  // RF-8/RNF-4: deshabilitar el botón durante `generando` le quita el foco al
  // navegador; se devuelve al terminar para no dejar a quien navega con teclado
  // en `body` (habría que recorrer la página entera otra vez).
  useEffect(() => {
    if (estado === 'listo' || estado === 'error') botonRef.current?.focus();
  }, [estado]);

  // RF-4: sin nada cursado no se exporta y el motivo queda junto a la acción.
  const sinNotas = resultado.contadas === 0;
  const generando = estado === 'generando';

  async function alCompartir(): Promise<void> {
    if (sinNotas || generando) return; // RF-5: solo bajo acción explícita del usuario

    setEstado('generando');
    setMensaje('Generando imagen…');
    try {
      const tarjeta = prepararTarjeta(plan, resultado, hoyDe());
      const png = await generarPng(tarjeta);
      if (!png) throw new Error('sin contexto 2D o blob nulo');

      const resultadoEntrega = await entregarImagen(png, nombreDeArchivo(tarjeta), {
        navigator,
        descargar: descargarLocal,
      });

      setEstado(resultadoEntrega === 'error' ? 'error' : 'listo');
      setMensaje(MENSAJES[resultadoEntrega]);
    } catch {
      // RF-7: mensaje recuperable, el resultado de la pantalla sigue intacto.
      setEstado('error');
      setMensaje('No se pudo generar la imagen. Inténtalo de nuevo.');
    }
  }

  return (
    <section aria-label="Resultado del C.U.M" className="panel-cum">
      <p className="panel-cum__etiqueta">Tu C.U.M</p>

      {/* RF-10: indicador vacío en lugar de división entre cero. */}
      <p className="panel-cum__valor" aria-live="polite">
        {resultado.cum === null ? '—' : resultado.cum.toFixed(2)}
      </p>

      <p className="panel-cum__desglose">
        {resultado.cum === null
          ? 'Aún no has registrado ninguna materia.'
          : `${resultado.sumaUM} UM / ${resultado.sumaUV} UV`}
      </p>

      <div
        className="panel-cum__progreso"
        role="progressbar"
        aria-valuenow={resultado.contadas}
        aria-valuemin={0}
        aria-valuemax={plan.materiasTotal}
        aria-label="Materias cursadas"
      >
        <div className="panel-cum__barra" style={{ width: `${progreso}%` }} />
      </div>
      <p className="panel-cum__conteo">
        {resultado.contadas} / {plan.materiasTotal} materias cursadas
        {resultado.contadas > 0 && (
          <>
            {' · '}
            <span className="panel-cum__aprobadas">{resultado.aprobadas} aprobadas</span>
            {' · '}
            <span className="panel-cum__reprobadas">{resultado.reprobadas} reprobadas</span>
          </>
        )}
      </p>

      {/* RF-1/RF-10: única acción de exportar y compartir. */}
      <div className="panel-cum__acciones">
        <button
          ref={botonRef}
          type="button"
          className="panel-cum__exportar"
          onClick={alCompartir}
          disabled={sinNotas || generando}
          aria-describedby={sinNotas ? 'panel-cum__motivo' : undefined}
        >
          {generando ? 'Generando imagen…' : 'Compartir resultado'}
        </button>

        {/* RF-4: el motivo queda junto a la acción deshabilitada (D9). */}
        {sinNotas && (
          <p className="panel-cum__aviso" id="panel-cum__motivo">
            Registra al menos una materia para compartir tu resultado.
          </p>
        )}

        {/* RF-8: el resultado del flujo se anuncia sin bloquear la interfaz.
            `key` fuerza un nodo nuevo al cambiar de estado: al cambiar solo el
            `role`, muchos lectores no vuelven a anunciar. */}
        {!sinNotas && mensaje && (
          <p
            key={estado}
            className={
              estado === 'error'
                ? 'panel-cum__aviso panel-cum__aviso--error'
                : 'panel-cum__aviso'
            }
            role={estado === 'error' ? 'alert' : 'status'}
            aria-live={estado === 'error' ? undefined : 'polite'}
          >
            {mensaje}
          </p>
        )}
      </div>
    </section>
  );
}
