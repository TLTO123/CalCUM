# Plan — Spec 002: Dataset completo de pensums

Estado: aprobado (2026-10-05)

Objetivo: generar `data/planes.json` con las 59 carreras de pregrado, validado contra el contrato
Zod existente, y que la app lo cargue en lugar de los fixtures.

## 1. Mapeo RF → piezas

| RF | Pieza responsable |
|---|---|
| RF-1, RF-7, RF-16 | `pipeline/manifiesto.json` (59 entradas) + `pipeline/generar.ts` |
| RF-2, RF-3 | `pipeline/validar.ts` (triangulación: sitio ↔ encabezado PDF ↔ suma de filas) |
| RF-4, RF-5, RF-6, RF-15 | `src/data/repositorio.ts` (`claveDePlan` con nombre) + tests de unicidad |
| RF-8, RF-9 | `pipeline/parsear.ts` (reconstrucción de filas por layout) |
| RF-10 | `pipeline/parsear.ts` (Bachillerato → vacío) + `pipeline/validar.ts` (huérfano → advertencia) |
| RF-11 | `pipeline/identificadores.ts` (ids derivados solo de campos estables) |
| RF-12, RNF-1 | `pipeline/generar.ts` (determinismo, `hoy` como parámetro; Node, sin Python) |
| RF-13 | `pipeline/validar.ts` (acumula errores y aborta antes de escribir) |
| RF-14, RNF-2 | `src/data/repositorio.ts` lee `data/planes.json` con `esquemaPlan` sin cambios |
| RNF-3, RNF-4 | `src/app` sin cambios de red; tamaño del bundle vigilado (§8) |
| RNF-5 | `pipeline/validar.ts` rechaza credenciales/personales en nombres de archivo |

## 2. Archivos y responsabilidades

**Nuevos (proceso de datos, no entra en el bundle de la app):**

| Archivo | Responsabilidad |
|---|---|
| `pipeline/manifiesto.json` | Tabla de las 59 carreras: nombre, sede, tipo, plan, modalidad, UV y nº de materias declarados por el sitio, URL del pensum y, si aplica, la carrera cuyo documento comparte |
| `pipeline/cargar.ts` | Lee el PDF (de `pipeline/fuentes/`, que solo se refresca con `--refresco` y red) y normaliza `http://` → `https://` |
| `pipeline/pdf.ts` | Único punto de contacto con pdfjs-dist: página 1 → items de texto con coordenadas (x, y) |
| `pipeline/parsear.ts` | **Función pura**: items + metadatos de la carrera → asignaturas crudas por ciclo |
| `pipeline/identificadores.ts` | **Función pura**: `sede:tipo:plan:slug(carrera):ciclo:código` estable entre regeneraciones (RF-11) |
| `pipeline/validar.ts` | **Función pura**: UV, conteo, prerrequisitos huérfanos, claves duplicadas → `{ errores[], advertencias[] }` |
| `pipeline/generar.ts` | Orquestador: manifiesto → planes[] + manifiesto publicado; aborta si hay errores (RF-13); escribe `data/` |
| `pipeline/npm-scripts.ts` | Comandos `npm run datos` (generar) y `npm run datos:refrescar` (descargar fuentes) |

**Modificados:**

| Archivo | Cambio |
|---|---|
| `src/data/repositorio.ts` | `claveDePlan` pasa a `(tipo, sede, plan, nombre)`; `planesIniciales()` lee `data/planes.json` |
| `tests/repositorio.test.ts` | Ajusta a la clave nueva + caso de homónimos con mismo tipo/sede/plan |
| `AGENTS.md` | Regla de clave única corregida (decisión D1, dentro del alcance) |
| `package.json` | `pdfjs-dist` en devDependencies + scripts de datos |

**Generados (artefactos, commiteados):** `data/planes.json` (contrato Zod, array) ·
`data/manifiesto.json` (URL de origen + fecha por plan, RF-16) ·
`docs/02-reporte-dataset.md` (totales por carrera, discrepancias y advertencias).

**Eliminados:** `src/data/fixtures/planes.json` → se muda a `tests/fixtures/planes-muestra.json`
para los tests unitarios del repositorio (evita meter datos duplicados en el bundle).

## 3. Funciones puras y determinismo

```ts
parsearItems(items, meta)              → { ciclos: CicloCrudo[], totales: { uv, materias } }
identificar(meta, codigo, ciclo, orden) → string estable
validar(planes, manifiesto)            → { errores: Error[], advertencias: string[] }
generarDataset(manifiesto, { hoy, fuentes })
                                        → { planes: Plan[], manifiestoPublicado, advertencias }
```

- `hoy` (fecha de extracción) entra como parámetro: **nunca** `new Date()` dentro de la lógica,
  así dos corridas con la misma entrada producen el mismo byte (RF-12).
- Sin acceso a red, reloj ni filesystem dentro de las funciones puras: la I/O vive en `cargar.ts`
  y `generar.ts`.

## 4. Algoritmo de extracción (pseudocódigo)

```
por cada entrada del manifiesto:
  bytes ← fuentes/<archivo>.pdf                 # sin red salvo con --refresco
  items ← pdfjs(página 1).textoConCoordenadas() # [{ str, x, y }]

  encabezado ← concatenar items con y > umbralSuperior
  uvEncabezado      ← /UNIDADES VALORATIVAS:\s*(\d+)/
  materiasEncabezado← /TOTAL DE MATERIAS A CURSAR:\s*(\d+)/

  títulos ← items donde str ≈ /^CICLO\s+([IVX]+)$/   → { ciclo, x, y }
  por cada título: región = { x ∈ [x, x+anchoColumna), y < y }
                   anchoColumna = distancia al siguiente título en x

  filas ← agrupar los items de la región por y (tolerancia ±3 pt)
  por cada fila, ordenar por x:
      código   ← token ≈ /^[A-Z]{2,4}\d{3}$/   | "- Electiva -" → electiva
      uv       ← token numérico en rango 1..10
      prerrequisito ← otro token ≈ /^[A-Z]{2,4}\d{3}$/ | "Bachillerato" → null
      nombre   ← resto, sin marcadores: '•' ⇒ laboratorio: true; '*' solo se estripa

  asignaturas ← por cada fila: id ← identificar(meta, código, ciclo, orden)

  errores ← validar(Σuv, conteo, claves) contra
            3 fuentes: sitio (manifiesto) ↔ encabezado (PDF) ↔ suma de filas
  si errores ≠ ∅ → abortar y publicar el reporte (RF-13)
  si advertencias ≠ ∅ → seguir y registrarlas (RF-10)
```

## 5. Interfaz

- **Entrada del proceso:** `pipeline/manifiesto.json` + `pipeline/fuentes/*.pdf`.
- **Salida:** `data/planes.json` (`Plan[]`, `esquemaPlan` **sin tocar**, RNF-2) y
  `data/manifiesto.json` (`{ carrera, sede, tipo, plan, origen: { url, fecha } }` por plan).
- **Consumo en la app:** `planesIniciales()` sigue exponiendo `Plan[]`; `claveDePlan` cambia de
  firma interna pero su tipo (`string`) no, así `montaje.tsx` y el store **no se modifican**.

## 6. Decisiones (con la alternativa descartada)

| # | Decisión | Descartada y por qué |
|---|---|---|
| D1 | **pdfjs-dist en Node** (devDependency, solo pipeline) | `pdfplumber`/PyMuPDF: Python no existe en el entorno (RNF-1). `pdf-parse`: devuelve texto lineal, que sale intercalado por columnas → datos incorrectos |
| D2 | **PDFs como fuente fija en `pipeline/fuentes/`** y descarga solo con `--refresco` | Descargar en cada corrida: no reproducible (RF-12) y atada a la red. Nada de PDFs en el repositorio obliga a red siempre |
| D3 | **Manifiesto curado** (59 URLs verificadas) | Descubrir los enlaces en cada corrida desde las fichas de carrera: frágil, requiere red y rompe la reproducibilidad |
| D4 | **Un solo `data/planes.json`** con el array que ya espera `cargarPlanes` | Un archivo por plan + glob: obligaría a cambiar el contrato y no funciona igual en Node y en Vite |
| D5 | **Triangulación de totales** (sitio ↔ encabezado ↔ suma de filas) | Confiar solo en el encabezado: la UDB puede publicar un PDF con el encabezado desactualizado y la suma correcta (o al revés) |
| D6 | **Fixtures movidas a `tests/`** | Mantenerlas en `src/`: datos muertos duplicados dentro del bundle |
| D7 | **`pdfjs-dist` en devDependencies** | En dependencies: los consumidores de la app no necesitan parsear PDFs |
| D8 | **Id = `sede:tipo:plan:slug:ciclo:código`** (electivas: `<ciclo>:electiva-<orden>`) | Usar índice de posición global: cambiaría si la UDB reordena el PDF y rompería las notas guardadas (RF-11). El **ciclo** se añadió el 2026-10-05 (aprobado por el usuario): el PDF oficial de la Lic. Administración usa `EDN902` en dos materias distintas y sin el segmento de ciclo colisionaban los ids |
| D9 | **Dataset importado estáticamente** | Carga diferida: obliga a estados de carga nuevos en toda la UI; se revisa solo si el tamaño lo exige (§8) |
| D10 | **Excepción RF-2 registrada en `EXCEPCIONES_RF2`** con clave, concepto, tripleta exacta y motivación; se publica la suma de la grilla (163 UV en Ingeniería Eléctrica) y va al reporte y al manifiesto (aprobada por el usuario el 2026-10-05) | Quedarse en 162 UV (contradice la grilla que alimenta el cálculo), excluir la carrera (rompe RF-1) o forzar una celda a 3 UV (inventa un dato, RF-14). Un *if* ad-hoc por carrera en el validador: indocumentado, imposible de auditar y no cubre el porqué |

## 7. Estrategia de tests (`node --test`)

| Test | Cubre | Caso |
|---|---|---|
| `tests/extraccion.test.ts` | RF-8, RF-9, RF-10, RNF-1 | Contra **2 PDFs reales** en `tests/fixtures/pensums/` (uno de `rebranding2024` y uno virtual): ΣUV, nº de materias, nº de ciclos, campos de una fila conocida |
| `tests/validar.test.ts` | RF-2, RF-3, RF-13, RF-10 | Dataset sintético: ΣUV descuadrada ⇒ error con los 3 valores; conteo descuadrado ⇒ error; prerrequisito huérfano ⇒ advertencia **sin** lanzar; Bachillerato ⇒ `null` |
| `tests/identificadores.test.ts` | RF-11 | Dos corridas sobre la misma entrada ⇒ mismos ids; id no contiene índices; electivas estables |
| `tests/dataset.test.ts` | RF-1, RF-4, RF-5, RF-14, RF-15 | `data/planes.json` existe, cumple `esquemaPlan`, tiene **59** planes, distribución 33/15/11, **0 claves duplicadas**, homónimos con UV distintos |
| `tests/manifiesto.test.ts` | RF-16 | 59 entradas, URLs `https://`, una fecha por plan |
| `tests/repositorio.test.ts` (ajustado) | RF-4, RF-15 | Clave con nombre: dos ingenierías del mismo plan/sede no colisionan; homónimos presencial/virtual tampoco |
| `tests/lote.test.ts` | RF-12 | `generarDataset` dos veces con `hoy` fija ⇒ JSON idéntico |

Criterio: **rojo → verde → marcar tarea → parar**, y los 46 tests existentes siguen en verde.

## 8. Riesgos y mitigaciones

1. **Plantillas de PDF distintas** (`rebranding2024`, `planes_2025`, `planes_2026`, legado):
   el parser se parametriza por familia; la validación obligatoria convierte cualquier fallo de
   layout en un error visible, nunca en datos malos (RF-13).
2. **Tamaño del bundle**: 59 planes ≈ 350 KB de JSON. Se vigila tras generar; si el arranque se
   degrada (RNF-4), se cambia a carga diferida (decisión D9, revisitable).
3. **Red solo al refrescar fuentes**: si la UDB cambia una URL, `--refresco` lo reporta y el
   dataset vigente sigue siendo válido.
4. **Sin usuarios previos**: cambiar la clave de carrera no requiere migración de
   `localStorage` (no hay notas en producción); queda anotado por si acaso.
5. **Trabajo estimado**: ~10 tareas; si al dividir supera las 10 con holgura, se propone partir
   la spec (extracción por un lado, publicación/carga por otro).
