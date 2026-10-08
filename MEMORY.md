# MEMORY.md

Memoria del proyecto CalCUM UDB (máx ~50 líneas, actualizar al terminar cada tarea); lo que ya es
regla permanente se mueve a `AGENTS.md` (fórmula C.U.M, repitencia, alcance, sin backend…).

## Estado Actual

- Specs 001 y 002 **CERRADAS**; **spec 003 "Exportar y compartir el resultado como PNG" CERRADA**
  (`Estado: implementada`, 2026-10-07): T1–T8 ✅ con checklist de cierre por RF/RNF en `tasks.md`.
  Exporta y comparte desde el panel con `canvas` y **cero dependencias**: 3 cotejos PNG ↔ pantalla,
  Offline con **0 peticiones**, 80–87 kB, 65–96 ms, fallback a descarga y cancelar sin descargar.
  `npm test` → **151 pass / 0 fail** · `tsc` 0 · `build` **136,75 kB gzip** (+2,05 sobre 134,7).
- **Git**: `github.com:TLTO123/CalCUM`, `main`; `5b25559`/`282fee0` = spec 001, `c0f9ce9` = spec 002.
  **La spec 003 y sus cambios de `src/`, `tests/`, `README.md` y `MEMORY.md` siguen sin commitear**
  → subirlos con `/update-repo` al confirmar el cierre. Binarios de `pipeline/` sí van versionados
  (~58 MB, para regenerar el dataset sin red); ningún archivo supera 10 MB.
- Dev: `npx vite` (5173) · `npm run datos[:refrescar]` · **SDD**: aprobación explícita por fase (P4)
  y una tarea a la vez → rojo → verde → marcar → parar. `README.md` documenta la exportación.

## Decisiones (y por qué)

- **Clave de carrera = `(tipo, sede, plan, nombre)`** (RF-4): sin el nombre colisionan 11 grupos
  (8 ingenierías de Soyapango en `plan-2024`). **Id** = `sede:tipo:plan:slug:carrera:ciclo:código`,
  electivas `electiva-<orden>` por ciclo (RF-11). Notas del fixture 001 quedan huérfanas sin migrar.
- **Spec 003 (D1–D13)**: la tarjeta es **solo el panel** (D1); **una única acción** que comparte y,
  sin soporte, descarga (D2); `canvas` a mano, sin librerías (D3); **cancelar el compartir NO
  descarga** (D4, corrige el RF-3); **tema claro fijo** (D5); lógica pura en `domain/`, DOM en
  `export/` (D6); lienzo 720×440 rasterizado ×2 (D8); botón deshabilitado con el motivo visible
  (D9); `canShare` antes de `share` (D10); nombre `calcum-<slug>-<aaaa-mm-dd>.png` (D11).
- **`validar()` triangula sitio ↔ encabezado ↔ filas** con 0 errores exigidos. **Excepción RF-2
  única**: Ingeniería Eléctrica publica 163 UV (D10).
- **OCR (B²)**: sin rótulos de ciclo ⇒ `.jpg` + `itemsDeImagen` + `OPCIONES_OCR` con
  `fusionar: false`. Fuentes fijas en `pipeline/fuentes/`, red solo con `--refresco`.

## Aprendizajes y errores a evitar

- La oferta se agrupa por **3 sedes**; pensums infográficos ⇒ **parseo por layout**, validando
  `ΣUV == UV publicada` y `conteo == publicado`.
- **Presencial**: totales x≈683/y≈191; región `rótulo−18`; hueco >1,6×mediana = fin de ciclo;
  región por **centro** del ítem. **Virtual**: margen 45, código `[41,60]`, UV `[−55,−25]`,
  prereq en fila propia y correlativo **centrado** `[-4,14.5]`.
- **OCR**: relectura del glifo de UV **calibrada por las hermanas de su columna**; descartar la
  etiqueta `UV` antes de calibrar. Prerrequisito como código; `Bachillerato`/`-`/`**` ⇒ `null`.
- **`toBlob` en Chrome automatizado**: solo la primera codificación por carga es rápida (~70 ms);
  las siguientes el navegador las retiene ~1,03 s (`toDataURL` 27 ms, `setTimeout(0)` 0 ms ⇒ no es
  la app). Medir tras recargar.
- Los **`window.confirm`** (`montaje.tsx:64`, cambio de carrera) se abren **entre** llamadas y
  contaminan la automatización: resolverlos antes de seguir. Con la red caída `navigator.share()`
  queda pendiente hasta volver (comportamiento del navegador; la app no hace peticiones).
- **Zustand v5**: selectores planos. pdfjs-dist legacy + `destroy()`; sin Python ⇒ Node 24 corre
  `.ts`. `opencode.json` tiene un token en texto plano → **nunca commitearlo**. ⚠️ **41/198
  nombres** con basura `|` o palabras perdidas (Diseño Gráfico virtual 19/39): afecta a RF-8.

## Próximos pasos

1. **Commit de la spec 003** con `/update-repo` (`specs/003-exportar-png/`, `src/`, `tests/`,
   `README.md`, `MEMORY.md`) tras la aprobación del usuario.
2. Arreglo de **nombres OCR** (41/198; RF-8) a decisión del usuario.
