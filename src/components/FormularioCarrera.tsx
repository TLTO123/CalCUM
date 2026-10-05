// Formulario de selección en cascada Tipo → Sede → Carrera (RF-1, RF-2, RF-3).
// Selects nativos (D4: accesibles de fábrica, RNF-2) filtrados con las funciones puras de `domain/cascada`.

import { useMemo, useState } from 'react';
import type { Plan, Sede, TipoCarrera } from '../domain/tipos.ts';
import { carrerasPara, sedesParaTipo, tiposDisponibles } from '../domain/cascada.ts';

const ETIQUETAS_SEDE: Record<Sede, string> = {
  soyapango: 'Campus Soyapango',
  'antiguo-cuscatlan': 'Campus Antiguo Cuscatlán',
  virtual: 'UDB Virtual',
};

const ETIQUETAS_TIPO: Record<TipoCarrera, string> = {
  ingenieria: 'Ingenierías',
  licenciatura: 'Licenciaturas',
  tecnico: 'Técnicos',
  profesorado: 'Profesorados',
};

export interface FormularioCarreraProps {
  planes: Plan[];
  onSeleccionar: (plan: Plan) => void;
  /**
   * Gancho de verificación (T8): permite montar con una selección ya puesta para
   * probar estados que con datos consistentes serían inalcanzables (p. ej. RF-3,
   * combinación sin carreras, que ocurre si `planes` cambia tras la selección).
   */
  estadoInicial?: { tipo: TipoCarrera | ''; sede: Sede | '' };
}

export function FormularioCarrera({ planes, onSeleccionar, estadoInicial }: FormularioCarreraProps) {
  const [tipo, setTipo] = useState<TipoCarrera | ''>(estadoInicial?.tipo ?? '');
  const [sede, setSede] = useState<Sede | ''>(estadoInicial?.sede ?? '');

  const tipos = useMemo(() => tiposDisponibles(planes), [planes]);

  // RF-1: solo sedes con oferta del tipo elegido.
  const sedes = useMemo(() => (tipo ? sedesParaTipo(planes, tipo) : []), [planes, tipo]);

  // RF-2: carreras de la combinación (tipo, sede); RF-3: lista vacía ⇒ estado "sin resultados".
  const carreras = useMemo(
    () => (tipo && sede ? carrerasPara(planes, tipo, sede) : []),
    [planes, tipo, sede],
  );

  const cambiarTipo = (nuevo: TipoCarrera | '') => {
    setTipo(nuevo);
    // Si la sede elegida ya no tiene oferta para el nuevo tipo, se limpia (nunca camino muerto).
    if (nuevo && sede && !sedesParaTipo(planes, nuevo).includes(sede as Sede)) {
      setSede('');
    }
  };

  return (
    <section aria-label="Selecciona tu carrera">
      <div className="formulario-carrera">
        <label className="campo">
          <span>Tipo de carrera</span>
          <select
            id="select-tipo"
            name="tipo"
            value={tipo}
            onChange={(e) => cambiarTipo(e.target.value as TipoCarrera | '')}
            aria-required="true"
          >
            <option value="">Selecciona un tipo…</option>
            {tipos.map((t) => (
              <option key={t} value={t}>
                {ETIQUETAS_TIPO[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="campo">
          <span>Sede / Modalidad</span>
          <select
            id="select-sede"
            name="sede"
            value={sede}
            onChange={(e) => setSede(e.target.value as Sede | '')}
            disabled={!tipo}
            aria-required="true"
          >
            <option value="">{tipo ? 'Selecciona una sede…' : 'Elige primero un tipo'}</option>
            {sedes.map((s) => (
              <option key={s} value={s}>
                {ETIQUETAS_SEDE[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {tipo && sede && carreras.length === 0 && (
        <p className="estado-vacio" role="status">
          No hay carreras disponibles con esa combinación. Prueba con otra sede o tipo.
        </p>
      )}

      {carreras.length > 0 && (
        <ul className="listado-carreras" aria-label="Carreras disponibles">
          {carreras.map((plan) => (
            <li key={`${plan.tipo}|${plan.sede}|${plan.planVersion}|${plan.carrera}`}>
              <button type="button" className="tarjeta-carrera" onClick={() => onSeleccionar(plan)}>
                <span className="tarjeta-carrera__nombre">{plan.carrera}</span>
                <span className="tarjeta-carrera__meta">
                  {plan.uvTotal} UV · {plan.materiasTotal} materias · {plan.modalidad}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
