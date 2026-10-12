# Plan — Spec 004: Nombres de asignatura saneados en el dataset

Estado: **implementado** (aprobado el 2026-10-08; ampliado el mismo día con la medición de las
seis señales: D5 suma dos reglas al control, el anexo A pasa a 46 casos y el cotejo a 19. Cerrado
con T8 el 2026-10-11)

Aclaración del usuario al aprobar: el artefacto heredado `Oscilaciones, Fluidos y Calor .` (riesgo 5)
queda **fuera de alcance**; no se añade regla de puntuación final suelta.

Objetivo: que **ningún nombre publicado** lleve glifos de ruido de la tabla, palabras partidas ni
vacíos, y que el dataset **no vuelva a publicar** ninguno de esos casos sin que la generación se
detenga.

## 1. Mapeo RF → piezas

| RF | Pieza responsable |
|---|---|
| RF-1, RF-2 | `pipeline/ocr.ts` (`depurarRuido`) + `pipeline/parsear.ts` (`componerNombre` omite el ruido; `saneadoNombre` normaliza) |
| RF-3, RF-6, RF-9 | `pipeline/correcciones-nombres.json` (registro versionado) + `pipeline/correcciones.ts` (`aplicarCorrecciones`, pura) + `pipeline/generar.ts` (aplicación y registro en manifiesto/reporte) |
| RF-4 | `pipeline/validar.ts` (`revisarNombres`): nombre sin recuperar y sin corrección ⇒ error que bloquea |
| RF-5 | `pipeline/validar.ts` (`revisarNombres`): control de nombres sobre el dataset completo, **bloqueante** |
| RF-7 | `pipeline/validar.ts` (`advertirDivergencias`): mismo código con nombres muy distintos entre planes ⇒ advertencia |
| RF-8 | `pipeline/generar.ts`: la corrección solo sustituye `asignatura.nombre`; el resto del plan no se toca (comprobado en tests y por el diff de `data/planes.json`) |
| RNF-1, RNF-2, RNF-3 | Sin dependencias nuevas, sin red, sin tocar el contrato de datos ni editar `data/planes.json` a mano |

## 2. Archivos y responsabilidades

**Nuevos:**

| Archivo | Responsabilidad |
|---|---|
| `pipeline/correcciones-nombres.json` | Registro versionado de las correcciones curadas: `[{ id, nombre, fuente, motivo }]`. Es el único sitio donde se fija un nombre a mano (RF-3, RNF-3) |
| `pipeline/correcciones.ts` | **Función pura** `aplicarCorrecciones(plan, registro) → { plan, aplicadas[] }`, el tipo `CorreccionNombre` y `revisarCorreccionesHuerfanas` (caso límite 8) |
| `tests/correcciones.test.ts` | Pruebas de la aplicación, del registro y de la corrección obsoleta |

**Modificados:**

| Archivo | Cambio |
|---|---|
| `pipeline/ocr.ts` | `depurarRuido(items) → items`: descarta los ítems que son solo `|`/`¦` (líneas de tabla leídas como glifos). Se llama dentro de `itemsDeImagen`, antes del agrupado |
| `pipeline/parsear.ts` | `componerNombre` omite los ítems de ruido al unir; se normaliza con `saneadoNombre`; el nombre vacío **pasa** en vez de lanzar (ver D4) |
| `pipeline/validar.ts` | `revisarNombres(plan)` (RF-4/RF-5) y `advertirDivergencias(pendientes)` (RF-7), enganchados en `validarPensum` y en `validar` |
| `pipeline/generar.ts` | Orden **parsear → identificar → corregir → validar**; el registro entra inyectado (como `fuentes`) y se lee en `main`; `redactarReporte` y `PublicacionManifiesto` registran las correcciones aplicadas |
| `tests/extraccion.test.ts` | Ruido de tabla: ítems `|` de 0,5–1,4 pt no llegan al nombre; un nombre que es todo ruido no lanza |
| `tests/validar.test.ts` | Control de nombres bloqueante y advertencia de divergencia |
| `tests/lote.test.ts` | Generación de extremo a extremo con correcciones (aplicadas y obsoletas) |
| `tests/dataset.test.ts` | Sobre `data/planes.json` real: 0 nombres con glifos prohibidos en las 59 carreras, y los 31 ids del anexo A con su nombre saneado |

No se toca `src/`: la app recibe el mismo contrato con mejores valores (RNF-2). No se tocan las
validaciones de UV ni de número de materias de la spec 002.

## 3. Funciones puras y pseudocódigo (P5)

```ts
// ocr.ts — RF-2. Causa: el lector devuelve las líneas de la tabla como glifos.
depurarRuido(items) → items[]
  para cada ítem:
    si el texto recortado solo contiene '|' o '¦'  → descartar   // ninguna palabra es una barra
  // Medido en la fuente: 66 ítems de ancho 0,5–1,4 pt en el pensum de Diseño Gráfico;
  // ningún nombre de las 59 carreras contiene '|' de forma legítima (verificado, 0 de 1794).

// parsear.ts — RF-1. Compuerta: vale para la capa de texto y para el OCR.
componerNombre(filasDeLaAsignatura) → string
  por cada fila, de arriba abajo:
    por cada ítem, de izquierda a derecha:
      si esRuidoDeTabla(item) o esRellenoDeUv(item) → omitir
      si es marca '•'/'*' → marcar laboratorio y omitir
      si no → añadir item.str
    unir con un solo espacio entre filas
  → saneadoNombre(crudo)

saneadoNombre(texto) → string
  quitar glifos de ruido residuales (| ¦)
  colapsar espacios dobles, recortar extremos

// parsear.ts — D4: el nombre vacío ya no lanza aquí.
  si el nombre saneado está vacío → se publica '' y lo decide `validar`

// correcciones.ts — RF-3.
aplicarCorrecciones(plan, registro) → { plan, aplicadas[] }
  para cada corrección del registro:
    localizar la asignatura por su `id` en el plan
    si no existe → acumular error (caso límite 8: la corrección quedó obsoleta)
    si existe   → sustituir SOLO `nombre`, y registrar { id, nombre, fuente, motivo }

// validar.ts — RF-4, RF-5 (bloqueante) y RF-7 (advertencia).
revisarNombres(plan) → { errores[], advertencias[] }
  para cada asignatura:
    si nombre.trim() === ''            → error  "carrera · código · ciclo: sin nombre recuperable"
    si contiene glifo prohibido        → error  (| ¦ [ ] { } ¡ !)
    si tiene espacios dobles o extremos → error
    si mide menos de 4 caracteres      → error

advertirDivergencias(pendientes) → advertencias[]
  agrupar asignaturas por `codigo` entre planes distintos
  si un mismo código aparece con nombres normalizados cuyo solape de tokens < 50 % → advertencia
```

**Normalización para comparar (RF-7):** minúsculas, sin acentos, sin puntuación, tokens de ≥ 2
caracteres. Sirve para comparar `Dibujo Técnico para la Comunicación Gráfica` contra `Uy` sin que
las mayúsculas ni las tildes disfracen la divergencia.

## 4. Decisiones (con la alternativa descartada)

- **D1 · El ruido se corta en dos sitios, con dos papeles.** `ocr.ts` lo descarta en origen
  (es una línea dibujada, no texto: no debe ni llegar al agrupado ni a la calibración de UV) y
  `parsear.ts` lo excluye al componer el nombre (compuerta que cubre también la capa de texto y
  cualquier fuente futura). *Descartado:* hacerlo solo en el parseo —el ruido seguiría entrando en
  el agrupado de filas y en las relecturas de UV—; y solo en el OCR —dejaría la capa de texto sin
  protección.
- **D2 · La corrección se identifica por el `id` de la asignatura** (el mismo estable de la spec
  002, que incluye sede, tipo, plan, slug de carrera, ciclo y código; las electivas llevan su
  orden). *Descartado:* `(carrera, código, ciclo)` porque no distingue dos electivas del mismo
  ciclo, de las que el propio anexo ya tiene dos dañadas; y `nombre`, que es precisamente el campo
  que cambia.
- **D3 · El registro es un JSON versionado y se inyecta en la generación**, como las fuentes.
  *Descartado:* constantes dentro de un `.ts` (no se auditan ni se diffan igual) y meterlo en
  `manifiesto.json` (el manifiesto documenta **de dónde salió** cada plan, no corrige su
  contenido).
- **D4 · El nombre vacío deja de lanzar en el parseo y pasa a bloquear en la validación.**
  `parsearItems` hoy lanza si el nombre queda vacío; con el filtro, `DPA919` (`| | |`) quedaría
  vacío y rompería la generación **antes** de que las correcciones pudieran arreglarlo. El parseo
  devuelve el nombre tal cual (normalizado) y `validar` decide, que es donde están la identidad de
  la carrera y el registro de correcciones. *Descartado:* aplicar correcciones dentro del
  parseo —no tiene la identidad de la carrera— y mantener el lanzamiento —impide RF-3.
- **D5 · El control de nombres bloquea por reglas objetivas, sin diccionario.** Cinco reglas
  verificables que miden **0 falsos positivos** sobre los 1.794 nombres reales: glifo prohibido
  (`| ¦ [ ] { } ¡ !`), vacío o menos de 4 caracteres, espacios dobles o en los extremos, **no
  empieza en mayúscula** (11 verdaderos positivos) y **el último token es preposición o conjunción
  suelta** (1). Las dos últimas entraron el 2026-10-08 con la ampliación del anexo A de 31 a 46
  casos (cambio de alcance aprobado con la spec). El daño de **palabra** (`parala`, `Aplicadaal`,
  `ición`, `Insdustriales`) no se detecta de forma fiable sin un diccionario: se resuelve por
  **curación** (los 21 casos se cotejan contra su documento) y queda vigilado por RF-7, que es lo
  único que descubre `Digital` y `parala`. El cotejo de T6 (2026-10-09) confirmó que esa vigilancia
  no basta: dejó al descubierto daño que las seis señales no pueden ver —6 casos del propio anexo A
  y ~15 más cruzando contra los gemelos presenciales—, que el usuario decidió dejar **fuera de
  alcance** y publicar en el anexo B de la spec. *Descartado:* un diccionario del español —frágil,
  pesado y con falsos positivos sobre siglas (`UV`, `DAW`, `Inglés A1`)—; y una regex ingenua de
  "termina en preposición" sobre el texto completo —**medida: 13 falsos positivos**, porque el `\b`
  de JavaScript es ASCII y una `ñ` rompe la frontera, de modo que `…Diseño` calzaba—, por eso la
  regla se construye sobre el **último token** (`(?:^|\s)(de|del|y|…)$`) y no sobre fin de cadena.
- **D6 · El saneado solo cambia `nombre`.** Ni código, UV, ciclo, prerrequisito, electiva,
  laboratorio ni `id` (RF-8); lo comprueba el diff de `data/planes.json` y un test de dataset.
- **D7 · Una corrección obsoleta bloquea** (caso límite 8): si su `id` ya no existe en el plan
  regenerado, la generación se detiene señalándola, en vez de ignorarla en silencio y publicar el
  nombre que el documento ya no respalda.

## 5. Estrategia de tests (`node --test`)

Primero en rojo, después en verde, una tarea cada vez.

| Dónde | Qué se prueba |
|---|---|
| `tests/extraccion.test.ts` | Ítems `|` de ancho 0,5–1,4 pt **no** aparecen en el nombre · un nombre que es todo ruido queda vacío y **no lanza** · el resto de campos (código, UV, prerrequisito, correlativo) no cambian |
| `tests/correcciones.test.ts` | Aplica por `id` y solo cambia `nombre` · no confunde dos electivas del mismo ciclo · `id` inexistente ⇒ error con la corrección exacta · el registro vacío no toca nada |
| `tests/validar.test.ts` | Cada una de las **5 reglas** bloqueantes por separado (vacío, glifo, longitud, espacios, sin mayúscula inicial, último token = preposición) ⇒ `publicable === false` con carrera, código y ciclo en el mensaje · símbolos legítimos (`&`, `°`, comas, paréntesis, dígitos, `Inglés A1`) y nombres que **sí** empiezan en mayúscula o terminan en sustantivo **no** bloquean · divergencia entre planes ⇒ advertencia, no error |
| `tests/lote.test.ts` | Generación con correcciones ⇒ el plan publicado lleva el nombre corregido y el manifiesto lo registra · corrección obsoleta ⇒ nada se escribe · dos corridas siguen produciendo el mismo byte (RF-12 intacto) |
| `tests/dataset.test.ts` | Sobre `data/planes.json` real: **0** nombres con glifos prohibidos, 0 vacíos, 0 con < 4 caracteres en las 59 carreras; los **31 ids del anexo A** publican exactamente su nombre saneado |

Cotejo manual (no automatizable): los 31 casos del anexo A contra su documento de origen, con el
nombre final listado en el reporte de generación (RF-6).

## 6. Riesgos

1. **Los nombres finales de las clases B y C salen de leer el documento**, no del código: hay que
   abrir el PDF/JPG de cada uno (para `DCG919`, `DPA919` y `DWM919` no existe plan hermano del
   que copiar). Mitigación: cotejo uno a uno, con el nombre citando su fuente.
2. **El filtro puede ser demasiado ancho**: descartar toda barra suelta eliminaría una barra
   legítima si alguna plantilla la usara como contenido. Mitigación: la regla es "solo `|`/`¦`",
   ninguna palabra española es una barra, y el test de las 59 carreras mide 0 pérdidas.
3. **La corrección se envejece** cuando la UDB publica un pensum nuevo. Mitigación: D7 la hace
   bloquear en lugar de ignorarse.
4. **El dataset publicado cambia**: `data/planes.json` llevará ~31 nombres distintos. Mitigación:
   RF-8 + el diff acotado a esos campos, revisado antes del commit.
5. **Observación fuera de alcance**: hay un nombre con artefacto tipográfico heredado de la fuente
   (`Oscilaciones, Fluidos y Calor .`) que el anexo no cubre y que las reglas del control no
   bloquean. Se deja fuera; si quieres incluirlo, se añade una regla de puntuación final suelta.

## 7. Orden de tareas (se detalla en `tasks.md`)

`depurarRuido` (OCR) → nombre sin ruido en el parseo → registro + `aplicarCorrecciones` →
control de nombres y divergencias → cableado en la generación + reporte/manifiesto → nombres finales
de las clases B y C cotejados contra el documento → regeneración y verificación del dataset →
regresión y cierre.
