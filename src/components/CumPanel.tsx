// Panel de resultado: C.U.M en vivo + desglose + progreso (RF-9, RF-10, RF-14).
// Recalcula con cada cambio de registros (RNF-1: memoización barata, ~50 materias).

import { useMemo } from 'react';
import type { Plan, RegistroNota } from '../domain/tipos.ts';
import { calcularCum } from '../domain/cum.ts';

export interface CumPanelProps {
  plan: Plan;
  registros: RegistroNota[];
}

export function CumPanel({ plan, registros }: CumPanelProps) {
  // Memo por registros: solo se recalcula cuando cambian las notas (RNF-1).
  const resultado = useMemo(() => calcularCum(plan, registros), [plan, registros]);

  const progreso = Math.min(100, Math.round((resultado.contadas / plan.materiasTotal) * 100));

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
    </section>
  );
}
