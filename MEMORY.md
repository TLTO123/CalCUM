# MEMORY.md

Memoria del proyecto CalCUM UDB. Actualizar al terminar cada tarea (máx ~50 líneas).

## Estado Actual

- Fase: **SDD, spec 001 COMPLETA**. Tareas **T1–T11 ✅** (dominio+datos+estado+formulario+pensum+
  modal+panel CUM+offline). **Checklist manual final ✅**: RNF-1..4, RF-15, RF-16 (tabla en
  `tasks.md`). `npm test` → 46 pass · typecheck → 0 · build → 0. **Sin git todavía.**
- **T11 (RF-15)**: `public/sw.js` (stale-while-revalidate same-origin) + registro en `montaje.tsx`
  solo con `import.meta.env.PROD` + `base: './'` en `vite.config.ts` + scripts `build`/`preview`.
- Fix RNF-2: `NotaModal` es `<form noValidate onSubmit>` → Enter en el input guarda.
- Dev server: `npx vite` (5173). Gancho RF-3: `/?rf3=1`. Preview: `npx vite preview --port 4173`
  (**no** `npm run preview -- --port`, npm traga el argumento).
- Hecho: análisis de proyecto, scraping oferta UDB (`docs/01-oferta-academica-udb.md`), reglas de
  negocio cerradas, `AGENTS.md`, **`docs/constitution.md` aprobada** (6 principios P1–P6).
- Specs: `specs/001-calculadora-cum/{spec,plan,tasks}.md` aprobados y cerrados.
- Stack: **Vite + React + TypeScript + Zustand + Zod** (Tailwind no se usó: CSS propio), sin
  backend, deploy estático. **Tests con `node --test`** (no Vitest).

## Decisiones (y por qué)

- **C.U.M = Σ(nota×UV) / ΣUV sobre TODAS las materias cursadas** → decisión explícita del usuario;
  difiere de la convención clásica de "solo aprobadas", no re-litigar.
- **Repitencia: última nota, cuenta una sola vez** → dedupe con `Map<asignaturaId, nota>`.
- **Clave de carrera `(tipo, sede, plan)`** → homónimos con UV distintos (presencial vs. virtual).
- **Alcance v1: solo pregrado, dataset completo (~50 pensums)** → sin piloto acotado.
- **Nota mínima de aprobación = 6** → solo indicador visual, **no altera la fórmula**.
- **Selects Tipo → Sede → Carrera** + **pensum en tarjetas/acordeones** + **decimales 1–10** +
  **exportar PNG/share** → preferencias explícitas del usuario.
- **Sin backend / sin datos sensibles** → cálculo puro en cliente, `localStorage` por carrera.
- **SDD** (skill `sdd`) → Constitution → Spec → Plan → Tareas → Implementación; la spec manda y
  cada fase requiere aprobación explícita (P3, P4); una tarea a la vez, rojo → verde.

## Aprendizajes y errores a evitar

- El sitio UDB agrupa por **3 sedes**, no por "modalidad" (modalidad es atributo por carrera).
- Pensums: PDF infográfico con **texto intercalado entre columnas** → parseo por layout, nunca
  `extract_text()` simple. Validar `ΣUV == UV publicada` y `conteo == materias publicadas`.
- **Zustand v5**: un selector que devuelve objeto nuevo ⇒ re-render infinito /
  "getSnapshot should be cached" → selectores planos + referencias estables.
- React no repinta si el estado se lee con `getState()` → suscribirse siempre (`useStore`).
- **No hay Python** (alias Microsoft Store fallan) → Node 24. Shell PowerShell.
- Algunos enlaces de pensum son `http://` → normalizar a `https://`.
- `opencode.json` contiene un token en texto plano → no copiarlo al proyecto ni commitearlo.
- Glob/grep fallan por `Expand-Archive` en PowerShell → usar `Test-Path`/`Select-String`.

## Próximos pasos

1. **Spec 002** — dataset completo: `pipeline/` (Node) → extraer/validar los ~50 pensums →
   `data/planes/*.json`, sin cambiar el contrato Zod actual.
2. **Spec 003** — exportar/compartir el resultado como PNG.
3. Decidir si se inicializa git (ojo: excluir `opencode.json` y `dist/`).
