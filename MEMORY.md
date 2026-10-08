# MEMORY.md

Memoria de CalCUM UDB (máx ~50 líneas); lo que ya es regla permanente pasa a `AGENTS.md`.

## Estado Actual

- Specs 001, 002 y **003 CERRADAS** (T1–T8 el 2026-10-07; **cambio D6/D11** = T9–T12 el
  2026-10-08): el compartido que **falla sin abrir diálogo ahora descarga** a los 5 s (antes:
  30 018 ms y "cancelado" **sin imagen**). `npm test` → **164 pass / 0 fail** · `tsc` 0 · `build`
  **137,19 kB gzip** (+0,44; límite 5 kB). Verificado en navegador con 4 escenarios, consola 0
  errores y red solo local. Detalle posterior: las **ΣUM del desglose a 2 decimales** (`desgloseDe`
  en `domain/exportar`, usada por panel y tarjeta) — antes salía `148.39999999999998 UM`.
- **Git** (`main`, `github.com:TLTO123/CalCUM`): `5b25559`/`282fee0` = 001, `c0f9ce9` = 002,
  `d8d4081` = 003 con T1–T8, **`565ba72` = RF-11/D6**, `e66232d` = MEMORY. `pipeline/` binario
  (~58 MB); nada > 10 MB; `opencode.json` ignorado (token en texto plano).
- Dev: `npx vite` (5173) · `npm run datos[:refrescar]` · **SDD**: aprobación explícita por fase (P4)
  y una tarea a la vez → rojo → verde → marcar → parar.

## Decisiones (y por qué)

- **Clave de carrera = `(tipo, sede, plan, nombre)`** (RF-4): sin el nombre colisionan 11 grupos.
  **Id** = `sede:tipo:plan:slug:carrera:ciclo:código`; electivas `electiva-<orden>`.
- **Spec 003 (D1–D6)**: solo el panel (D1) · **una única acción** con fallback a descarga (D2) ·
  `canvas` sin librerías (D3) · **cancelar NO descarga** (D4) · tema claro fijo (D5) · **D6**: un
  `AbortError` no basta ⇒ **fallo sin diálogo descarga**, solo cancelación real no (RF-11). Ojo: el
  **plan** reutiliza la numeración y su **D6** es "DOM en `export/`".
- **Plan 003 (D8–D16)**: lienzo 720×440 ×2 (D8) · deshabilitado con motivo (D9) · `canShare` antes
  de `share` (D10) · `calcum-<slug>-<fecha>.png` (D11) · **D14** dos señales para distinguir fallo
  de cancelación (foco/visibilidad + tiempo y mensaje) · **D15** plazo de 5 s sin diálogo ⇒ descarga
  · **D16** hoja testigo con `window`/`document` inyectados (`src/export/hoja.ts`).
- **`validar()` triangula sitio ↔ encabezado ↔ filas** con 0 errores; excepción RF-2 única:
  Ingeniería Eléctrica publica 163 UV (D10). **OCR**: sin rótulos de ciclo ⇒ `.jpg` +
  `OPCIONES_OCR` con `fusionar: false`; fuentes en `pipeline/fuentes/`, red solo con `--refresco`.

## Aprendizajes y errores a evitar

- **`AbortError` de `share()` es ambiguo**: es "el usuario canceló" **y** "no pude compartir"
  (Chrome/Windows devolvió `Share failed` a los 30 s sin abrir nada). Nunca decidir solo con el
  texto del error: medir también si la pestaña perdió el foco y cuánto tardó el rechazo.
- 3 sedes ⇒ **parseo por layout** validando `ΣUV` y `conteo` contra el encabezado. **Presencial**:
  x≈683/y≈191, región `rótulo−18`, hueco >1,6×mediana = fin de ciclo. **Virtual**: margen 45,
  código `[41,60]`, UV `[−55,−25]`, prereq en fila propia, correlativo centrado `[-4,14.5]`.
- **OCR**: glifo UV **calibrado por las hermanas de su columna** y descartando la etiqueta `UV`;
  prerrequisito como código; `Bachillerato`/`-`/`**` ⇒ `null`.
- **Chrome automatizado**: `toBlob` solo codifica rápido la primera vez por carga (después ~1,03 s;
  `toDataURL` 27 ms) ⇒ medir tras recargar; `window.confirm` (`montaje.tsx:64`) se abre entre
  llamadas y contamina; `share()` sin red queda pendiente (es del navegador). Un test nuevo con
  promesa pendiente **se cuelga en rojo** ⇒ correr esa fase con `node --test --test-timeout=8000`.
- **Zustand v5** selectores planos · pdfjs legacy + `destroy()` · Node 24 corre `.ts` · ⚠️ **41/198
  nombres** con basura (Diseño Gráfico 19/39, RF-8) · `opencode.json` tiene token: **nunca
  commitearlo**.

## Próximos pasos

1. Arreglo de **nombres OCR** (41/198; RF-8) a decisión del usuario.
2. Verificar el compartir en un **móvil real** (el escritorio no abre la hoja: por eso existe RF-11).
