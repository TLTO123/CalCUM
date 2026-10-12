# MEMORY.md

Memoria de CalCUM UDB (máx ~50 líneas); lo que ya es regla permanente pasa a `AGENTS.md`.

## Estado Actual

- Specs 001–004 **CERRADAS** (004: nombres de asignatura saneados, T1–T8, 2026-10-11; evidencia
  RF-1…RF-9 en el checklist de cierre de `specs/004-nombres-asignaturas/tasks.md`).
- **Resultado de 004**: `npm run datos` en verde (59 planes · 21 correcciones · 0 discrepancias
  sin aprobar) · control de nombres **0 rojos** (antes 42) · diff vs HEAD auditado: **44 rutas,
  las 44 `nombre`** (16 sanos + 21 curados + 6 fuera + TIP919 Lic.; los 2 EDN902 no se tocaron) ·
  dos corridas consecutivas → bytes idénticos (RF-9) · `npm test` **196 pass / 0 fail** · `tsc` 0
  · build **gzip 137,09 kB** (antes 137,19: no crece).
- Dev: `npx vite` (5173) · `npm run datos[:refrescar]` · **SDD**: aprobación por fase (P4) y una
  tarea a la vez → rojo → verde → marcar → parar.

## Decisiones (y por qué)

- **Clave de carrera = `(tipo, sede, plan, nombre)`** (RF-4) · **Id** = `sede:tipo:plan:slug:ciclo:código`.
  Las electivas (`electiva-<orden>`) usan su **posición real dentro del ciclo**: la 4ª fila del
  ciclo es `electiva-4` aunque sea la única electiva (no es el ordinal entre electivas).
- **Spec 004 (D1–D7)**, detalle en `plan.md`: `depurarRuido` **después de `separarTitulos`** (¡el
  `|` puede ser el romano `I` de un `Ciclo I`!) + compuerta en `parsear` · corrección curada por
  **id** y registro **inyectado** en `main` · nombre vacío lo decide `validar` · control de 5
  reglas objetivas, 0 FP, que **bloquea** · solo cambia `nombre` · corrección obsoleta **bloquea**
  · RF-7 solo avisa y no compara dentro de un plan.
- **Errata del documento se transcribe**, no se mejora; excepción única: `Insdustriales` →
  `Industriales` en `EPI906` (usuario, 2026-10-09).
- **`validar()` triangula** sitio ↔ encabezado ↔ filas; excepción RF-2 única: Ing. Eléctrica 163 UV.
  **OCR**: sin rótulos ⇒ `.jpg` + `OPCIONES_OCR` (`fusionar: false`); red solo con `--refresco`.
- **Anexo B (fuera de alcance)**: ~21 nombres dañados que las 5 reglas no ven. Curarlos usa el
  mismo registro; **detectarlos solos** exigiría bajar el umbral de RF-7 o cruzar planes afines
  (riesgo de FP). **Spec 005 dormida** (decisión del usuario, 2026-10-11): no se abre hasta que
  se decida curar a mano o asumir el riesgo de la detección automática.

## Aprendizajes y errores a evitar

- 3 sedes ⇒ **parseo por layout** validando ΣUV/conteo. Presencial: x≈683/y≈191, región `rótulo−18`.
  Virtual: margen 45, código `[41,60]`, UV `[−55,−25]`, correlativo `[-4,14.5]`.
- **OCR**: glifo UV calibrado por las hermanas de su columna; `Bachillerato`/`-`/`**` ⇒ `null`.
- **Medir toda regla de texto contra el dataset**: `\b` es ASCII y la `ñ` rompe su frontera (13 FP)
  ⇒ usar el **último token**; deduplicar por `id`, no por `código+nombre` (juntó 2 `PPI905`).
- Los controles se miden sobre los **nombres ya saneados**: el `planes.json` viejo daba 42 rojos,
  el regenerado, 0.
- **Leer imágenes con la tool `read` no sirve**: mezcla archivos distintos. Cotejar un pensum exige
  **recortar la celda por coordenadas** (canvas en Chrome) + **OCR del recorte** (`spa`).
- **El slug de id lleva `-a-distancia`**: un id mal escrito en el registro detiene la publicación
  entera; contrastar cada id contra `data/planes.json`.
- **Las señales estructurales no ven todo el daño**: un nombre completo en la forma pero cortado en
  el fondo pasa por sano. El único detector es el **cruce contra el gemelo presencial**.
- Escribir JSON con acentos desde **pwsh corrompe `—` y `|`**: usar la tool `write` (UTF-8).
- **Chrome**: `AbortError` de `share()` es ambiguo · test con promesa pendiente **se cuelga en rojo**
  ⇒ `--test-timeout=8000`.

## Próximos pasos

1. **Sin specs abiertas.** La **005 queda dormida** (decisión del usuario, 2026-10-11): el daño
   del anexo B (~21 nombres, incluidos los 6 del anexo A) sigue publicado y documentado en la
   spec 004, sin efecto en el cálculo (solo cambia el texto del nombre). Curar usa el mismo
   registro; lo caro —detectarlo— ya se hizo en T6.
2. Verificar el compartir en un **móvil real** (el escritorio no abre la hoja: por eso RF-11);
   exige HTTPS ⇒ si se publica (Netlify u otro), que sea su propia spec pequeña.
