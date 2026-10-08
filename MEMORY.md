# MEMORY.md

Memoria del proyecto CalCUM UDB (máx ~50 líneas, actualizar al terminar cada tarea); lo que ya es
regla permanente se mueve a `AGENTS.md` (fórmula C.U.M, repitencia, alcance, sin backend…).

## Estado Actual

- Spec 001 **COMPLETA**; spec 002 **CERRADA** (`Estado: implementada`, 2026-10-07): T1–T10 ✅ y
  checklist de cierre en `tasks.md`. `npm run datos` publica **59 planes** + manifiesto +
  `docs/02-reporte-dataset.md` (0 discrepancias sin aprobar, 1 excepción D10, 39 advertencias
  RF-10); app arranca en 121 ms y verificada en navegador (3 carreras, cascada sin caminos
  vacíos, notas estables, consola limpia). `npm test` → **118 pass** · `tsc` 0 · `build` 134 kB.
- **Git**: `github.com:TLTO123/CalCUM`, `main`; `5b25559`/`282fee0` = spec 001, **`c0f9ce9` =
  spec 002** (T1–T10 + cierre, subido 2026-10-07). Decisión: los binarios **sí entran** (~58 MB
  de `pipeline/fuentes/` + `pipeline/tessdata/`) para que un clon limpio regenere el dataset y
  corra el OCR sin red (RF-12); ningún archivo supera 10 MB.
- Dev: `npx vite` (5173) · gancho `/?rf3=1` · `npm run datos[:refrescar]` · specs `001` y `002`
  cerradas. **SDD**: aprobación explícita por fase (P4), una tarea a la vez → rojo → verde →
  marcar → parar.

## Decisiones (y por qué)

- **Clave de carrera = `(tipo, sede, plan, nombre)`** (RF-4): sin el nombre colisionan 11 grupos
  (8 ingenierías de Soyapango en `plan-2024`). **Id** = `sede:tipo:plan:slug:carrera:ciclo:código`,
  electivas `electiva-<orden>` por ciclo (RF-11). Notas del fixture 001 quedan huérfanas sin
  migrar: sus ids no existen y migrarlas las reasignaría (RF-15 lo prohíbe).
- **`validar()` triangula sitio ↔ encabezado ↔ filas** con 0 errores exigidos (encabezado `null`
  ⇒ advertencia). **Excepción RF-2 única**: Ingeniería Eléctrica publica 163 UV (D10).
- **OCR (B²)**: sin rótulos de ciclo ⇒ `.jpg` del PDF + `itemsDeImagen` + `OPCIONES_OCR` =
  geometría virtual con **`fusionar: false`** (el fusor es para la capa de texto; con tesseract
  salía `PensamientoSocial Cristiano`). `cargarImagen` es I/O obligatoria en `EntradaGeneracion`.
- Fuentes fijas en `pipeline/fuentes/`, red solo con `--refresco`; parser por familia
  (`OPCIONES_VIRTUAL` texto / `OPCIONES_OCR` imagen). Selects Tipo → Sede · Carrera.

## Aprendizajes y errores a evitar

- La oferta se agrupa por **3 sedes** (la modalidad es un atributo); pensums infográficos ⇒
  **parseo por layout**, validando `ΣUV == UV publicada` y `conteo == publicado`.
- **Presencial**: totales en caja suelta x≈683/y≈191; región `rótulo−18`; hueco >1,6×mediana
  entre filas de código = fin de ciclo; la región se decide por el **centro** del ítem.
- **Virtual**: margen 45, código `[41,60]`, UV `[−55,−25]`, prereq `[4,52]` en fila propia, y
  correlativo **centrado** ⇒ `[-4,14.5]` (en 0 se perdía la Electiva I del ciclo V: 38 materias).
- **OCR**: el `4` de una UV es un glifo de 11 px ilegible en página ⇒ relectura con recorte
  **calibrado por las hermanas de su columna**; la etiqueta `UV` se lee 8–30 pt por debajo del
  valor ⇒ descartarla antes de calibrar.
- Prerrequisito publicado **como código**; `Bachillerato`/`-`/`**` ⇒ `null`; huérfano ⇒ advertencia
  no bloqueante (RF-10). `•` = laboratorio, `*` solo se estripa.
- pdfjs-dist **legacy** + `destroy()`; sin Python ⇒ Node 24 corre `.ts`; PowerShell con acentos
  rotos → volcar con el tool `read` o scripts Node.
- **Zustand v5**: selectores planos. `opencode.json` tiene un token en texto plano → nunca
  commitearlo. ⚠️ **41/198 nombres** con basura `|` o palabras perdidas (Diseño Gráfico virtual
  19/39): los conteos no dependen de ellos, sí RF-8.

## Próximos pasos

1. `README.md` está **vacío** (qué es, `npm run datos`, tests, fórmula, estructura).
2. Arreglo de **nombres OCR** (41/198; RF-8) a decisión del usuario.
3. **Spec 003** — exportar/compartir el resultado como PNG.
