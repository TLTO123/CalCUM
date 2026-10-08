// T9 (RF-1, RF-4, RF-5, RF-14, RF-15, RNF-2) — `data/planes.json`, el dataset completo.
//
// Es la prueba de que la app ya no arranca con planes de muestra: el archivo tiene que existir,
// cumplir el contrato de datos de la spec 001 **sin cambiarlo** (RNF-2) y traer las 59
// carreras con claves únicas. Si `npm run datos` no corrió o publicó menos planes, esto falla
// ruidosamente en CI y no en el navegador (P2).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import datos from '../data/planes.json' with { type: 'json' };
import { esquemaPlan } from '../src/data/esquema.ts';
import { claveDePlan, indicePorClave, planesIniciales } from '../src/data/repositorio.ts';
import { carrerasPara, sedesParaTipo, tiposDisponibles } from '../src/domain/cascada.ts';
import type { Plan, Sede, TipoCarrera } from '../src/domain/tipos.ts';

const planes: Plan[] = planesIniciales();

test('T9/RF-1: data/planes.json existe, cumple esquemaPlan y trae las 59 carreras', () => {
  assert.ok(Array.isArray(datos), 'el dataset debe ser un arreglo de planes');
  assert.equal(datos.length, 59, 'RF-1: las 59 pregrado, sin subconjuntos ni piloto');

  // RNF-2: el contrato de la spec 001 se exige tal cual. Un campo de más, de menos o mal
  // tipeado hace fallar aquí, no al intentar usarlo en la interfaz.
  const invalidos: string[] = [];
  for (const [indice, candidato] of datos.entries()) {
    const r = esquemaPlan.safeParse(candidato);
    if (!r.success) {
      const detalle = r.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`);
      invalidos.push(`#${indice}: ${detalle.join('; ')}`);
    }
  }
  assert.deepEqual(invalidos, [], 'planes que violan esquemaPlan');
  assert.equal(planes.length, 59, 'planesIniciales() no debe filtrar ni revalidar a medias');
});

test('T9: la distribución por sede es 33 Soyapango / 15 Antiguo Cuscatlán / 11 UDB Virtual', () => {
  const porSede = new Map<Sede, number>();
  for (const plan of planes) porSede.set(plan.sede, (porSede.get(plan.sede) ?? 0) + 1);
  assert.deepEqual(Object.fromEntries(porSede), {
    soyapango: 33,
    'antiguo-cuscatlan': 15,
    virtual: 11,
  });
  assert.equal(
    new Set(planes.map((p) => p.tipo)).size,
    4,
    'ingenierías, licenciaturas, técnicos y profesorados',
  );
});

test('T9/RF-4: 0 claves duplicadas, y la tripleta sin el nombre habría colisionado', () => {
  // `indicePorClave` lanza ante la primera repetida: si no lanza, no hay ninguna.
  const indice = indicePorClave(planes);
  assert.equal(indice.size, 59);

  // La razón de ser de RF-4: con (tipo, sede, plan) a secas, varias carreras reales
  // compartirían clave y sus notas se mezclarían. Con el nombre, cada una es su propia entrada.
  const porTripleta = new Set(planes.map((p) => `${p.tipo}|${p.sede}|${p.planVersion}`));
  assert.ok(
    porTripleta.size < 59,
    'sin el nombre en la clave no habría ninguna colisión y RF-4 no probaría nada',
  );
  assert.equal(
    new Set(planes.map(claveDePlan)).size,
    59,
    'la clave con nombre separa todos los grupos que colisionan',
  );
});

test('T9/RF-5: los homónimos conviven con sus propios datos y sin compartir clave', () => {
  const cc = planes.filter((p) => p.carrera.includes('Ciencias de la Computación'));
  assert.equal(cc.length, 3, 'Soyapango, Antiguo Cuscatlán y UDB Virtual');

  const presencial = cc.find((p) => p.sede === 'soyapango')!;
  const virtual = cc.find((p) => p.sede === 'virtual')!;
  assert.equal(presencial.uvTotal, 161);
  assert.equal(presencial.materiasTotal, 40);
  assert.equal(virtual.uvTotal, 176);
  assert.equal(virtual.materiasTotal, 44);

  // Las dos sedes presenciales comparten tipo, sede... no, comparten tipo y plan, difieren en
  // sede: aun así, con la clave completa ninguna depende del orden del archivo.
  const antio = cc.find((p) => p.sede === 'antiguo-cuscatlan')!;
  assert.notEqual(claveDePlan(presencial), claveDePlan(antio));
  assert.notEqual(claveDePlan(presencial), claveDePlan(virtual));
});

test('T9/RF-15: ningún camino de la cascada queda sin carreras', () => {
  const tipos = tiposDisponibles(planes);
  assert.equal(tipos.length, 4);

  let alcanzadas = 0;
  for (const tipo of tipos) {
    const sedes = sedesParaTipo(planes, tipo);
    assert.ok(sedes.length > 0, `tipo sin ninguna sede: ${tipo}`);
    const esperadas = planes.filter((p) => p.tipo === tipo).length;
    let vistas = 0;
    for (const sede of sedes) {
      const ofertas = carrerasPara(planes, tipo as TipoCarrera, sede);
      assert.ok(ofertas.length > 0, `camino sin carreras: ${tipo}/${sede}`);
      vistas += ofertas.length;
    }
    assert.equal(vistas, esperadas, `la cascada se deja fuera ofertas del tipo ${tipo}`);
    alcanzadas += vistas;
  }
  assert.equal(alcanzadas, planes.length, 'toda carrera es alcanzable desde el primer select');
});
