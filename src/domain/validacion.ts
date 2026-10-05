// Validación de notas (RF-6): escala 1–10 con cualquier decimal dentro del rango (decisión D5).
// P5: función pura, sin imports de UI ni de almacenamiento.

import { NOTA_MAX, NOTA_MIN } from './tipos.ts';

export type ResultadoValidacion =
  | { ok: true; valor: number }
  | { ok: false; error: string };

/**
 * Valida una nota capturada como texto.
 * Acepta decimales (7.5, 8.25); rechaza vacío, no numéricos y todo fuera de [1, 10].
 */
export function validarNota(entrada: string): ResultadoValidacion {
  const texto = entrada.trim();
  if (texto === '') {
    return { ok: false, error: 'Ingresa una nota' };
  }
  const valor = Number(texto);
  if (!Number.isFinite(valor)) {
    return { ok: false, error: 'La nota debe ser un número' };
  }
  if (valor < NOTA_MIN || valor > NOTA_MAX) {
    return { ok: false, error: `La nota debe estar entre ${NOTA_MIN} y ${NOTA_MAX}` };
  }
  return { ok: true, valor };
}
