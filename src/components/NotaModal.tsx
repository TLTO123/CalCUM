// Modal para ingresar, editar o eliminar la nota de una materia (RF-5, RF-6, RF-8).
// Un solo componente con modo: 'ingresar' (pendiente) o 'editar' (ya cursada).

import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { Asignatura } from '../domain/tipos.ts';
import { validarNota } from '../domain/validacion.ts';

export interface NotaModalProps {
  asignatura: Asignatura;
  /** Nota actual si la materia ya está cursada (modo editar); undefined si es pendiente. */
  notaActual: number | undefined;
  onGuardar: (nota: number) => void;
  onEliminar: () => void;
  onCerrar: () => void;
}

export function NotaModal({ asignatura, notaActual, onGuardar, onEliminar, onCerrar }: NotaModalProps) {
  const modo = notaActual !== undefined ? 'editar' : 'ingresar';
  const [texto, setTexto] = useState(notaActual !== undefined ? String(notaActual) : '');
  const [tocado, setTocado] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const idError = useId();

  const validacion = validarNota(texto);
  const mostrarError = tocado && !validacion.ok;

  // RF-5: foco inicial en el input (teclado, RNF-2).
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Esc cierra (decisión de UX de la spec).
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [onCerrar]);

  // Se usa onSubmit del <form> para que Enter en el input guarde (RNF-2: teclado completo).
  const guardar = (e?: React.FormEvent) => {
    e?.preventDefault();
    setTocado(true);
    if (validacion.ok) {
      onGuardar(validacion.valor);
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={`${idError}-titulo`}>
        {/* form: Enter en el input dispara Guardar (RNF-2). */}
        <form onSubmit={guardar} noValidate>
        <h2 id={`${idError}-titulo`} className="modal__titulo">
          {asignatura.nombre}
        </h2>
        <p className="modal__meta">
          {asignatura.codigo} · {asignatura.uv} UV
          {asignatura.prerrequisito ? ` · Prerrequisito: ${asignatura.prerrequisito}` : ''}
        </p>

        <label className="campo" htmlFor={`${idError}-nota`}>
          <span>Nota ({modo === 'editar' ? 'editando' : '1 a 10, acepta decimales'})</span>
          <input
            id={`${idError}-nota`}
            ref={inputRef}
            type="number"
            inputMode="decimal"
            min={1}
            max={10}
            step="any"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onBlur={() => setTocado(true)}
            aria-required="true"
            aria-invalid={mostrarError}
            aria-describedby={mostrarError ? idError : undefined}
          />
        </label>

        {mostrarError && (
          <p className="modal__error" id={idError} role="alert">
            {!validacion.ok && validacion.error}
          </p>
        )}

        <div className="modal__acciones">
          <button type="button" onClick={onCerrar}>
            Cancelar
          </button>
          {modo === 'editar' && (
            <button type="button" className="modal__eliminar" onClick={onEliminar}>
              Eliminar nota
            </button>
          )}
          <button type="submit" className="modal__guardar">
            Guardar
          </button>
        </div>
        </form>
      </div>
    </div>
  );
}
