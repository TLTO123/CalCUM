import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerRegistros, escribirRegistros, listarClavesDeCarrera, ALMACEN_DEFECTO } from '../src/state/persistencia.ts';
import { crearStore } from '../src/state/store.ts';

/** Storage falso compatible con la interfaz mínima usada por persistencia. */
function almacenFalso(): {
  mapa: Map<string, string>;
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
} {
  const mapa = new Map<string, string>();
  return {
    mapa,
    getItem: (k) => mapa.get(k) ?? null,
    setItem: (k, v) => void mapa.set(k, v),
    removeItem: (k) => void mapa.delete(k),
  };
}

const CLAVE_A = 'ingenieria|soyapango|plan-2024';
const CLAVE_B = 'ingenieria|virtual|plan-2024';

test('RF-11: roundtrip por clave — escribir y leer devuelve los mismos registros', () => {
  const almacen = almacenFalso();
  const registros = [
    { asignaturaId: 'a1', nota: 8 },
    { asignaturaId: 'a2', nota: 7.5 },
  ];
  escribirRegistros(almacen, CLAVE_A, registros);
  assert.deepEqual(leerRegistros(almacen, CLAVE_A), registros);
});

test('RF-11: dos carreras NO se mezclan (clave separada)', () => {
  const almacen = almacenFalso();
  escribirRegistros(almacen, CLAVE_A, [{ asignaturaId: 'a1', nota: 9 }]);
  escribirRegistros(almacen, CLAVE_B, [{ asignaturaId: 'a1', nota: 4 }]);
  assert.equal(leerRegistros(almacen, CLAVE_A)[0]!.nota, 9);
  assert.equal(leerRegistros(almacen, CLAVE_B)[0]!.nota, 4);
});

test('P6/RF-16: almacenado solo {asignaturaId, nota} — nada más', () => {
  const almacen = almacenFalso();
  // Intenta colar un campo extra; no debe persistirse.
  escribirRegistros(almacen, CLAVE_A, [{ asignaturaId: 'a1', nota: 8, extra: 'no' } as never]);
  const datos = JSON.parse(almacen.getItem(ALMACEN_DEFECTO)!);
  const porCarrera = datos[CLAVE_A] as Record<string, unknown>;
  // Forma mínima: { id -> nota } (solo el número, sin campos colgantes).
  assert.deepEqual(Object.keys(porCarrera), ['a1']);
  assert.equal(typeof porCarrera['a1'], 'number');
  assert.equal(porCarrera['a1'], 8);
  assert.ok(!JSON.stringify(datos).includes('extra'));
});

test('lectura de storage vacío o corrupto => [] (nunca excepción que rompa el arranque)', () => {
  const vacio = almacenFalso();
  assert.deepEqual(leerRegistros(vacio, CLAVE_A), []);
  const corrupto = almacenFalso();
  corrupto.setItem(ALMACEN_DEFECTO, '{no-es-json');
  assert.deepEqual(leerRegistros(corrupto, CLAVE_A), []);
});

test('listarClavesDeCarrera devuelve las claves con datos guardados', () => {
  const almacen = almacenFalso();
  assert.deepEqual(listarClavesDeCarrera(almacen), []);
  escribirRegistros(almacen, CLAVE_A, [{ asignaturaId: 'a1', nota: 5 }]);
  escribirRegistros(almacen, CLAVE_B, [{ asignaturaId: 'a2', nota: 6 }]);
  assert.deepEqual(listarClavesDeCarrera(almacen).sort(), [CLAVE_A, CLAVE_B].sort());
});

test('RF-11: setearNota persiste y la última nota gana (repitencia)', () => {
  const almacen = almacenFalso();
  const store = crearStore(almacen);
  store.getState().setearNota(CLAVE_A, 'a1', 4);
  store.getState().setearNota(CLAVE_A, 'a1', 9);
  const registros = store.getState().registrosDe(CLAVE_A);
  assert.equal(registros.length, 1); // una sola entrada
  assert.equal(registros[0]!.nota, 9); // última nota
  // y sobrevive a la rehidratación desde storage
  const recargado = crearStore(almacen);
  assert.equal(recargado.getState().registrosDe(CLAVE_A)[0]!.nota, 9);
});

test('eliminarNota quita el registro y refleja el cambio en storage', () => {
  const almacen = almacenFalso();
  const store = crearStore(almacen);
  store.getState().setearNota(CLAVE_A, 'a1', 8);
  store.getState().eliminarNota(CLAVE_A, 'a1');
  assert.deepEqual(store.getState().registrosDe(CLAVE_A), []);
  assert.deepEqual(leerRegistros(almacen, CLAVE_A), []);
});

test('RF-12 (estructura): cambiar de carrera restaura sus registros sin perder los demás', () => {
  const almacen = almacenFalso();
  const store = crearStore(almacen);
  store.getState().setearNota(CLAVE_A, 'a1', 10);
  store.getState().seleccionarCarrera(CLAVE_B);
  store.getState().setearNota(CLAVE_B, 'a2', 5);
  store.getState().seleccionarCarrera(CLAVE_A);
  assert.equal(store.getState().registrosDe(CLAVE_A)[0]!.nota, 10);
  assert.equal(store.getState().registrosDe(CLAVE_B)[0]!.nota, 5);
  assert.equal(store.getState().claveActiva, CLAVE_A);
});

test('sin carrera seleccionada: registrosDe devuelve [] y claveActiva es null', () => {
  const store = crearStore(almacenFalso());
  assert.equal(store.getState().claveActiva, null);
  assert.deepEqual(store.getState().registrosDe('ingenieria|soyapango|plan-2024'), []);
});
