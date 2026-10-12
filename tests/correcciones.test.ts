// T3 (spec 004, RF-3, RF-9) — pipeline/correcciones.ts: correcciones curadas de nombres.
//
// El registro es el único sitio donde se fija un nombre a mano (RNF-3): versionado en el repo,
// aplicado por el id estable de la asignatura y sin tocar ningún otro campo (RF-8).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarCorrecciones, type CorreccionNombre } from '../pipeline/correcciones.ts';
import type { Plan } from '../src/domain/tipos.ts';

const idDe = (ciclo: number, codigo: string) =>
  `virtual:licenciatura:plan-2024:licenciatura-en-diseno-grafico:${ciclo}:${codigo}`;

function planDePrueba(): Plan {
  return {
    carrera: 'Licenciatura en Diseño Gráfico',
    sede: 'virtual',
    tipo: 'licenciatura',
    planVersion: 'plan-2024',
    modalidad: 'Distancia',
    uvTotal: 16,
    materiasTotal: 4,
    ciclos: [
      {
        numero: 3,
        asignaturas: [
          {
            id: idDe(3, 'DCG919'),
            codigo: 'DCG919',
            nombre: 'Uy',
            uv: 4,
            prerrequisito: null,
            electiva: false,
            laboratorio: false,
          },
          {
            id: idDe(3, 'DCM919'),
            codigo: 'DCM919',
            nombre: 'Diseño de Contenidos Multimedia',
            uv: 4,
            prerrequisito: 'DCG919',
            electiva: false,
            laboratorio: true,
          },
        ],
      },
      {
        numero: 9,
        asignaturas: [
          // Dos electivas del mismo ciclo: mismo código `-`, distinto id por su orden (D2).
          {
            id: idDe(9, 'electiva-1'),
            codigo: '-',
            nombre: 'Electiva Uno',
            uv: 4,
            prerrequisito: null,
            electiva: true,
            laboratorio: false,
          },
          {
            id: idDe(9, 'electiva-2'),
            codigo: '-',
            nombre: '',
            uv: 4,
            prerrequisito: null,
            electiva: true,
            laboratorio: false,
          },
        ],
      },
    ],
  };
}

const correccion = (sobrescribir: Partial<CorreccionNombre> = {}): CorreccionNombre => ({
  id: idDe(3, 'DCG919'),
  nombre: 'Dibujo Técnico para la Comunicación Gráfica',
  fuente: 'pensum_licenciatura_diseno_grafico.pdf',
  motivo: 'el lector publicaba "Uy"; cotejado contra la grilla del ciclo III',
  ...sobrescribir,
});

test('RF-3 (spec 004): la corrección sustituye solo el nombre de su asignatura', () => {
  const plan = planDePrueba();
  const antes = plan.ciclos[0]!.asignaturas[0]!;
  const c = correccion();

  const r = aplicarCorrecciones(plan, [c]);
  const despues = r.plan.ciclos[0]!.asignaturas[0]!;

  assert.equal(despues.nombre, 'Dibujo Técnico para la Comunicación Gráfica');
  assert.deepEqual(r.aplicadas, [{ ...c, nombre: 'Dibujo Técnico para la Comunicación Gráfica' }]);
  assert.deepEqual(r.huerfanas, []);

  // RF-8: todo lo demás intacto, incluido el `id` con el que se localizó.
  assert.deepEqual({ ...despues, nombre: antes.nombre }, antes);
  assert.equal(despues.id, antes.id);

  // Las demás asignaturas del plan no se enteran.
  assert.equal(r.plan.ciclos[0]!.asignaturas[1]!.nombre, 'Diseño de Contenidos Multimedia');
  assert.equal(r.plan.ciclos[1]!.asignaturas[1]!.nombre, '');

  // RF-9: el plan de entrada no se muta (dos corridas con la misma entrada dan lo mismo).
  assert.equal(plan.ciclos[0]!.asignaturas[0]!.nombre, 'Uy');
});

test('RF-3 (spec 004): sin registro no se toca nada (registro vacío)', () => {
  const plan = planDePrueba();
  const r = aplicarCorrecciones(plan, []);
  assert.equal(r.plan, plan, 'con registro vacío el plan ni siquiera se recopia');
  assert.deepEqual(r.aplicadas, []);
  assert.deepEqual(r.huerfanas, []);
});

test('RF-3 (spec 004): dos electivas del mismo ciclo no se confunden (D2)', () => {
  const plan = planDePrueba();
  const c = correccion({
    id: idDe(9, 'electiva-2'),
    nombre: 'Diseño de Servicios',
    motivo: 'nombre ilegible en la celda de la electiva II',
  });

  const r = aplicarCorrecciones(plan, [c]);
  const electivas = r.plan.ciclos[1]!.asignaturas!;

  assert.equal(electivas[0]!.nombre, 'Electiva Uno', 'la electiva I no debe tocarse');
  assert.equal(electivas[1]!.nombre, 'Diseño de Servicios');
  assert.equal(electivas[1]!.codigo, '-', 'ambas siguen siendo `-`');
});

test('RF-3 (spec 004, caso límite 8): un id inexistente queda huérfano y no se aplica', () => {
  const plan = planDePrueba();
  const c = correccion({ id: 'virtual:licenciatura:plan-2024:otra-carrera:3:XXX999' });

  const r = aplicarCorrecciones(plan, [c]);

  assert.deepEqual(r.aplicadas, []);
  assert.equal(r.huerfanas.length, 1);
  assert.equal(r.huerfanas[0]!.razon, 'id-inexistente');
  assert.deepEqual(r.huerfanas[0]!.correccion, c, 'la corrección completa viaja para poder señalarla');
  // El plan sigue con sus nombres originales.
  assert.equal(r.plan.ciclos[0]!.asignaturas[0]!.nombre, 'Uy');
});

test('RF-3 (spec 004): el nombre de la corrección pasa por el mismo saneado (RF-1)', () => {
  const plan = planDePrueba();
  const c = correccion({ nombre: '  Dibujo Técnico para la  Comunicación Gráfica | ' });

  const r = aplicarCorrecciones(plan, [c]);

  assert.equal(r.plan.ciclos[0]!.asignaturas[0]!.nombre, 'Dibujo Técnico para la Comunicación Gráfica');
  assert.equal(r.aplicadas[0]!.nombre, 'Dibujo Técnico para la Comunicación Gráfica');
});

test('RF-3 (spec 004): una corrección cuyo nombre queda vacío no se aplica y queda huérfana', () => {
  const plan = planDePrueba();
  const c = correccion({ id: idDe(9, 'electiva-2'), nombre: ' | | ' });

  const r = aplicarCorrecciones(plan, [c]);

  assert.equal(r.plan.ciclos[1]!.asignaturas[1]!.nombre, '', 'no se publica un nombre vacío');
  assert.deepEqual(r.aplicadas, []);
  assert.equal(r.huerfanas.length, 1);
  assert.equal(r.huerfanas[0]!.razon, 'nombre-invalido');
});

test('RF-3 (spec 004): dos correcciones para el mismo id son ambiguas y ninguna se aplica', () => {
  const plan = planDePrueba();
  const c1 = correccion({ nombre: 'Nombre Uno' });
  const c2 = correccion({ nombre: 'Nombre Dos' });

  const r = aplicarCorrecciones(plan, [c1, c2]);

  assert.equal(r.plan.ciclos[0]!.asignaturas[0]!.nombre, 'Uy');
  assert.deepEqual(r.aplicadas, []);
  assert.equal(r.huerfanas.length, 1);
  assert.equal(r.huerfanas[0]!.razon, 'id-duplicado');
});
