import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearHoja } from '../src/export/hoja.ts';
import type { DocumentoHoja, VentanaHoja } from '../src/export/hoja.ts';

/** Espía de eventos mínimo: lo mismo que `window` o `document`, pero en Node. */
class EspiaEventos {
  private oyentes = new Map<string, Set<() => void>>();

  addEventListener(tipo: string, oyente: () => void): void {
    const grupo = this.oyentes.get(tipo) ?? new Set<() => void>();
    grupo.add(oyente);
    this.oyentes.set(tipo, grupo);
  }

  removeEventListener(tipo: string, oyente: () => void): void {
    this.oyentes.get(tipo)?.delete(oyente);
  }

  disparar(tipo: string): void {
    for (const oyente of [...(this.oyentes.get(tipo) ?? [])]) oyente();
  }

  oyentesDe(tipo: string): number {
    return this.oyentes.get(tipo)?.size ?? 0;
  }

  oyentesTotales(): number {
    let total = 0;
    for (const grupo of this.oyentes.values()) total += grupo.size;
    return total;
  }
}

class FalsoDocumento extends EspiaEventos {
  visibilityState: 'visible' | 'hidden' = 'visible';

  ocultar(): void {
    this.visibilityState = 'hidden';
    this.disparar('visibilitychange');
  }

  mostrar(): void {
    this.visibilityState = 'visible';
    this.disparar('visibilitychange');
  }
}

test('RF-11: sin ningún evento la hoja nunca se vio', () => {
  const hoja = crearHoja(new EspiaEventos(), new FalsoDocumento());
  assert.equal(hoja.huboDialogo(), false);
});

test('RF-11/D14: perder el foco de la ventana ⇒ hubo un diálogo', () => {
  const ventana = new EspiaEventos();
  const hoja = crearHoja(ventana, new FalsoDocumento());

  ventana.disparar('blur');

  assert.equal(hoja.huboDialogo(), true);
});

test('RF-11/D14: `visibilitychange` hacia `hidden` ⇒ hubo un diálogo', () => {
  const documento = new FalsoDocumento();
  const hoja = crearHoja(new EspiaEventos(), documento);

  documento.ocultar();

  assert.equal(hoja.huboDialogo(), true);
});

test('RF-11: al volver a `visible` la marca NO se reinicia', () => {
  const documento = new FalsoDocumento();
  const hoja = crearHoja(new EspiaEventos(), documento);

  documento.ocultar();
  documento.mostrar();

  assert.equal(hoja.huboDialogo(), true, 'una vez vista la hoja, ya no se olvida');
});

test('RF-11/D16: `desinstalar()` deja a la ventana y al documento sin oyentes', () => {
  const ventana = new EspiaEventos();
  const documento = new FalsoDocumento();
  const hoja = crearHoja(ventana, documento);

  assert.equal(ventana.oyentesDe('blur'), 1, 'el oyente de foco estaba puesto');
  assert.equal(documento.oyentesDe('visibilitychange'), 1);

  hoja.desinstalar();

  assert.equal(ventana.oyentesTotales(), 0, 'la ventana se queda sin oyentes');
  assert.equal(documento.oyentesTotales(), 0, 'el documento se queda sin oyentes');

  documento.ocultar();
  assert.equal(hoja.huboDialogo(), false, 'sin oyentes ya no se registra nada');
});

test('RF-11: `reiniciar()` limpia la marca y vuelve a instalar los oyentes', () => {
  const ventana = new EspiaEventos();
  const documento = new FalsoDocumento();
  const hoja = crearHoja(ventana, documento);

  documento.ocultar();
  assert.equal(hoja.huboDialogo(), true);

  hoja.desinstalar();
  hoja.reiniciar();

  assert.equal(hoja.huboDialogo(), false, 'cada intento empieza de cero');
  assert.equal(ventana.oyentesDe('blur'), 1, 'vuelve a escuchar');
  assert.equal(documento.oyentesDe('visibilitychange'), 1);

  ventana.disparar('blur');
  assert.equal(hoja.huboDialogo(), true);
});

test('un `window` y un `document` reales cumplen las interfaces (comprobación de tipos)', () => {
  // Si alguno dejara de encajar, esto no compila.
  const comoVentana = (w: Window): VentanaHoja => w;
  const comoDocumento = (d: Document): DocumentoHoja => d;
  assert.equal(typeof comoVentana, 'function');
  assert.equal(typeof comoDocumento, 'function');
});
