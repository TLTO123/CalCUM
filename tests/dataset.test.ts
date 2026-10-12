// T9 (RF-1, RF-4, RF-5, RF-14, RF-15, RNF-2) — `data/planes.json`, el dataset completo.
//
// Es la prueba de que la app ya no arranca con planes de muestra: el archivo tiene que existir,
// cumplir el contrato de datos de la spec 001 **sin cambiarlo** (RNF-2) y traer las 59
// carreras con claves únicas. Si `npm run datos` no corrió o publicó menos planes, esto falla
// ruidosamente en CI y no en el navegador (P2).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import datos from '../data/planes.json' with { type: 'json' };
import correcciones from '../pipeline/correcciones-nombres.json' with { type: 'json' };
import { esquemaPlan } from '../src/data/esquema.ts';
import { claveDePlan, indicePorClave, planesIniciales } from '../src/data/repositorio.ts';
import { carrerasPara, sedesParaTipo, tiposDisponibles } from '../src/domain/cascada.ts';
import { revisarNombres } from '../pipeline/validar.ts';
import type { Asignatura, Plan, Sede, TipoCarrera } from '../src/domain/tipos.ts';

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

// --- T7 (spec 004 · RF-1, RF-5, RF-8): el dataset regenerado publica el anexo A ---------------
//
// El anexo A clasifica los 46 nombres con basura de UDB Virtual en 4 estados, y esta tira de
// ids fija cuál publica cada uno después de `npm run datos`:
//
//   * **sano** (16): el saneado automático (T1/T2) los deja ya correctos;
//   * **curado** (21): publican su corrección curada de `pipeline/correcciones-nombres.json`;
//   * **pareja** (3): pasan el control y RF-7 solo avisa — quedan intactos;
//   * **fuera** (6): dañados de verdad (anexo B.1), fuera del alcance aprobado: publican su
//     nombre dañado **sin que el control los bloquee**, porque incumplen 0 de las 5 reglas.
//
// Todo por `id` (RF-11), nunca por código+nombre: `EDN902`, `TIC902`, `PPI905` y compañía se
// repiten entre planes y ciclos, y una lectura por código mezclaría filas de carreras distintas.

const LICO = 'virtual:licenciatura:plan-2024:licenciatura-en-ciencias-de-la-comunicacion-a-distancia';
const LIDG = 'virtual:licenciatura:plan-2024:licenciatura-en-diseno-grafico-a-distancia';
const LIMK = 'virtual:licenciatura:plan-2024:licenciatura-en-marketing-a-distancia';
const LIAD = 'virtual:licenciatura:plan-2024:licenciatura-en-administracion-de-empresas-a-distancia';
const TECO = 'virtual:tecnico:plan-2024:tecnico-en-ingenieria-en-computacion-a-distancia';
const TEDG = 'virtual:tecnico:plan-2024:tecnico-en-diseno-grafico-a-distancia';
const TEMM = 'virtual:tecnico:plan-2024:tecnico-en-multimedia-a-distancia';

/** 16 sanos: lo que el saneado deja tras quitar glifos y recomponer el nombre. */
const SANOS: ReadonlyArray<readonly [string, string]> = [
  [`${LICO}:4:PPI905`, 'Práctica Profesional'],
  [`${LICO}:5:EDA905`, 'Estudio de Audiencias'],
  [`${LICO}:5:IYE905`, 'Innovación y Emprendimiento'],
  [`${LIDG}:3:DCM919`, 'Diseño de Contenidos Multimedia'],
  [`${LIDG}:4:electiva-4`, 'Investigación de Mercados'],
  [`${LIDG}:4:AND919`, 'Animación Digital'],
  [`${LIDG}:4:CRP919`, 'Creatividad Publicitaria'],
  [`${LIDG}:4:DTR919`, 'Diseño Tridimensional'],
  [`${LIDG}:4:PPM919`, 'Publicación de Productos Multimedia'],
  [`${LIDG}:8:ADD919`, 'Animación 2D y 3D'],
  [`${LIDG}:8:LDP919`, 'Lógica de Programación'],
  [`${LIDG}:9:EPI919`, 'Ética y Propiedad Intelectual'],
  [`${LIMK}:3:ADE920`, 'Análisis de Datos Empresariales'],
  [`${TECO}:3:SPP901`, 'Servidores en Plataformas Propietarias'],
  [`${TECO}:4:ADP901`, 'Administración de Proyectos'],
  [`${TEMM}:4:PPI905`, 'Práctica Profesional'],
];

/** 3 parejas sanas: RF-7 avisa, pero el nombre publicado es el correcto y no se toca. */
const PAREJAS_SANAS: ReadonlyArray<readonly [string, string]> = [
  [`${LIAD}:3:EDN902`, 'Estadística de Negocios'],
  [`${LIAD}:7:EDN902`, 'Análisis e Interpretación de Estados Financieros'],
  [`${LIDG}:3:TIP919`, 'Tipografía'],
];

/** 21 curados: solo el id; el nombre esperado lo dice el registro, no la spec (una sola fuente). */
const CURADOS: readonly string[] = [
  'virtual:ingenieria:plan-2024:ingenieria-industrial-a-distancia:7:EPI906',
  `${LICO}:1:GIC905`,
  `${LICO}:3:EFD905`,
  `${LICO}:9:EYP905`,
  `${LIDG}:2:PRM919`,
  `${LIDG}:3:DCG919`,
  `${LIDG}:6:GCP919`,
  `${LIDG}:9:DPA919`,
  `${LIDG}:9:DWM919`,
  `${LIMK}:1:TIC902`,
  `${LIMK}:4:CMM909`,
  `${TECO}:2:ADB901`,
  `${TECO}:2:DAS901`,
  `${TECO}:3:ASN901`,
  `${TECO}:4:EIC901`,
  'virtual:tecnico:plan-2024:tecnico-en-marketing-digital-y-ventas-a-distancia:1:TIC902',
  'virtual:tecnico:plan-2024:tecnico-en-marketing-digital-y-ventas-a-distancia:4:CMM909',
  `${TEMM}:1:GIC905`,
  `${TEMM}:3:EFD905`,
  `${TEDG}:3:TIP919`,
  `${TEDG}:3:DCG919`,
];

/** 6 fuera (anexo B.1): publican el daño tal cual lo deja el saneado, y por eso pasan el control. */
const FUERA: ReadonlyArray<readonly [string, string]> = [
  [`${LIDG}:3:electiva-4`, 'Costos y de Presupuestos Negocios de Diseño'],
  [`${LIDG}:3:IAD919`, 'Aplicada al Diseño'],
  [`${LIDG}:6:EMD919`, 'Estrategias de Marketing Digital —'],
  [`${LIDG}:7:DEE919`, 'Diseño, oy Estrategia de Empaques y Envases'],
  [`${TEDG}:2:TCV919`, 'Técnicas de ición Composición Visual'],
  [`${TEDG}:3:CND919`, 'Presupuestos de Negocios de Diseño'],
];

/** Índice global de asignaturas por id: los ids son únicos entre planes (RF-11). */
const porId = new Map<string, { plan: Plan; ciclo: number; asignatura: Asignatura }>();
for (const plan of planes) {
  for (const ciclo of plan.ciclos) {
    for (const asignatura of ciclo.asignaturas) {
      porId.set(asignatura.id, { plan, ciclo: ciclo.numero, asignatura });
    }
  }
}

/** Nombre que el dataset publica para un id del anexo A; falla ruidosamente si no existe. */
function nombrePublicado(id: string): string {
  const fila = porId.get(id);
  assert.ok(fila, `id del anexo A ausente del dataset: ${id}`);
  return fila.asignatura.nombre;
}

test('T7: el anexo A cubre 46 ids distintos y el dataset publica los 46', () => {
  const ids = [...SANOS, ...PAREJAS_SANAS, ...FUERA].map(([id]) => id).concat(CURADOS);
  assert.equal(SANOS.length, 16, 'el anexo A marcó 16 sanos');
  assert.equal(PAREJAS_SANAS.length, 3, 'de las 5 parejas, 3 quedan intactas');
  assert.equal(CURADOS.length, 21, 'el anexo A terminó en 21 curaciones');
  assert.equal(FUERA.length, 6, 'anexo B.1: 6 fuera de alcance');
  assert.equal(ids.length, 46, '16 + 3 + 21 + 6 = 46 del anexo A');
  assert.equal(new Set(ids).size, 46, 'ningún id del anexo A repetido');
  for (const id of ids) assert.ok(porId.has(id), `id del anexo A ausente del dataset: ${id}`);
});

test('T7/RF-5: sobre data/planes.json, 0 de los 59 carreras incumplen las 5 reglas del control', () => {
  const infractores: string[] = [];
  for (const plan of planes) {
    for (const error of revisarNombres(plan)) infractores.push(error.message);
  }
  assert.deepEqual(infractores, [], 'el control de nombres debe quedar en verde');
  // Que el saneado no haya “arreglado” nada publicando menos: mismas 59 carreras de siempre.
  assert.equal(planes.length, 59);
});

test('T7/RF-1: los 16 sanos y las 3 parejas del anexo A publican exactamente su nombre', () => {
  for (const [id, esperado] of SANOS) {
    assert.equal(nombrePublicado(id), esperado, `sano del anexo A: ${id}`);
  }
  for (const [id, esperado] of PAREJAS_SANAS) {
    assert.equal(nombrePublicado(id), esperado, `pareja sana del anexo A: ${id}`);
  }
});

test('T7/RF-3: los 21 ids curados publican su corrección curada, ni una de más ni de menos', () => {
  const delRegistro = new Map(correcciones.map((c) => [c.id, c.nombre]));
  assert.equal(correcciones.length, 21, 'el registro tiene 21 curaciones (RF-9)');
  assert.deepEqual(
    [...CURADOS].sort(),
    [...delRegistro.keys()].sort(),
    'los ids del registro deben ser exactamente los marcados «curar» + los 2 parejas dañados',
  );
  for (const id of CURADOS) {
    assert.equal(nombrePublicado(id), delRegistro.get(id), `curado del anexo A: ${id}`);
  }
});

test('T7/RF-8: los 6 fuera publican su nombre dañado y el control no los bloquea', () => {
  for (const [id, esperado] of FUERA) {
    assert.equal(nombrePublicado(id), esperado, `fuera del anexo A (anexo B.1): ${id}`);
    // “Sin que el control los bloquee”: su plan completo pasa las 5 reglas (RF-5), que es
    // justo por qué el daño queda publicado y documentado en el anexo B en vez de frenar todo.
    const fila = porId.get(id)!;
    assert.deepEqual(
      revisarNombres(fila.plan),
      [],
      `el control bloquea un nombre fuera de alcance: ${id}`,
    );
  }
});
