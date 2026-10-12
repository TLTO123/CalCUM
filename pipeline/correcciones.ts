// T3 (spec 004, RF-3, RF-6, RF-9) — correcciones curadas de nombres.
//
// Motivo: el lector no siempre puede recuperar un nombre (46 casos en el anexo A; tras el
// saneado automático siguen 19 dañados). Para esos, el nombre se fija aquí, **versionado en el
// repositorio** y citando el documento del que salió: es el único punto del proyecto donde un
// nombre se escribe a mano (RNF-3 — `data/planes.json` jamás se edita).
//
//   * **Clave**: el `id` estable de la asignatura (decisión D2), no el código. Hay códigos
//     repetidos entre planes (`DCG919` en la Licenciatura y en el Técnico) y electivas que
//     comparten el `-` dentro de un mismo ciclo: solo el id distingue unas de otras.
//   * **Alcance**: solo cambia `nombre` (RF-8) y el nombre pasa por `saneadoNombre` (RF-1).
//   * **Pureza**: el plan de entrada no se muta; se devuelve otro (RF-9, reproducibilidad).
//   * **Lo que no aplica vuelve en `huerfanas`** y `generar` lo convierte en error: una
//     corrección de un pensum que ya no existe no se ignora en silencio (caso límite 8).
//
// Función pura: sin reloj, red ni filesystem. El registro JSON se lee en `generar.main` y entra
// inyectado, igual que las fuentes.

import { saneadoNombre } from './parsear.ts';
import type { Plan } from '../src/domain/tipos.ts';

/** Una corrección curada: el nombre verificado contra el documento de origen. */
export interface CorreccionNombre {
  /** Id estable de la asignatura (spec 002, RF-11): sede:tipo:plan:slug:carrera:ciclo:código. */
  id: string;
  /** Nombre verificado contra el documento de origen. */
  nombre: string;
  /** Documento del que se tomó, con el mismo nombre de archivo que en el manifiesto. */
  fuente: string;
  /** Qué decía la extracción, cómo se comprobó y quién lo aprobó. */
  motivo: string;
}

/** Corrección que no se pudo aplicar, con el porqué: se señala, nunca se descarta en silencio. */
export interface CorreccionHuerfana {
  correccion: CorreccionNombre;
  /**
   * - `id-inexistente`: el plan ya no tiene esa asignatura (el pensum cambió) ⇒ caso límite 8;
   * - `nombre-invalido`: el nombre de la corrección queda vacío tras saneado ⇒ nunca se publica;
   * - `id-duplicado`: dos entradas apuntan al mismo id y no dicen cuál manda ⇒ no se aplica ninguna.
   */
  razon: 'id-inexistente' | 'nombre-invalido' | 'id-duplicado';
}

export interface ResultadoCorrecciones {
  /** Plan con los nombres sustituidos. Objeto nuevo: el de entrada queda intacto. */
  plan: Plan;
  /** Aplicadas, con el nombre ya saneado: van al manifiesto y al reporte (RF-6). */
  aplicadas: CorreccionNombre[];
  /** Las que no se aplicaron: `generar` las convierte en error y detiene la publicación (RF-4). */
  huerfanas: CorreccionHuerfana[];
}

/**
 * Sustituye el `nombre` de las asignaturas que tengan corrección en `registro` (RF-3).
 *
 * Un registro vacío devuelve el plan **tal cual**, sin ni siquiera recopiarlo: dos corridas con
 * la misma entrada producen el mismo byte (RF-9).
 */
export function aplicarCorrecciones(
  plan: Plan,
  registro: readonly CorreccionNombre[],
): ResultadoCorrecciones {
  if (registro.length === 0) return { plan, aplicadas: [], huerfanas: [] };

  // Ambigüedad: dos entradas para el mismo id ⇒ ninguna de las dos se aplica.
  const primera = new Map<string, CorreccionNombre>();
  const duplicados = new Set<string>();
  for (const correccion of registro) {
    if (primera.has(correccion.id)) duplicados.add(correccion.id);
    else primera.set(correccion.id, correccion);
  }
  const porId = new Map(
    [...primera].filter(([id]) => !duplicados.has(id)),
  );

  const huerfanas: CorreccionHuerfana[] = [...duplicados].map((id) => ({
    correccion: primera.get(id)!,
    razon: 'id-duplicado' as const,
  }));
  const aplicadas: CorreccionNombre[] = [];
  const encontrados = new Set<string>();

  const ciclos = plan.ciclos.map((ciclo) => ({
    ...ciclo,
    asignaturas: ciclo.asignaturas.map((asignatura) => {
      const correccion = porId.get(asignatura.id);
      if (!correccion) return asignatura;
      encontrados.add(asignatura.id);
      const nombre = saneadoNombre(correccion.nombre);
      if (nombre.length === 0) {
        huerfanas.push({ correccion, razon: 'nombre-invalido' });
        return asignatura;
      }
      aplicadas.push({ ...correccion, nombre });
      return { ...asignatura, nombre };
    }),
  }));

  for (const correccion of porId.values()) {
    if (!encontrados.has(correccion.id)) {
      huerfanas.push({ correccion, razon: 'id-inexistente' });
    }
  }

  return { plan: { ...plan, ciclos }, aplicadas, huerfanas };
}
