# Tareas — Spec 004: Nombres de asignatura saneados en el dataset

Estado: **aprobadas** (2026-10-08)

Regla del proyecto: **una tarea a la vez**, en rojo → verde → marcar → parar, y preguntar antes de
pasar a la siguiente. Los RF citados existen en `spec.md`; las decisiones (D1–D7), en `plan.md`.

> **Ampliación de alcance (2026-10-08, aprobada por el usuario)**: al medir **seis señales**
> estructurales sobre los 1.794 nombres, el anexo A pasó de **31 a 46 casos**, RF-5 ganó dos
> reglas (`no empieza en mayúscula`, `último token = preposición`) y el cotejo de T6 pasó de 13 a
> **19 curaciones**. La spec, el plan y estas tareas ya están actualizados.

- [x] **T1. Descartar los glifos de tabla en el lector de imagen.** RF-2
  - Hecho cuando: `pipeline/ocr.ts` expone `depurarRuido(items) → items` y la llama `itemsDeImagen`
    antes del agrupado; en rojo primero y en verde después: un `|` de ancho 0,5 pt se descarta, una
    `¦` también, una `|` **dentro** de una palabra no se toca, y ningún otro ítem cambia. La suite
    completa (`node --test`) sigue en verde, incluidos los tests del OCR y de la relectura de UV.
  - ✅ 2026-10-08: **en verde**. `depurarRuido` es genérica (`T extends { str }`), se aplica al
    **cuerpo** y **después de `separarTitulos`** —el mismo `|` puede ser el romano `I` de un
    `Ciclo I` a trazos— y antes de `agruparPorColumna`. Rojo: `ERR_MODULE_NOT_FOUND` en todo el
    archivo → verde con 3 tests nuevos (barra de 0,5 pt y de 67,2 pt descartadas —la regla es
    textual, no geométrica—; `C++|C#`, `A|B` y `|A` intactos; orden y coordenadas sin cambiar).
    `node --test tests/extraccion.test.ts` → **23 pass** · suite completa → **167 pass / 0 fail** ·
    `tsc` → 0. **Efecto en la fuente real** (Lic. Diseño Gráfico, OCR de 90 s): los ítems que
    contienen `|` pasan de **66 a 3** (469 → 406 ítems) y el parseo ya no compone nombres con
    barras. Consecuencia prevista (caso límite 7): `DPA919` queda **sin nombre** y `parsearItems`
    lanza `La asignatura DPA919 del ciclo 9 salió sin nombre` — es justo lo que D4 mueve a la
    validación en la **T2**.

- [x] **T2. Componer el nombre sin ruido y normalizarlo.** RF-1
  - Hecho cuando: `parsear.ts` omite los ítems de ruido al componer el nombre, normaliza espacios y
    **deja de lanzar** cuando el nombre queda vacío (devuelve `''`, ver D4); en rojo primero: un
    documento sintético con `Diseño de` + `|` + `Contenidos Multimedia` publica
    `Diseño de Contenidos Multimedia`, uno cuyo nombre es todo ruido no lanza, y código, UV,
    prerrequisito y correlativo de esa fila salen intactos.
  - ✅ 2026-10-08: **en verde**. `saneadoNombre` (exportada) quita `•`, `*`, `|`, `¦`, colapsa
    espacios y recorta; la composición descarta los ítems que son solo barra; el `throw` de nombre
    vacío se eliminó (D4). Rojo: `ERR_MODULE_NOT_FOUND` → verde con **3 tests nuevos**; `extraccion`
    → **26 pass** · suite → **170 pass / 0 fail** · `tsc` → 0. Fuente real (Lic. Diseño Gráfico):
    **0 nombres con glifo** y los 2 vacíos (`DPA919`, `DWM919`) pasan como `''` sin lanzar.

- [x] **T3. Registro de correcciones curadas y su aplicación.** RF-3, RF-9
  - Hecho cuando: existen `pipeline/correcciones-nombres.json` y `pipeline/correcciones.ts` con
    `aplicarCorrecciones(plan, registro) → { plan, aplicadas[] }` pura; en rojo primero: la
    corrección cambia **solo** `nombre` por su `id`, dos electivas del mismo ciclo no se confunden,
    un `id` inexistente produce un error que nombra la corrección y su `id` (caso límite 8), y un
    registro vacío no toca nada.
  - ✅ 2026-10-08: **en verde**. `correcciones.ts` (pura, sin mutar el plan) + registro
    `correcciones-nombres.json` (`[]`, lo puebla T6) + `tests/correcciones.test.ts`. Rojo:
    `ERR_MODULE_NOT_FOUND` → verde con **7 tests**: cambia solo `nombre` y conserva `id`/`uv`/
    prerrequisito/`electiva`/`laboratorio` (RF-8) · el plan de entrada no se muta · registro vacío
    devuelve el plan **sin recopiarlo** · dos electivas del mismo ciclo (`electiva-1`/`electiva-2`)
    no se confunden (D2) · `id` inexistente → `huerfanas[razon=id-inexistente]` con la corrección
    completa y el plan intacto (caso límite 8) · el nombre de la corrección pasa por
    `saneadoNombre` (RF-1) · nombre que queda vacío → `nombre-invalido`, no se aplica · dos
    correcciones para el mismo id → `id-duplicado` y no se aplica ninguna. Suite →
    **177 pass / 0 fail** · `tsc` → 0.

- [x] **T4. Control de nombres bloqueante y advertencia de divergencia.** RF-4, RF-5, RF-7
  - Hecho cuando: `validar.ts` añade `revisarNombres` y `advertirDivergencias`; en rojo primero:
    cada una de las **5 reglas** por separado (vacío, glifo `| ¦ [ ] { } ¡ !`, menos de 4
    caracteres, espacios dobles o en los extremos, **no empieza en mayúscula**, **último token =
    preposición**) deja `publicable() === false` con carrera, código y ciclo en el mensaje; los
    nombres legítimos con `&`, `°`, comas, paréntesis, dígitos o `Inglés A1` **no** bloquean, ni
    tampoco uno que empieza en mayúscula y termina en sustantivo; y un mismo código con nombres muy
    distintos en dos planes genera advertencia, no error.
  - ✅ 2026-10-09: **en verde**. `revisarNombres(plan) → Error[]` enganchado en `validarPensum`
    (5 reglas: vacío/`<4`, glifo, dobles, extremos, sin mayúscula, último token = preposición) y
    `advertirDivergencias(pendientes) → string[]` enganchado en `validar` (mismo código entre
    planes con solape de palabras `< 50 %`; no compara dentro de un mismo plan ni los `-` de las
    electivas). Rojo: **8 fail** (7 reglas + RF-7) → verde con **10 tests nuevos**:
    `validar.test.ts` → **20 pass** · suite → **187 pass / 0 fail** · `tsc` → 0. Sobre los 59
    planes reales con el saneado de T1/T2: **17 rojos** (11 sin mayúscula, 2 glifos `[` y `¡`,
    2 vacíos `DPA919`/`DWM919`, 1 corto `Uy`, 1 preposición `Administración de`) y **4 avisos
    RF-7** (`GIC905`, `EFD905`, `DCG919`, `TIP919`), **0 falsos positivos**; el reuso de `EDN902`
    dentro de la misma carrera no avisa. Desviación mínima del plan: `revisarNombres` devuelve
    solo `Error[]` (el plan dibujaba `{errores, advertencias}`; RF-5 no tiene nivel advertencia).

- [x] **T5. Cablear el saneado en la generación y registrarlo.** RF-3, RF-6, RF-8
  - Hecho cuando: `generar.ts` aplica las correcciones entre identificar y validar, el registro de
    correcciones entra **inyectado** y se lee en `main` (como las fuentes), y el manifiesto y
    `docs/02-reporte-dataset.md` listan cada corrección aplicada con su asignatura y su fuente; en
    rojo primero: una generación de extremo a extremo publica el nombre corregido, una corrección
    obsoleta detiene todo y **no se escribe nada**, dos corridas con la misma entrada siguen
    produciendo el mismo byte (RF-12 intacto) y ningún campo distinto de `nombre` cambia (RF-8).
  - ✅ 2026-10-09: **en verde**. `EntradaGeneracion.correcciones` (obligatorio, como `fuentes`) y
    `OpcionesEjecucion.correcciones?` (default `[]`); `main` lee
    `pipeline/correcciones-nombres.json`. En `generarDataset`, tras identificar: el registro se
    **acota al plan por `prefijoDePlan(fila) + ':'`** (si no, una corrección de otra carrera
    parecería obsoleta), se aplica `aplicarCorrecciones` y cada `huerfana` se acumula como error
    con `[razon]`, id y fuente; además una corrección cuyo id no encaja con **ninguna** carrera
    del manifiesto también detiene (el otro lado del caso límite 8). RF-6: `CorreccionAplicada`
    (`codigo`, `ciclo`, `nombreAnterior`, `fuente`, `motivo`) en `manifiestoPublicado[].correcciones`
    (clave ausente si no hubo) y `DatasetGenerado.correcciones` con la carrera, más la sección
    **`## Correcciones curadas de nombres (RF-6)`** del reporte. Rojo: **4 fail** de 12 → verde
    **12/12** · suite → **191 pass / 0 fail** · `tsc` → 0. Corrida real `npm run datos`: **18
    errores y nada escrito** (17 del control con código y ciclo + 1 de contrato), `data/` y
    `docs/` intactos. Ajuste necesario: el contrato Zod del plan ya no **lanza** dentro del bucle
    sino que **se acumula y el plan sigue a validar** — si no, los 2 nombres vacíos se reportaban
    solo como `ciclos.8.asignaturas.0.nombre` y RF-4 exige carrera, código y ciclo.

- [x] **T6. Fijar los 21 nombres curables contra el documento de origen.** RF-3
  - Hecho cuando: los **21 casos** del anexo A —los 19 marcados `curar`, más `EFD905` del Técnico
    en Multimedia y `DCG919` del Técnico en Diseño Gráfico, los dos que solo descubre RF-7— tienen
    su nombre verificado **leyendo el PDF o el JPG de su propio pensum**, con la fuente citada en
    el registro (`fuente`) y el motivo (`motivo`); el registro queda versionado con esas 21
    entradas y ninguna otra; las 3 parejas sanas (`EDN902` ×2 y `TIP919` de la Licenciatura)
    quedan anotadas como cotejadas y confirmadas correctas; y el daño encontrado fuera de esas 21
    queda documentado en el **anexo B** de `spec.md`, fuera del registro.
  - ✅ 2026-10-09: **en verde**. El cotejo no fue una lectura de los 21 contra su fuente, sino un
    barrido que **corrigió el propio diagnóstico de la spec**, y el usuario fijó el alcance en tres
    decisiones (spec, «Dudas abiertas»):
    - **Los 19 ids del registro no existían**: el lector de plan de la spec 002 nombra el slug de
      la carrera con el `-a-distancia` (`licenciatura-en-diseno-grafico-a-distancia`), y el
      registro apuntaba a `licenciatura-en-diseno-grafico`. Los 19 apuntaban a **nadie**, lo que
      en T7 habría detenido la publicación entera con `id-inexistente`. Corregidos los 21.
    - **`EPI906` se cura `Ecoeficiencia de Procesos Industriales`**: la capa de texto del PDF solo
      trae `de Procesos Insdustriales`; `Ecoeficiencia` está dibujada como trazos. La errata
      `Insdustriales` está en el documento y aquí se corrige a mano — única excepción a «se
      transcribe, no se mejora», decidida por el usuario.
    - **El registro pasa de 19 a 21** con dos truncamientos por el borde de la celda que el
      control no ve (empiezan en mayúscula, sin glifos): `EFD905` de la Lic. en Ciencias de la
      Comunicación (`Edición de Fotografía` → `… Digital`) y `CMM909` de la Lic. en Marketing
      (`Canales y Métricas Digital` → `Canales y Métricas de Marketing Digital`). Ambos
      cotejados contra su JPG, no contra el gemelo.
    - **Los 23 «sanos» no eran 23**: la auditoría que pidió el usuario encontró **6 dañados**
      (anexo B.1). La más llamativa es la fila `-` del ciclo 3 de la Lic. en Diseño Gráfico, que
      el anexo A daba por resuelta y la propia spec describía mal como «dos nombres en una
      celda»: es un solo nombre leído en dos columnas, y el saneado no recupera el orden. El
      recorte leyó además un código (`CND919`) que el lector de página completa no ve; corregirlo
      sería tocar RF-8, así que solo se cura el nombre por su `id`.
    - El cruce contra los **gemelos presenciales** destapó ~15 daños más (anexo B.2) que ninguna
      señal estructural detecta: `MOC920` publica `; Empresarial`, `BEP920` publica `1 Producto`,
      `LME901` publica `Lenguajes de y Estilo Web`… El usuario decidió dejarlos **fuera de
      alcance** y documentarlos. `Sofware` (`DSM941`) y `Cálidad` (`GCS941`) son erratas del
      propio documento y se transcriben tal cual.
    - Verificación: los **21 ids existen** en `data/planes.json` y ninguno queda huérfano (script
      de contraste id↔dataset). La errata de codificación que corrompía `—` y `|` al escribir el
      registro desde pwsh se evitó escribiendo el JSON con la tool `write` en UTF-8.
    - Evidencia: recortes de celda + OCR (`spa`) de los 19 originales (log `_ocr_sanos.log`,
      `_gempos.log`), de las 2 ampliaciones y de las 2 filas sin código; los recortes se
      autoverifican por su código dentro de la propia imagen.
    - `node --test` → **191 pass / 0 fail** · `tsc` → 0.

- [x] **T7. Regenerar el dataset y verificar el resultado.** RF-1, RF-5, RF-8
  - Hecho cuando: `npm run datos` termina en verde con el control de nombres incluido; sobre
    `data/planes.json` real hay **0** nombres que incumplan alguna de las 5 reglas del control en
    las 59 carreras; los **40 ids del anexo A** que no están en `fuera` publican exactamente el
    estado que les asigna el anexo (16 saneados automáticamente, 21 con su corrección curada,
    3 parejas sanas intactas) — test en `tests/dataset.test.ts`—; los 6 de `fuera` siguen
    publicando su nombre dañado **sin que el control los bloquee**, porque pasan las 5 reglas
    (anexo B.1); y el diff de `data/planes.json` se revisa confirmando que **solo** cambian
    valores de `nombre`.

- [x] **T8. Regresión y cierre de la spec.** Criterios de finalización
  - Hecho cuando: `npm test` en verde (los existentes más los nuevos), `npm run typecheck` sin
    errores y `npm run build` sin crecer de forma desproporcionada; el checklist de cierre lleva la
    evidencia de RF-1 a RF-9, incluido el cotejo manual de las **21 curaciones** y de las 3 parejas
    sanas; el anexo B queda publicado como daño conocido y fuera de alcance; `spec.md` y `plan.md`
    pasan a `implementada`; `README.md` y `MEMORY.md` reflejan el cambio; commit y push.

## Checklist de cierre (T8 · 2026-10-11)

Evidencia de RF-1 a RF-9 sobre el dataset publicado (`data/planes.json`, comparado contra el de
`HEAD` con una comparación profunda campo por campo):

- **RF-1 (nombre saneado)** — el diff contra HEAD tiene **44 rutas cambiadas, las 44 `.nombre`,
  0 fuera de `nombre`**, y las 44 son ruido eliminado (p. ej. `| | Innovación y | Emprendimiento`
  → `Innovación y Emprendimiento`). El test `T7/RF-1` fija a su vez que los **16 sanos** y las
  **3 parejas** publican exactamente el nombre del anexo A.
- **RF-2 (glifos descartados antes de componer)** — `tests/extraccion.test.ts` (T1) prueba el
  descarte de ítems de tabla en el lector de imagen; su consecuencia medida en el diff: los 6
  `fuera` publican `Costos y de Presupuestos Negocios de Diseño` y no `Costos y de | Presupuestos…`.
- **RF-3 (corrección curada aplicada)** — `pipeline/correcciones-nombres.json` (21 entradas) se
  aplica por id, inyectada en `main` (D3). `npm run datos` aplicó **21** y ninguna quedó huérfana
  (una huérfana —id mal escrito o inexistente— detiene la publicación entera). El test `T7/RF-3`
  exige que los 21 ids publican exactamente su corrección y que el registro coincide id a id con
  el anexo A (los 19 marcados `curar` más `EFD905` y `DCG919` del Técnico, que solo veía RF-7).
- **RF-4 (nunca un nombre vacío)** — los 2 nombres destruidos por completo (`DPA919` y `DWM919`,
  que publicaban `| | |` y `| |`) tienen corrección curada; sin ella la publicación se detiene
  señalando carrera, código y ciclo (regla a del control, probada en `tests/validar.test.ts` T4).
- **RF-5 (control bloqueante de 5 reglas)** — sobre el dataset real: **0 infracciones** en las 59
  carreras (test `T7/RF-5`); el dataset anterior daba **42**. Las 5 reglas están probadas como
  bloqueantes y sin falsos positivos en `tests/validar.test.ts` (T4).
- **RF-6 (trazabilidad)** — `data/manifiesto.json` publica las **21 correcciones en 8 planes** con
  su `fuente` y su `motivo`, y `docs/02-reporte-dataset.md` las lista en su sección RF-6.
- **RF-7 (divergencia avisa, no bloquea)** — probado como advertencia en `tests/validar.test.ts`
  T4; tras las 21 correcciones el reporte publica **0 divergencias** (las parejas del anexo A
  quedaron resueltas) y ninguna divergencia bloqueó nunca la publicación.
- **RF-8 (solo cambia `nombre`)** — mismo número de carreras (59), mismos `id`, códigos, UV,
  ciclos, prerrequisitos y estructura: **44/44** rutas cambiadas son `.nombre`.
- **RF-9 (reproducibilidad)** — dos corridas consecutivas de `npm run datos` produjeron
  `data/planes.json` y `data/manifiesto.json` **idénticos byte a byte** (SHA-256 igual); el
  registro de correcciones vive versionado en el repositorio.

Cotejo manual (hecho en T6, con evidencia en las notas de T6):

- **Las 21 curaciones**: cada nombre se fijó contra el JPG/PDF del **propio** pensum, recortando
  la celda por coordenadas y leyéndola por separado con OCR (`spa`), con autoverificación del
  código dentro del recorte (logs `_ocr_sanos.log` y `_gempos.log`). Cada `motivo` del registro
  dice en qué carrera, ciclo y fila se cotejó.
- **Las 3 parejas sanas** — `EDN902` (ciclos 3 y 7 de Administración de Empresas) y `TIP919` de
  la Lic. en Diseño Gráfico: cotejadas igual (anexo A: «la pareja entera se coteja igual»); sus
  nombres publicados son completos y correctos y **no se tocaron**.
- **Anexo B** — los 6 dañados que quedan fuera (anexo B.1) y el daño adicional hallado contra los
  gemelos presenciales (B.2) quedan **publicados en la spec con su nombre real y su fuente, y
  fuera del alcance**: decisión del usuario del 2026-10-09.

Regresión (2026-10-11):

- `npm test` → **196 pass / 0 fail** (los 191 previos + los 5 nuevos de T7).
- `npm run typecheck` → 0 errores.
- `npm run build` → `index-*.js` 732,92 kB · **gzip 137,09 kB** (antes 137,19 kB: no crece).
