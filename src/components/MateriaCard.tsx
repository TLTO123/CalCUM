// Tarjeta de materia dentro del pensum (RF-4, RF-7, RF-14).
// Estados: pendiente (sin nota) | cursada (con nota + indicador aprobada/reprobada).

import type { Asignatura } from '../domain/tipos.ts';
import { NOTA_MINIMA_APROBACION } from '../domain/tipos.ts';

export interface MateriaCardProps {
  asignatura: Asignatura;
  nota: number | undefined;
  onClic: (asignatura: Asignatura) => void;
}

export function MateriaCard({ asignatura, nota, onClic }: MateriaCardProps) {
  const cursada = nota !== undefined;
  const aprobada = cursada && nota >= NOTA_MINIMA_APROBACION;

  const estado = !cursada ? 'pendiente' : aprobada ? 'aprobada' : 'reprobada';

  return (
    <button
      type="button"
      className={`materia materia--${estado}`}
      onClick={() => onClic(asignatura)}
      aria-label={
        cursada
          ? `${asignatura.nombre}, nota ${nota}, ${aprobada ? 'aprobada' : 'reprobada'}. Editar.`
          : `${asignatura.nombre}, pendiente. Asignar nota.`
      }
    >
      <span className="materia__codigo">{asignatura.codigo}</span>
      <span className="materia__nombre">
        {asignatura.nombre}
        {asignatura.laboratorio && <span title="Prácticas de laboratorio"> •</span>}
      </span>
      <span className="materia__uv">{asignatura.uv} UV</span>
      <span className="materia__prerrequisito">
        {asignatura.prerrequisito ? `Prerrequisito: ${asignatura.prerrequisito}` : ''}
      </span>
      {cursada && <span className="materia__nota">{nota}</span>}
    </button>
  );
}
