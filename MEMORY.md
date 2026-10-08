# MEMORY.md

Memoria del proyecto CalCUM UDB (máx ~50 líneas, actualizar al terminar cada tarea); lo que ya es
regla permanente se mueve a `AGENTS.md` (fórmula C.U.M, repitencia, alcance, sin backend…).

## Estado Actual

- Specs 001, 002 y **003 CERRADAS**: 003 cerró con T1–T8 (2026-10-07) y con el **cambio D6/D11**
  (T9–T12, 2026-10-08) — el compartido que **falla sin abrir ningún diálogo ahora descarga** a los
  5 s (antes: 30 018 ms esperando y "cancelado" **sin imagen**). `npm test` → **163 pass / 0 fail**
  · `tsc` 0 · `build` **137,19 kB gzip** (+0,44 sobre 136,75; límite 5 kB). Verificado en navegador
  con 4 escenarios: fallo real · cancelación con foco robado · rechazo instantáneo · foco robado
  mensaje sin "cancel" (la señal de foco llega). Consola 0 errores; red solo local.
- **Git**: `github.com:TLTO123/CalCUM`, `main`; `5b25559`/`282fee0` = spec 001, `c0f9ce9` = spec 002,
  `d8d4081` = spec 003 (T1–T8), **`565ba72` = RF-11/D6** (specs + src + tests, 9 archivos, +658).
  Binarios de `pipeline/` (~58 MB); ningún archivo > 10 MB; `opencode.json` ignorado (token).
- Dev: `npx vite` (5173) · `npm run datos[:refrescar]` · **SDD**: aprobación explícita por fase (P4)
  y una tarea a la vez → rojo → verde → marcar → parar.

## Decisiones (y por qué)

- **Clave de carrera = `(tipo, sede, plan, nombre)`** (RF-4): sin el nombre colisionan 11 grupos
  (8 ingenierías de Soyapango en `plan-2024`). **Id** = `sede:tipo:plan:slug:carrera:ciclo:código`,
  electivas `electiva-<orden>` por ciclo (RF-11 de la spec 001). Fixture 001 queda huérfano sin migrar.
- **Spec 003 (D1–D5)**: tarjeta = **solo el panel** (D1); **una única acción** que comparte y, sin
  soporte, descarga (D2); `canvas` a mano, sin librerías (D3); **cancelar NO descarga** (D4); tema
  claro fijo (D5). **D6 (2026-10-07)**: un `AbortError` no alcanza para decidir ⇒ **fallo sin
  diálogo descarga**; solo una cancelación real no descarga (RF-11). Ojo: el **plan** tiene su
  numeración propia — su **D6** es "DOM en `export/`".
- **Plan 003 (D6–D16)**: lógica pura en `domain/`, DOM en `export/`; lienzo 720×440 rasterizado ×2
  (D8); botón deshabilitado con el motivo visible (D9); `canShare` antes de `share` (D10); nombre
  `calcum-<slug>-<fecha>.png` (D11); **D14** dos señales para distinguir fallo de cancelación
  (foco/visibilidad + tiempo/mensaje), **D15** plazo de 5 s sin diálogo ⇒ descarga, **D16**
  vigilante en `src/export/hoja.ts` con `window`/`document` inyectados.
- **`validar()` triangula sitio ↔ encabezado ↔ filas** con 0 errores exigidos. **Excepción RF-2
  única**: Ingeniería Eléctrica publica 163 UV (D10).
- **OCR (B²)**: sin rótulos de ciclo ⇒ `.jpg` + `itemsDeImagen` + `OPCIONES_OCR` con `fusionar: false`.
  Fuentes fijas en `pipeline/fuentes/`, red solo con `--refresco`.

## Aprendizajes y errores a evitar

- **`AbortError` de `share()` es ambiguo**: significa "el usuario canceló" **y** "no pude compartir"
  (Chrome/Windows devolvió `Share failed` a los 30 s sin abrir nada). Nunca clasificar solo por el
  texto del error: medir además si la pestaña perdió el foco y cuánto tardó el rechazo.
- La oferta se agrupa por **3 sedes**; pensums infográficos ⇒ **parseo por layout**, validando
  `ΣUV == UV publicada` y `conteo == publicado`.
- **Presencial**: totales x≈683/y≈191; región `rótulo−18`; hueco >1,6×mediana = fin de ciclo.
  **Virtual**: margen 45, código `[41,60]`, UV `[−55,−25]`, correlativo centrado `[-4,14.5]`.
- **OCR**: relectura del glifo UV **calibrada por las hermanas de su columna**; descartar la etiqueta
  `UV`. Prerrequisito como código; `Bachillerato`/`-`/`**` ⇒ `null`.
- **`toBlob` en Chrome automatizado**: solo la primera codificación por carga es rápida (~70 ms); las
  siguientes el navegador las retiene ~1,03 s. Medir tras recargar.
- **`window.confirm`** (`montaje.tsx:64`) se abre entre llamadas y contamina la automatización;
  `navigator.share()` con la red caída queda pendiente (comportamiento del navegador).
- **Un test nuevo con promesa pendiente se cuelga en rojo**: correr esa fase con
  `node --test --test-timeout=8000`.
- **Zustand v5**: selectores planos. pdfjs-dist legacy + `destroy()`; sin Python ⇒ Node 24 corre `.ts`.
  `opencode.json` tiene un token en texto plano → **nunca commitearlo**. ⚠️ **41/198 nombres** con
  basura `|` o palabras perdidas (Diseño Gráfico virtual 19/39): afecta a RF-8.

## Próximos pasos

1. Arreglo de **nombres OCR** (41/198; RF-8) a decisión del usuario.
2. Verificar el compartir en un **móvil real**: el Chrome de escritorio no abre la hoja (por eso
   existe RF-11), así que el diálogo auténtico solo se ha probado simulado con foco robado.
