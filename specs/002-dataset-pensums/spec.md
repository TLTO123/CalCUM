# Spec 002 — Dataset completo de pensums de pregrado

Estado: implementada (2026-10-07; aprobada el 2026-10-05, T1–T10 completadas y checklist de
cierre en `tasks.md`)

## Contexto y objetivo

La spec 001 dejó la calculadora funcional pero alimentada por **5 planes de muestra** (fixtures).
El estudiante de la mayoría de carreras todavía no puede usar la app.

Esta spec entrega el **dataset real**: los pensums de pregrado publicados por la UDB para sus 3
sedes/modalidades, verificados en `docs/01-oferta-academica-udb.md`. La app debe cargar ese
dataset sin cambiar el contrato de datos ya validado y sin romper nada de la spec 001.

Por qué importa: las UV de cada materia son el **denominador del C.U.M**. Un dato mal extraído
produce un coeficiente incorrecto de forma silenciosa, que es exactamente el fallo que la
constitución prohíbe (P1 y P2).

## Usuarios

- **Estudiante UDB** de cualquier carrera de pregrado (Soyapango, Antiguo Cuscatlán o UDB Virtual).
- **Mantenedor del proyecto**, que regenera el dataset cuando la UDB publica un plan nuevo o
  corrige un pensum.

## Historias de usuario

- HU-1. Como estudiante de cualquier carrera de pregrado, quiero encontrar mi carrera en la lista
  para cargar su pensum oficial y calcular mi C.U.M.
- HU-2. Como estudiante, quiero que las UV de cada materia coincidan con el pensum vigente de mi
  plan para que mi coeficiente sea el correcto.
- HU-3. Como estudiante de una carrera con nombre repetido (presencial y virtual), quiero el
  pensum de mi sede/modalidad y no el de la otra.
- HU-4. Como mantenedor, quiero que un error de extracción impida publicar el dataset para no
  repartir datos incorrectos a los estudiantes.
- HU-5. Como usuario que ya tiene notas guardadas, quiero que una regeneración del dataset no me
  borre el avance.

## Definiciones

- **Pensum**: documento oficial de la UDB que lista, por ciclo, las asignaturas con código, nombre,
  unidades valorativas (UV) y prerrequisito, y declara en su encabezado los totales oficiales
  (`UNIDADES VALORATIVAS` y `TOTAL DE MATERIAS A CURSAR`).
- **Plan**: versión de un pensum (`plan-2022`, `plan-2024`, `plan-2025`, `plan-2026`).
- **Carrera**: combinación de tipo, sede, plan y nombre. Dos carreras con el mismo nombre en sedes
  distintas son carreras distintas.
- **Pregrado**: Ingenierías, Licenciaturas, Técnicos y Profesorados. Excluye Maestrías y Doctorados.
- **Dataset**: conjunto completo de planes que consume la aplicación.

## Requisitos funcionales

- RF-1: EL SISTEMA publica el pensum de **las 59 carreras de pregrado** listadas en
  `docs/01-oferta-academica-udb.md` (33 de Campus Soyapango, 15 de Campus Antiguo Cuscatlán y 11
  de UDB Virtual), sin subconjuntos ni versión piloto.
- RF-2: CUANDO se procesa un pensum, EL SISTEMA compara la suma de UV de las asignaturas extraídas
  contra el total publicado en el encabezado del documento. SI difieren, ENTONCES el sistema no
  publica el dataset y reporta la carrera, el total esperado, el total obtenido y la diferencia.
  **Única excepción** (D10): si la discrepancia coincide exactamente con una entrada de
  `EXCEPCIONES_RF2` aprobada por el usuario, se publica la suma real de la grilla y la
  diferencia —con sus tres valores y su motivación— queda registrada en `data/manifiesto.json`
  y en `docs/02-reporte-dataset.md`. Cualquier otra diferencia sigue bloqueando.
- RF-3: CUANDO se procesa un pensum, EL SISTEMA compara el número de asignaturas extraídas contra
  `TOTAL DE MATERIAS A CURSAR`. SI difieren, ENTONCES el sistema no publica el dataset y reporta
  el mismo detalle que en RF-2.
- RF-4: EL SISTEMA identifica cada carrera por **tipo, sede, plan y nombre**, de modo que dos
  carreras que comparten tipo, sede y plan no colisionen en la misma clave.
- RF-5: CUANDO dos carreras comparten nombre en sedes o modalidades distintas, EL SISTEMA publica
  planes independientes con sus propios datos (p. ej. Ingeniería en Ciencias de la Computación:
  161 UV / 40 materias presencial frente a 176 UV / 44 materias virtual).
- RF-6: EL SISTEMA conserva por carrera el plan vigente declarado por la UDB y las UV de cada
  materia **de ese plan**, sin mezclar planes ni nombre de carrera entre sí.
- RF-7: CUANDO una carrera de Campus Antiguo Cuscatlán reutiliza el mismo pensum que su homóloga
  de Soyapango, EL SISTEMA publica una entrada propia con su sede y el mismo contenido de
  asignaturas.
- RF-8: POR cada asignatura el sistema publica: código, nombre, UV, ciclo, prerrequisito y la
  naturaleza de la materia (electiva, prácticas de laboratorio).
- RF-9: CUANDO una materia es electiva y carece de código fijo, EL SISTEMA la publica marcada como
  electiva con su UV y su ciclo, conservando su identidad sin depender del orden de extracción.
- RF-10: EL SISTEMA trata "Bachillerato" como requisito de ingreso y no como prerrequisito de una
  asignatura. SI un prerrequisito no corresponde a ninguna asignatura del plan ni es "Bachillerato",
  ENTONCES el sistema lo publica vacío y lo registra como advertencia en el reporte de generación,
  sin detener la publicación.
- RF-11: EL SISTEMA genera identificadores de carrera y de asignatura **estables entre
  regeneraciones**: si el origen no cambió, los identificadores no cambian, de modo que las notas
  guardadas por el estudiante siguen asociadas a su materia.
- RF-12: EL SISTEMA es reproducible: dos ejecuciones sobre los mismos orígenes producen el mismo
  dataset.
- RF-13: SI una carrera, un pensum o una asignatura no puede extraerse o validarse, ENTONCES el
  sistema detiene la publicación y señala el elemento exacto; nunca entrega un dataset parcial.
- RF-14: CUANDO la aplicación arranca, EL SISTEMA carga el dataset completo validado con el
  contrato de datos existente, **sin añadir ni quitar campos**, y deja de depender de los planes
  de muestra.
- RF-15: EL SISTEMA mantiene el comportamiento de la spec 001 con el dataset completo: ninguna
  clave duplicada, ningún camino de la cascada sin carreras y ninguna nota guardada reasignada.
- RF-16: EL SISTEMA permite auditar de dónde salió cada plan publicado (documento de origen y
  fecha de extracción).

## Requisitos no funcionales

- RNF-1: El proceso de generación se ejecuta en el entorno del proyecto **sin Python** ni
  herramientas externas al proyecto (el entorno no lo tiene instalado).
- RNF-2: El dataset publicado es JSON en UTF-8 y cumple el contrato de datos existente sin
  modificaciones; la validación ruidosa de la spec 001 (P2) sigue aplicando al cargarlo.
- RNF-3: El dataset es un artefacto estático: la aplicación no consulta la UDB durante su
  ejecución (RF-16 de la spec 001 permanece intacto).
- RNF-4: La aplicación arranca con el dataset completo sin degradación perceptible respecto a la
  spec 001.
- RNF-5: Toda la información publicada es pública y no contiene datos personales ni credenciales.

## Casos límite

1. El PDF del pensum es infográfico y su texto sale **intercalado entre columnas**: el orden
   lineal no corresponde al orden visual.
2. Hay varias materias electivas `- Electiva -` sin código en un mismo ciclo.
3. Prerrequisito "Bachillerato" (requisito de ingreso, no una materia del plan).
4. Prerrequisito que no corresponde a ninguna asignatura del mismo plan.
5. Asignaturas de ciclo complementario y de trabajo de graduación con varias modalidades.
6. 15 carreras de Antiguo Cuscatlán comparten el documento de pensum con Soyapango.
7. Homónimos presencial/virtual con UV y número de materias distintos.
8. Enlaces de pensum publicados como `http://` que redirigen a `https://`.
9. El encabezado declara unos totales que no cuadran con las filas (la UDB actualizó el documento).
10. Un pensum falta, está protegido o no es legible.
11. La ficha de carrera no declara modalidad y hay que inferirla de la sede.
12. Carreras de la misma sede con planes distintos (plan-2022 y plan-2024 conviviendo).

## Fuera de alcance

- Maestrías y Doctorados (posgrado).
- Modificar la fórmula del C.U.M, las reglas de negocio, la interfaz o el almacenamiento descritos
  en la spec 001, **a excepción** de la clave única de carrera que RF-4 corrige.
- Consultar la UDB en tiempo de ejecución de la aplicación.
- Actualización automática programada del dataset.
- Exportar o compartir el resultado como imagen (spec 003).
- Confirmar la escala de notas con el normativo UDB (pendiente heredado de la spec 001).

## Criterios de finalización

- Las **59 carreras** publicadas y cargadas por la aplicación.
- **0 discrepancias sin aprobar** de ΣUV y de número de materias en las 59 validaciones
  (RF-2 y RF-3). La única excepción publicada (Ingeniería Eléctrica, D10) queda documentada en
  el manifiesto y en el reporte.
- **0 claves duplicadas** con el dataset completo y **0 caminos vacíos** en la cascada.
- Las notas guardadas antes de la regeneración siguen asociadas a la misma materia.
- `npm test` en verde (los 46 existentes más los nuevos del proceso) y `npm run typecheck` sin
  errores.
- Cotejo manual de 3 carreras, una por sede, contra su documento de origen.

## Decisiones de clarificación (2026-10-05, aprobadas por el usuario)

- **D1 → RF-4 aceptada.** La clave única de carrera pasa a `(tipo, sede, plan, nombre)`. Esto
  corrige una regla de `AGENTS.md` y de la spec 001 que colisiona con el dataset completo; la
  actualización de `AGENTS.md` queda como parte del alcance de esta spec.
- **D2 → RF-13 confirmado estricto.** Un solo pensum inválido detiene toda la publicación
  (coherente con P2 de la constitución: fallar ruidosamente, nunca en silencio).
- **D3 → RF-1 confirmado.** Se publican **59 planes**; Antiguo Cuscatlán mantiene su entrada
  propia aunque su contenido de asignaturas sea idéntico al de Soyapango.
- **D4 → RF-10 ampliado.** Un prerrequisito huérfano no bloquea: se publica vacío con advertencia
  registrada. Sí bloquean las validaciones de UV y de número de materias (RF-2 y RF-3).

Decisiones de clarificación adicionales (2026-10-05, aprobadas por el usuario):

- **D8 del plan ampliado → el ciclo entra en el id de asignatura.** El PDF oficial de la
  Lic. Administración (virtual) repite el código `EDN902` en dos materias distintas (ciclo 3 y
  ciclo 7); sin el segmento de ciclo colisionaban los ids y RF-11 mezclaría sus notas.
- **D10 → excepción RF-2 única y registrada.** Ingeniería Eléctrica publica la suma real de su
  grilla (163 UV) frente a los 162 del sitio y de la cabecera del PDF; la discrepancia queda en
  `EXCEPCIONES_RF2`, en `data/manifiesto.json` y en `docs/02-reporte-dataset.md`.

No quedan dudas abiertas.
