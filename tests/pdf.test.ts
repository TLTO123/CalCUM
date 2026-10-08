// T1 (andamiaje): el pipeline puede abrir un PDF real y devolver ítems con coordenadas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { itemsDeDocumento } from '../pipeline/pdf.ts';

const PDF_PRESENCIAL = new URL(
  './fixtures/pensums/presencial-ciencias-computacion-plan-2024.pdf',
  import.meta.url,
);
const PDF_VIRTUAL = new URL('./fixtures/pensums/virtual-ciencias-computacion.pdf', import.meta.url);

test('T1: extrae los ítems de texto del pensum presencial con coordenadas x/y', async () => {
  const bytes = new Uint8Array(await readFile(PDF_PRESENCIAL));
  const items = await itemsDeDocumento(bytes);

  assert.ok(items.length >= 100, `se esperaban ≥100 ítems y llegaron ${items.length}`);
  const conCoordenadas = items.filter((i) => i.x > 0 && i.y > 0);
  assert.ok(conCoordenadas.length > 0, 'ningún ítem tiene coordenadas positivas');

  const texto = items.map((i) => i.str).join(' ');
  assert.match(texto, /CICLO/i, 'no se detectó ningún rótulo de ciclo');
});

test('T1: también abre el pensum de UDB Virtual (plantilla distinta)', async () => {
  const bytes = new Uint8Array(await readFile(PDF_VIRTUAL));
  const items = await itemsDeDocumento(bytes);

  assert.ok(items.length >= 50, `se esperaban ≥50 ítems y llegaron ${items.length}`);
  assert.ok(
    items.some((i) => i.x > 0 && i.y > 0),
    'ningún ítem tiene coordenadas positivas',
  );
});
