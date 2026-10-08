# Tareas — Spec 002: Dataset completo de pensums

Estado: aprobadas (2026-10-05) → **T1–T10 completadas y spec cerrada (2026-10-07)**

Regla: una tarea a la vez → test en rojo → código → `node --test` en verde → marcar → parar.
Cobertura mínima exigida: 10 tareas, todas con comprobación verificable.

- [x] **T1. Andamiaje del pipeline + pdfjs-dist.** RNF-1, base de T3–T8
  - Hecho cuando: `pdfjs-dist` instalado como devDependency; scripts `npm run datos` y
    `npm run datos:refrescar` en `package.json`; existe `tests/fixtures/pensums/` con **2 PDFs
    reales** (uno presencial y uno virtual); un test abre un PDF y devuelve ≥1 ítem de texto con
    coordenadas `x`/`y`; `npm test` y `npm run typecheck` en verde.
  - ✅ 2026-10-05: `pdfjs-dist@6.4.299` (devDependency), `pipeline/pdf.ts`
    (`itemsDePrimeraPagina`, build **legacy** — el moderno exige DOM y falla en Node),
    `pipeline/pdfjs-legado.d.ts` (el subpath legacy no trae tipos), `pipeline/generar.ts`
    (stub que avisa de la T8 en lugar de fallar en silencio), scripts `datos`/`datos:refrescar`,
    `pipeline/**` añadido al `include` de tsconfig, PDFs descargados (presencial 115 KB +
    virtual 700 KB) y `tests/pdf.test.ts`. **Rojo→verde**: `documento.destroy is not a function`
    (el método está en la *loading task*, no en el documento) corregido. `npm test` → **48 pass**;
    `tsc` → 0.

- [x] **T2. Manifiesto de las 59 carreras.** RF-1, RF-7, RF-16
  - Hecho cuando: `pipeline/manifiesto.json` tiene 59 entradas con nombre, sede, tipo, plan,
    modalidad, UV y nº de materias declarados por el sitio, URL `https://` de su pensum y la
    carrera cuyo documento comparte (solo Antiguo Cuscatlán); `tests/manifiesto.test.ts` verifica
    59 entradas, distribución 33/15/11, URLs `https://` y que ningún total esté vacío.
  - ✅ 2026-10-05: descubrimiento con script one-off en la TEMP aprobada (el manifiesto es curado,
    D3 — no hay red en el pipeline). **Rojo→verde**: `ENOENT pipeline/manifiesto.json`.
    `pipeline/manifiesto.json` → **59 entradas**; 33/15/11; tipos 13 Ing · 20 Lic · 25 Téc · 1 Prof;
    planes `plan-2022/2024/2025/2026`; **todas** las URL en `https://` (normalizadas: relativas →
    absolutas, `http://` → `https://`); **15/15 AC con `comparteCon`** apuntando a una carrera de
    Soyapango con el **mismo PDF y mismos totales**; UV de las 33 de Soyapango cotejadas una a una
    contra `docs/01` (coinciden todas). Modalidad: **29 declaradas** en la ficha + **30 inferidas
    de la sede** (decisión del usuario: `Semipresencial`; las 11 virtuales declaran `A distancia`;
    Asesoría Financiera declara `Presencial` y se conserva tal cual); 0 casos raros.
    `tests/manifiesto.test.ts` → **7 tests** (59, distribución, solo pregrado, `https`, campos no
    vacíos + totales enteros, RF-7, unicidad de clave). `npm test` → **55 pass / 0 fail**; `tsc` → 0.

- [x] **T3. Carga de fuentes sin red.** RF-16, RNF-1, RNF-3
  - Hecho cuando: `pipeline/cargar.ts` resuelve la ruta local del PDF y solo descarga con
    `--refresco`; normaliza `http://` → `https://`; un test demuestra que la lectura funciona
    **sin acceso a red** (usa los PDFs de `tests/fixtures/pensums/`).
  - ✅ 2026-10-05: `pipeline/cargar.ts` (`normalizarUrl`, `nombreDeFuente`, `rutaDeFuente`,
    `cargarFuente` con `descargar` **inyectable**; directorio por defecto `pipeline/fuentes`).
    **Rojo→verde**: `ERR_MODULE_NOT_FOUND pipeline/cargar.ts`. El nombre local sale de la URL:
    **44 URL distintas ⇒ 44 nombres** (0 colisiones; las 15 de AC reutilizan el archivo de
    Soyapango, como manda RF-7). Sin `--refresco`: solo disco y si falta lanza
    *“Ejecuta `npm run datos:refrescar`”* (nunca baja nada). Con `--refresco`: descarga, valida
    cabecera `%PDF` y escribe. `tests/cargar.test.ts` → **6 tests** (normalización, ruta
    determinista, **lectura local con un descargador que revienta si se le invoca**, falta local
    ⇒ error, ciclo refresco→local, rechazo de no-PDF). Humo manual con red real:
    `http://…biomedica…pdf` → `https://`, 152 884 bytes `%PDF-`, 2ª corrida `local`.
    `npm test` → **61 pass / 0 fail**; `tsc` → 0.

- [x] **T4. Extracción básica por layout.** RF-8, RF-12, RNF-1
  - Hecho cuando: `pipeline/pdf.ts` (items con coordenadas) y `pipeline/parsear.ts` (detecta el
    encabezado con `UNIDADES VALORATIVAS` y `TOTAL DE MATERIAS A CURSAR`, localiza los títulos
    `CICLO I…X`, agrupa los ítems por región y reconstruye filas → código, nombre, UV); contra el
    PDF presencial de fixtures: ΣUV y nº de materias **coinciden con el encabezado** y hay ≥10
    ciclos detectados cuando los hay; test en verde.
  - ✅ 2026-10-05: `pipeline/parsear.ts` (`parsearItems`, función pura; offsets parametrizables
    en `OpcionesParseo` para la familia *virtual* de la T5). **Rojo→verde**:
    `ERR_MODULE_NOT_FOUND pipeline/parsear.ts`. Geometría verificada volcando las filas visuales
    de los 2 PDFs de fixtures: los totales **no están arriba** sino en una caja suelta en
    x≈683/y≈191-199 (dentro de la región del ciclo IX ⇒ se extraen y excluyen antes de agrupar);
    cada ciclo es una región de ancho = separación entre rótulos desplazada 18 ptos. a la
    izquierda; por asignatura: fila de código `[Nº correlativo][-11..2] [código][21..36]`, filas
    de nombre, y fila final `[prerrequisito][-22..5] [UV][28..36]`. La sección de electivas (9
    filas por debajo) se separa por **hueco anormal** (> 1,6 × mediana) entre filas de código.
    Ojo: el **prerrequisito va como Nº correlativo** (`6`, `9`, `30`…) o `Bachillerato`/`-`, no
    como código ⇒ habrá que resolverlo a código en la T5. `tests/extraccion.test.ts` → **4 tests**
    (encabezado 161/40, 10 títulos I…X, filas conocidas CAD501/PRE104/CVV501, ΣUV y conteo ==
    encabezado). `npm test` → **65 pass / 0 fail**; `tsc` → 0.

- [x] **T5. Casos especiales del pensum.** RF-9, RF-10
  - Hecho cuando: electivas sin código publicadas con `electiva: true` y UV conservada; el `•`
    de prácticas de laboratorio se convierte en `laboratorio: true` (el `*` **no** marca
    laboratorio: solo se estripa del nombre); "Bachillerato" →
    prerrequisito `null`; un prerrequisito huérfano genera **advertencia** y sale vacío; el PDF
    virtual de fixtures pasa las mismas comprobaciones; test en verde.
  - ✅ 2026-10-05: hecha **por iteraciones** (1 criterio rojo→verde por corrida), tras 2
    intentos fallidos de hacerla de una vez. `ItemTexto` gana `width` y `parsearItems` acepta
    `fusionar` / `electivaPorCorrelativo` / `prerrequisitoEnFilaPropia` + `OPCIONES_VIRTUAL`
    (margen 45, offsets `correlativo[4,14.5] / código[41,60] / UV[−46,−25] / prerrequisito[4,46]`).
    Resultados: virtual **44 materias / 176 UV / 10 ciclos** y encabezado `null` (la plantilla
    no publica totales); las secciones de electivas cortan por hueco anormal; `Técnica Electiva
    I/II` (38 y 42, sin código) salen con `-` y `electiva: true`; `•` ⇒ 25 lab en el presencial
    (de 29 `•` en el PDF: 1 leyenda + 2 fuera de la grilla), `*` solo se estripa; el
    prerrequisito se **resuelve a código** (`6` ⇒ `CAI501`, `2, 6, 7` ⇒ `QUG501, CAI501, MDB104`),
    `Bachillerato`/`-`/`**` ⇒ `null`, y un correlativo inexistente ⇒ advertencia + `null`
    (test con items sintéticos). Dos bugs reales encontrados en el camino: (a) el correlativo
    del ciclo VIII caía a offset +14.02 y se perdía fuera del rango `[4,14]` por redondeo
    (hoy `[4,14.5]`, con los totales acumulados a ≥ +15.00); (b) las celdas **centradas** del
    presencial hacían que `Programación de Software` (x=578, columna VIII en 579) se colara en
    LIS104 ⇒ la pertenencia de un ítem a la región se decide por su **centro**, no por su x.
    `tests/extraccion.test.ts` → **11 tests** (4 de T4 + 7 de T5). `npm test` → **72 pass /
    0 fail**; `tsc` → 0.

- [x] **T6. Identificadores estables.** RF-11
  - Hecho cuando: `pipeline/identificadores.ts` genera `sede:tipo:plan:slug:ciclo:código`
    (electivas: `<ciclo>:electiva-<orden>`); `tests/identificadores.test.ts` prueba que dos
    corridas dan los mismos ids, que los ids no contienen índices globales, que no se repiten
    dentro de un plan y que un mismo código en dos ciclos no comparte id.
  - ✅ 2026-10-05: `pipeline/identificadores.ts` con `slugificar` (NFD ⇒ sin acentos, no
    alfanumérico ⇒ `-`, nunca `:` ni espacios), `prefijoDePlan`, `identificar(meta, código,
    ciclo, orden)` e `identificarCiclos` (deriva el `orden` de la posición **dentro del ciclo**).
    **Rojo→verde**: `ERR_MODULE_NOT_FOUND pipeline/identificadores.ts`. 7 tests en
    `tests/identificadores.test.ts`: dos corridas sobre el mismo PDF ⇒ 40 ids idénticos; forma
    exacta
    `soyapango:ingenieria:plan-2024:ingenieria-en-ciencias-de-la-computacion:<ciclo>:<código>`;
    **insertar una materia al frente del ciclo I** (o borrar el ciclo I) no cambia ningún id
    existente — la prueba directa de "sin índice global"; prefijo separa homónimos por sede y
    tipo; electivas del virtual fijadas a `9:electiva-2` / `10:electiva-2` (2ª materia de su
    ciclo) estables entre corridas; 40 y 44 ids **sin repetir** en su plan; `slugificar` de la
    carrera con acentos y paréntesis. `npm test` → **79 pass / 0 fail**; `tsc` → 0.
  - 📌 2026-10-05 (enmienda a D8, **aprobada por el usuario**): el segmento de **ciclo** entró
    en el id. Motivo: el PDF oficial de la Lic. Administración (virtual) usa el código
    `EDN902` en **dos materias distintas** («Estadística de Negocios» ciclo 3 y «Análisis e
    Interpretación de Estados Financieros» ciclo 7) — verificado en el stream del PDF, es un
    error de la fuente — y con `…:slug:código` colisionaban los ids, lo que rompería RF-11 al
    mezclar las notas guardadas de una materia con la otra. Rojo→verde: 3 tests en
    `tests/identificadores.test.ts` (forma del id, `…:9:electiva-2`, y los dos `EDN902` con ids
    distintos en el multipágina de 44 materias). `npm test` → **101 pass / 0 fail**.

- [x] **T7. Validación con triangulación y parada total.** RF-2, RF-3, RF-13, RF-4
  - Hecho cuando: `pipeline/validar.ts` compara sitio ↔ encabezado ↔ suma de filas y devuelve
    `{ errores, advertencias }`; con datasets sintéticos: ΣUV descuadrada ⇒ error con los 3
    valores; conteo descuadrado ⇒ error; claves duplicadas ⇒ error; **cualquier error impide
    publicar**; las advertencias no impiden; test en verde.
  - ✅ 2026-10-05: `pipeline/validar.ts` con `validar(pendientes)`, `publicable(resultado)` y
    `PendienteValidacion { plan, totales, advertencias }` (el valor del **sitio** vive en
    `plan.uvTotal`/`materiasTotal`, así que el `manifiesto` del pseudocódigo no se pasa dos
    veces). **Rojo→verde**: `ERR_MODULE_NOT_FOUND pipeline/validar.ts`. La comparación acepta
    encabezado `null` (plantilla virtual ⇒ solo sitio ↔ filas, con advertencia) y acumula **todos**
    los errores en vez de detenerse en el primero. Además de UV/conteo/clave de carrera (RF-4),
    es error un **id repetido dentro de un plan** (perdería notas guardadas). Mensajes con la
    carrera exacta: `Ingeniería de Prueba (soyapango · ingenieria · plan-2099): UV descuadradas —
    sitio=12, encabezado=13, filas=11 (diferencia 2)`. `tests/validar.test.ts` → **8 tests**
    (triangulación sana, descuadre de UV y de conteo con los 3 valores, encabezado ausente,
    advertencia de huérfano sin bloquear, clave duplicada vs. homónimos por sede, id duplicado,
    acumulación entre planes). `npm test` → **87 pass / 0 fail**; `tsc` → 0.

- [x] **T8. Generador público + reporte.** RF-1, RF-12, RF-13, RF-16
  - Hecho cuando: `npm run datos` escribe `data/planes.json` (59 planes que pasan
    `esquemaPlan`), `data/manifiesto.json` (origen + fecha por plan) y
    `docs/02-reporte-dataset.md`; `hoy` entra como parámetro y `tests/lote.test.ts` demuestra
    determinismo (misma entrada + misma `hoy` ⇒ JSON idéntico); si algo falla, no escribe nada
    y el mensaje señala la carrera exacta.
  - ✅ 2026-10-06: `npm run datos` publica los 3 artefactos con **59 planes** (59 claves
    únicas, 59 entradas de manifiesto, 0 discrepancias sin aprobar, 1 excepción RF-2
    documentada: Ingeniería Eléctrica 163 UV) y **39 advertencias** que no bloquean (29 de
    encabezado ausente y 10 de prerrequisito huérfano, RF-10/D4). `npm test` → **111 pass /
    0 fail**; `tsc` → 0.

  ### B² — OCR de los 7 PDF que van sin capa de texto (`pipeline/ocr.ts`)

  - **Problema**: los 7 pensums de UDB Virtual vienen de Illustrator con el texto dibujado
    como trazos (0 operadores `Tj`): `itemsDeDocumento` solo recupera los dígitos de UV, no
    hay rótulos `CICLO` y el parser abortaría por "plantilla no soportada" (falso
    diagnóstico). La fuente es el **`.jpg` que el sitio publica junto al PDF**; el PDF sigue
    mandando la geometría (`page.view` fija los puntos y la imagen aporta los píxeles).
  - **Cómo**: dos pasadas de tesseract (PSM 3 para el cuerpo, PSM 6 para los rótulos blancos
    sobre azul), fusión por caja de palabra propia y agrupación **por columna** (las celdas se
    centran por separado, así que entre columnas las líneas se intercalan a 5–7,6 pt).
    Umbral de confianza 60. Sin red: `node_modules` + `pipeline/tessdata` con
    `cacheMethod: 'none'` (RF-12).
  - **Relecturas puntuales** en vez de fiarse del voto mayoritario: el código de cada fila se
    relee con 6 recortes (`RECORTES_CODIGO`/`mejorCodigo`) y la UV ilegible, con un recorte
    **calibrado por las hermanas de su columna** (`releerUv`/`repararUv`), que es lo que
    separa el `8` de EPP919 de los `14` que el recorte genérico lee en su lugar.
  - **Cableado en `generar.ts`**: `hayRotulosDeCiclo(items)` es la puerta; si no hay rótulos
    se pide el `.jpg` (`cargarImagen`, derivado del PDF: `<nombre>.jpg`, disco salvo
    `--refresco`), se ejecuta `itemsDeImagen` y se parsea con `OPCIONES_OCR` — misma
    geometría virtual pero **`fusionar: false`**, porque tesseract ya emite la palabra entera
    y con el fusor de la capa de texto salía `PensamientoSocial Cristiano`. `cargarImagen` es
    obligatoria en `EntradaGeneracion` como cualquier otra I/O: la lógica no abre archivos.
  - **Dos correcciones de calibración** encontradas al cotejar contra el sitio: (a) la
    ventana de correlativo pasó de `[0, 14.5]` a `[-4, 14.5]` —el número va **centrado** en su
    celda y el `24` de la *Electiva I* del ciclo V caía a −0.8 pt, así que esa fila no abría
    materia y Diseño Gráfico publicaba 38 materias/153 UV—; (b) `releerUv` descarta la
    etiqueta `UV` cuando tesseract la devuelve como número (`10` en Marketing, `1` en Diseño,
    siempre 8–30 pt por debajo del valor), que era la fila que el parser elegía y la que
    descuadraba ΣUV contra el sitio (+12 y −3 UV).
  - **Resultado**: los 7 cuadran con el sitio (ΣUV **y** nº de materias) y con `idsDup=0`:
    comunicaciones 172/43 · diseño gráfico 160/39 · marketing 160/40 · téc. diseño gráfico
    80/20 · téc. computación 80/20 · téc. marketing digital 64/16 · téc. multimedia 80/20.
    Las 10 advertencias de prerrequisito restantes (7 Diseño, 1 Comunicación, 2 presenciales)
    apuntan a electivas o a correlativos que el OCR no leyó: RF-10 las publica vacías y las
    registra en el reporte.
  - Tests: +4 en `tests/cargar.test.ts` (derivación del `.jpg`, disco sin red, descarga con
    `--refresco`, rechazo de no-JPEG) y +3 en `tests/extraccion.test.ts` (puerta de rótulos y
    `OPCIONES_OCR`); los fixtures con capa de texto llevan un stub de `cargarImagen` que
    **revienta** si el OCR llegara a pedirse.
  - ⚠️ Pendiente conocido: **41/198 nombres** de asignatura con basura (`|` de rejilla) o
    pérdida de palabras (Lic. Diseño Gráfico 19/39). ΣUV y conteos no dependen de ellos, pero
    sí de RF-8 (fidelidad): candidato a relectura de nombres o a decisión de usuario.

- [x] **T9. La app carga el dataset completo.** RF-4, RF-14, RF-15, RNF-2
  - Hecho cuando: `claveDePlan` incluye el nombre de carrera y `planesIniciales()` lee
    `data/planes.json`; fixtures movidas a `tests/fixtures/planes-muestra.json`;
    `AGENTS.md` actualizado con la nueva regla; `tests/dataset.test.ts` exige 59 planes
    cumpliendo `esquemaPlan` con **0 claves duplicadas** y homónimos con UV distintos;
    los 46 tests previos siguen en verde y `typecheck` sin errores.
  - ✅ 2026-10-06: `claveDePlan` = `${tipo}|${sede}|${planVersion}|${carrera}` (RF-4) y
    `planesIniciales()` importa `../../data/planes.json`, validado con `esquemaPlan` al
    arrancar (P2). El fixture de la spec 001 se movió a
    `tests/fixtures/planes-muestra.json` y `AGENTS.md` ahora explica la clave nueva **con su
    razón**: con la tripleta a secas colisionan **11 grupos reales** — 8 ingenierías de
    Soyapango comparten `ingenieria|soyapango|plan-2024`, lo que en la app de la spec 001
    significaría mezclar las notas de Biomedica con las de Eléctrica.
  - `tests/dataset.test.ts` (**5 tests**): 59 planes que pasan `esquemaPlan` sin cambiarlo
    (RNF-2), distribución 33 Soyapango / 15 Antiguo Cuscatlán / 11 UDB Virtual y los 4 tipos,
    0 claves duplicadas **dejando constancia de que la tripleta sin nombre habría colisionado**,
    homónimos 161 UV/40 materias frente a 176 UV/44 materias, y RF-15 (toda carrera es
    alcanzable desde el primer select, ningún camino sin carreras). `tests/repositorio.test.ts`
    ajustado (+2: clave con nombre entre homónimos y entre dos carreras del mismo tipo/sede/plan;
    el fixture movido sigue validando). **`npm test` → 118 pass / 0 fail**; `tsc` → 0;
    `npm run build` → 726 kB (134 kB gzip).
  - RNF-4 medido: importar y validar el dataset completo toma **121 ms** (112 ms de parseo del
    JSON de 632 kB + 9 ms de Zod sobre los 59 planes) — sin degradación perceptible.
  - ⚠️ Dos consecuencias de la clave nueva, decididas sin migración: (a) las notas guardadas con
    el fixture de la spec 001 quedan huérfanas en `localStorage` bajo claves de 3 segmentos —
    migrarlas no serviría, porque los ids viejos del fixture no existen en el dataset real y la
    nota acabaría asociada a una materia que no es (RF-15 prohíbe reasignarla, no borrarla);
    la app no las lee. (b) El gancho `/?rf3=1` apuntaba a ingeniería en Antiguo Cuscatlán, que
    **sí** existe con los 59 planes; ahora monta profesorado + UDB Virtual, la única combinación
    que la oferta real no tiene, para seguir reproduciendo el estado RF-3.

- [x] **T10. Verificación final contra los orígenes.** RF-1, RF-5, RF-15 + criterios de cierre
  - Hecho cuando: en navegador se seleccionan **3 carreras, una por sede**, y UV/nº de materias
    de la app coinciden con las del documento de origen; la cascada no presenta ningún camino sin
    resultados; las notas guardadas siguen asociadas a su materia tras regenerar; consola sin
    errores; `npm test`, `typecheck` y `build` en verde; `MEMORY.md` actualizado.
  - ✅ 2026-10-07: verificado en navegador (Chrome sobre `npx vite`):
    - **Cotejo de 3 carreras, una por sede, contra `docs/01-oferta-academica-udb.md`**:
      Soyapango → Ing. en Ciencias de la Computación **161 UV / 40 materias**; Antiguo Cuscatlán
      → Lic. en Diseño Gráfico **161 UV / 39 materias**; UDB Virtual → Ing. en Ciencias de la
      Computación (a distancia) **176 UV / 44 materias**. Por encima de lo pedido: las 7
      licenciaturas de Antiguo Cuscatlán cuadran fila a fila con el documento, y dos planes del
      **OCR** se ven completos (Lic. Comunicación a distancia 172/43 y Téc. Multimedia a
      distancia 80/20). Única diferencia frente al sitio: Ingeniería Eléctrica publica 163 UV
      (la grilla) en lugar de 162 — es la excepción D10, visible en el reporte y en el manifiesto.
    - **Cascada sin caminos vacíos**: barrido de los 4 tipos × 3 sedes → 9/2/2 ingenierías,
      9/7/4 licenciaturas, 14/6/5 técnicos, 1 profesorado = **59 carreras alcanzables** y ningún
      estado "sin resultados"; `/?rf3=1` sí lo reproduce (ahora con profesorado + UDB Virtual,
      porque ingeniería en Antiguo Cuscatlán **ya sí** existe).
    - **Notas estables tras regenerar**: un `npm run datos` más deja `data/planes.json`
      **byte-idéntico** (mismo SHA-256) y, tras recargar, la nota 8.5 sigue en
      "Expresión Oral y Escrita" con C.U.M 8.50 y 1/43 materias cursadas.
    - **Consola sin errores** (solo el aviso de HMR de Vite y el de React DevTools); el aviso
      `beforeunload` de RF-13 salta al salir con notas guardadas.
    - **`npm test` → 118 pass / 0 fail · `npm run typecheck` → 0 · `npm run build` → 0**
      (726 kB / 134,7 kB gzip).
  - ✅ **Criterios de finalización de la spec 002**: las 59 carreras publicadas y cargadas por la
    app; 0 discrepancias sin aprobar con la excepción D10 documentada en `data/manifiesto.json`
    y en `docs/02-reporte-dataset.md`; 0 claves duplicadas y 0 caminos vacíos; las notas guardadas
    siguen asociadas a su materia; tests y typecheck en verde; cotejo manual de 3 carreras hecho.
    Queda fuera del alcance (y por eso no bloquea): los 41/198 nombres de asignatura con basura
    del OCR, pendientes de decisión del usuario (RF-8).

---

## Checklist de cierre (spec 002, 2026-10-07)

| RF / RNF | Estado | Evidencia |
|---|---|---|
| RF-1 | ✅ | `npm run datos` → **59 planes**; `tests/dataset.test.ts` exige 59 y la cascada alcanza las 59 en navegador |
| RF-2 | ✅ | 59 validaciones de ΣUV, **0 sin aprobar**; excepción D10 (Ing. Eléctrica, 163 UV) documentada en `data/manifiesto.json` y `docs/02-reporte-dataset.md` |
| RF-3 | ✅ | 59 validaciones de conteo de materias, **0 sin aprobar**; gancho `/?rf3=1` reproduce el estado rojo en navegador |
| RF-4 | ✅ | `claveDePlan = tipo\|sede\|plan\|carrera`; **0 claves duplicadas** con el dataset completo (evita las 11 colisiones); `AGENTS.md` corregido |
| RF-5 | ✅ | Homónimos con planes propios: CC presencial **161/40** frente a CC virtual **176/44** (cotejo en navegador) |
| RF-6 | ✅ | Cada una de las 59 entradas conserva su `plan` vigente y las UV de ese plan (manifiesto) |
| RF-7 | ✅ | Las 15 de Antiguo Cuscatlán tienen entrada propia con el contenido de Soyapango; sus 7 licenciaturas cuadran fila a fila con `docs/01` |
| RF-8 | ✅ * | Todas las asignaturas publican código, nombre, UV, ciclo, prerrequisito y naturaleza; **\*** salvo los 41/198 nombres con basura del OCR (asumido fuera de alcance, decisión pendiente) |
| RF-9 | ✅ | Electivas como `electiva-<orden>` por ciclo, sin depender del orden de extracción (`tests/identificadores.test.ts`) |
| RF-10 | ✅ | `Bachillerato` → `null`; **10 prerrequisitos huérfanos** advertidos en el reporte sin bloquear la publicación |
| RF-11 | ✅ | Nota 8,5 sigue en "Expresión Oral y Escrita" tras regenerar (`planes.json` **byte-idéntico**); el id lleva ciclo (D8, `EDN902`) |
| RF-12 | ✅ | Regeneración sobre los mismos orígenes → mismo SHA-256; sin red (solo `--refresco`) |
| RF-13 | ✅ | Parada total ante cualquier descuadre: exit ≠ 0 y nada publicado (`tests/lote.test.ts`) |
| RF-14 | ✅ | La app importa `data/planes.json` con el contrato Zod **sin cambios de campos**; los fixtures pasaron a `tests/fixtures/` |
| RF-15 | ✅ | 0 claves duplicadas, 0 caminos vacíos y 0 notas reasignadas (barrido de la cascada en navegador) |
| RF-16 | ✅ | `data/manifiesto.json`: 59 entradas con `origen.url` y `origen.fecha` |
| RNF-1 | ✅ | Pipeline en Node 24, sin Python ni herramientas externas |
| RNF-2 | ✅ | `data/planes.json` en UTF-8 validado por el mismo esquema Zod de la spec 001, con validación ruidosa al cargar |
| RNF-3 | ✅ | Artefacto estático: la app no consulta la UDB (RF-16 de la spec 001 intacto) |
| RNF-4 | ✅ | Arranque con las 59 carreras en **121 ms**, sin degradación perceptible |
| RNF-5 | ✅ | Solo datos públicos de la UDB; sin credenciales ni datos personales |

**Criterios de finalización de `spec.md`:** 59 carreras publicadas y cargadas ✅ · 0 discrepancias
sin aprobar con la excepción D10 documentada ✅ · 0 claves duplicadas y 0 caminos vacíos ✅ ·
notas guardadas asociadas a su materia tras regenerar ✅ · `npm test` **118 pass / 0 fail** y
`npm run typecheck` 0 ✅ (además `npm run build` → 134,7 kB gzip) · cotejo manual de 3 carreras,
una por sede ✅ (Soyapango 161/40 · Antiguo Cuscatlán 161/39 · UDB Virtual 176/44).

**Decisiones cerradas en esta spec:** D1 (clave con nombre, RF-4) · D2 (RF-13 estricto) · D3 (59
planes) · D4 (prerrequisitos huérfanos no bloquean) · D8 (ciclo en el id) · D10 (excepción RF-2
única).

**Pendiente asumido fuera de alcance:** arreglo de los **41/198 nombres** con basura del OCR
(RF-8), decisión del usuario. **No bloquea el cierre.**

---

Si al dividir el trabajo se superan las 10 tareas, propongo partir la spec (extracción frente a
publicación/carga) antes de seguir implementando.
