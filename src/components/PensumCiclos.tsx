// Pensum en acordeones por ciclo (I…X) (RF-4).
// Cada materia es una tarjeta que abre el NotaModal (RF-5/RF-8).

import { useState } from 'react';
import type { Asignatura, Plan, RegistroNota } from '../domain/tipos.ts';
import { MateriaCard } from './MateriaCard.tsx';
import { NotaModal } from './NotaModal.tsx';

const NUMEROS_ROMANO: Record<number, string> = {
  1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
  6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X',
};

export interface PensumCiclosProps {
  plan: Plan;
  registros: RegistroNota[];
  onGuardarNota: (asignaturaId: string, nota: number) => void;
  onEliminarNota: (asignaturaId: string) => void;
}

export function PensumCiclos({ plan, registros, onGuardarNota, onEliminarNota }: PensumCiclosProps) {
  const [abierto, setAbierto] = useState<number | null>(plan.ciclos[0]?.numero ?? null);
  const [editando, setEditando] = useState<Asignatura | null>(null);

  // Índice de notas por asignatura (repitencia: el store ya garantiza última nota única).
  const notas = new Map(registros.map((r) => [r.asignaturaId, r.nota]));

  const guardar = (asignaturaId: string, nota: number) => {
    onGuardarNota(asignaturaId, nota);
    setEditando(null);
  };

  const eliminar = (asignaturaId: string) => {
    onEliminarNota(asignaturaId);
    setEditando(null);
  };

  return (
    <section aria-label="Pensum de la carrera" className="pensum">
      <header className="pensum__cabecera">
        <h2>{plan.carrera}</h2>
        <p>
          {plan.planVersion} · {plan.modalidad} · {plan.uvTotal} UV · {plan.materiasTotal} materias
        </p>
      </header>

      {plan.ciclos.map((ciclo) => {
        const estaAbierto = abierto === ciclo.numero;
        const idPanel = `ciclo-${ciclo.numero}`;
        return (
          <article key={ciclo.numero} className="ciclo">
            <h3>
              <button
                type="button"
                className="ciclo__cabecera"
                aria-expanded={estaAbierto}
                aria-controls={idPanel}
                onClick={() => setAbierto(estaAbierto ? null : ciclo.numero)}
              >
                Ciclo {NUMEROS_ROMANO[ciclo.numero] ?? ciclo.numero}
                <span className="ciclo__conteo">{ciclo.asignaturas.length} materias</span>
              </button>
            </h3>
            {estaAbierto && (
              <div id={idPanel} className="ciclo__panel">
                <ul className="ciclo__lista">
                  {ciclo.asignaturas.map((asignatura) => (
                    <li key={asignatura.id}>
                      <MateriaCard
                        asignatura={asignatura}
                        nota={notas.get(asignatura.id)}
                        onClic={setEditando}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        );
      })}

      {editando && (
        <NotaModal
          asignatura={editando}
          notaActual={notas.get(editando.id)}
          onGuardar={(nota) => guardar(editando.id, nota)}
          onEliminar={() => eliminar(editando.id)}
          onCerrar={() => setEditando(null)}
        />
      )}
    </section>
  );
}
