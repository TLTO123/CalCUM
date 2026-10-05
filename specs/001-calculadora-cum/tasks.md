# Tareas — Spec 001: Calculadora de C.U.M

Estado: aprobadas (2026-10-05)
Depende de: `spec.md` (aprobada) y `plan.md` (aprobado)
Orden: dependencia secuencial. Una tarea a la vez: test en rojo → código → `node --test` verde →
marcar → parar (P5).

- [x] **T1. Andamiaje del proyecto y runner de tests.** RNF-4
  - Hecho cuando: `node --test` ejecuta al menos un test de humo en verde desde la raíz, y existe
    `src/domain/` vacío con `tsconfig` que compila sin errores.
  - ✅ 2026-10-05: `package.json` (scripts `test`/`typecheck`), `tsconfig.json` (strict,
    `erasableSyntaxOnly`), `src/domain/index.ts` vacío, `tests/humo.test.ts`.
    `npm test` → 1 pass; `tsc --noEmit` → exit 0. (Deps: typescript, @types/node.)

- [x] **T2. Tipos y esquema del contrato `Plan`.** RF-4 (contrato), base de RF-11
  - Hecho cuando: `src/domain/tipos.ts` define `Plan`, `Asignatura` (incluye `prerrequisito`),
    `Ciclo`, `RegistroNota`, `CumResult`; `src/data/esquema.ts` valida con Zod un fixture válido y
    **rechaza** un fixture con UV faltante.
  - ✅ 2026-10-05: + `Sede`, `TipoCarrera`, constantes `NOTA_MINIMA_APROBACION=6`, `NOTA_MIN/MAX`,
    y `esquemaCiclo`. `npm test` → 6 pass (incluye rechazo de UV faltante, sede desconocida y plan
    vacío); `tsc --noEmit` → 0. (Dep: zod.)

- [x] **T3. `validarNota`.** RF-6
  - Hecho cuando: `tests/validacion.test.ts` en verde: `"1"`, `"6"`, `"10"`, `"7.5"` → ok con valor
    numérico; `""`, `"0"`, `"10.1"`, `"abc"`, `"NaN"` → error.
  - ✅ 2026-10-05: `src/domain/validacion.ts` (pura, usa `NOTA_MIN/MAX` de T2). 5 tests: además de
    los exigidos, cubre `8.25`, espacios, negativos, `Infinity` y mensaje legible `/1 y 10/`.
    `npm test` → 11 pass; `tsc --noEmit` → 0.

- [x] **T4. `calcularCum`.** RF-7 (núcleo), RF-9, RF-10, RF-14, P1
  - Hecho cuando: `tests/cum.test.ts` en verde para: 0 materias ⇒ indicador vacío; cálculo manual
    verificado; decimales 7.5/8.25; bordes 1 y 10; dedupe con última nota; ≥6 aprobada / 5.99
    reprobada sin alterar el C.U.M; `asignaturaId` desconocido ⇒ lanza.
  - ✅ 2026-10-05: `src/domain/cum.ts`. 13 tests: los 8 exigidos + ponderado completo, redondeo
    estable (EPSILON), "última nota" por posición, denominador con reprobadas (4.4), plan sin
    ciclos. `npm test` → 24 pass; `tsc --noEmit` → 0.

- [x] **T5. `cascada` de selección.** RF-1, RF-2, RF-3
  - Hecho cuando: `tests/cascada.test.ts` en verde: `sedesParaTipo('profesorado')` ⇒ solo Soyapango;
    `carrerasPara(tipo,sede)` filtra correctamente; combinación sin oferta ⇒ lista vacía.
  - ✅ 2026-10-05: `src/domain/cascada.ts` (+`tiposDisponibles`). 7 tests: homónimos 161 vs 176 UV
    separados, orden estable de sedes, índice vacío sin excepciones. 1 fallo corregido en el
    fixture (faltaba el Técnico virtual, no en el código). `npm test` → 31 pass; `tsc --noEmit` → 0.

- [x] **T6. Repositorio de datos con fixtures.** RF-4 (datos), RF-11 (clave)
  - Hecho cuando: `cargarPlanes()` entrega un índice por `(tipo, sede, plan)` con ≥ 2 fixtures de
    carreras homónimas distintas (presencial 161 UV vs virtual 176 UV), y un JSON corrupto hace
    fallar ruidosamente (error Zod, no silencio).
  - ✅ 2026-10-05: `src/data/repositorio.ts` (`cargarPlanes`, `claveDePlan` = `tipo|sede|planVersion`,
    `indicePorClave` con anti-duplicados, `planesIniciales`) + `src/data/fixtures/planes.json` con
    5 planes (CC presencial 161 / virtual 176, Multimedia ×2, Profesorado). 6 tests: corrupto,
    sede inválida, no-array, homónimos sin colisión, dataset inicial validado.
    `npm test` → 37 pass; `tsc --noEmit` → 0.

- [x] **T7. Store y persistencia.** RF-11, RF-12 (estructura), RF-16, P6
  - Hecho cuando: `tests/persistencia.test.ts` en verde: roundtrip por clave; dos carreras no se
    mezclan; almacenado solo `{asignaturaId, nota}`; y `grep` en `src/` sin URLs de red en el flujo
    de uso.
  - ✅ 2026-10-05: `src/state/persistencia.ts` (blob único `calcum-udb:v1`, corrupto ⇒ arranca
    vacío) + `src/state/store.ts` (`zustand/vanilla`, inyectable, singleton `storeApp`).
    9 tests: roundtrip, separación por clave, sin campos extra, storage corrupto, última nota,
    eliminar, restaurar al volver, sin selección. Sin URLs de red en `src/` (RF-16).
    `npm test` → 46 pass; `tsc --noEmit` → 0. (Dep: zustand.)

- [x] **T8. Formulario en cascada.** RF-1, RF-2, RF-3
  - Hecho cuando: en navegador, elegir tipo actualiza sedes, elegir sede actualiza carreras con
    UV/materias visibles, y una combinación vacía muestra estado "sin resultados" sin camino muerto.
  - ✅ 2026-10-05: React+Vite (`index.html`, `src/app/montaje.tsx`, `estilos.css`) +
    `src/components/FormularioCarrera.tsx` (selects nativos D4, etiquetas sede/tipo, tarjetas con
    UV/materias/modalidad, `role="status"` en vacío, sede inválida se limpia al cambiar tipo).
    Verificado en navegador con chrome-devtools: RF-1 (Profesorados→solo Soyapango), RF-2 (tarjeta
    103 UV·21 materias), RF-3 (`/?rf3=1` ⇒ "sin resultados"), reset de sede al cambiar tipo,
    consola sin errores (ids/names en selects + favicon inline). `npm test` → 46 pass; `tsc` → 0
    (tsconfig ampliado a `*.tsx`, antes no revisaba la UI).

- [x] **T9. Pensum con acordeones + modal de nota.** RF-4, RF-5, RF-6, RF-7, RF-8, RF-14
  - Hecho cuando: los ciclos se expanden; cada materia muestra código, nombre, UV y prerrequisito
    ("—" si vacío); clic en pendiente abre modal y solo guarda nota válida 1–10; clic en cursada
    abre modo editar con "Eliminar nota"; la tarjeta muestra ≥6 aprobada / <6 reprobada.
  - ✅ 2026-10-05: `MateriaCard.tsx`, `NotaModal.tsx` (modos ingresar/editar, Esc, foco,
    `role="alert"`/`aria-invalid`), `PensumCiclos.tsx` (acordeones con `aria-expanded`), estilos,
    wiring en `montaje.tsx`. Verificado en navegador: RF-4 cabecera 161 UV·40 materias + acordeones;
    RF-5 modal con input enfocado; RF-6 `11` ⇒ alert + Guardar **no** guarda; RF-7 `7.5` guardada;
    RF-8 editar precarga + "Eliminar nota" ⇒ vuelve a pendiente; RF-14 7.5 aprobada / 4 reprobada;
    persistencia tras recargar (9.25 sobrevive). 2 bugs corregidos en curso: selectors Zustand v5
    con objeto nuevo (re-render infinito) y registros leídos con `getState()` (no reactivos).
    Consola sin errores. `npm test` → 46 pass; `tsc` → 0.

- [x] **T10. Panel CUM en vivo + cierre seguro.** RF-9, RF-10, RF-12, RF-13, RNF-1, RNF-2
  - Hecho cuando: CUM con 2 decimales o `—`, `ΣUM/ΣUV`, progreso `n/total` y contadores
    aprob./reprob. se actualizan <100 ms al cambiar una nota; `aria-live` anuncia el cambio; cambiar
    de carrera pide confirmación y restaura al volver; cerrar/recargar con datos pide confirmación.
  - ✅ 2026-10-05: `CumPanel.tsx` (`useMemo` sobre registros, `aria-live="polite"`,
    `role="progressbar"` 0..N, indicador `—` + mensaje vacío, contadores aprob./reprob., estilos) y
    wiring en `montaje.tsx` (panel sobre el pensum, `beforeunload` condicional a tener registros,
    `confirm` al cambiar de carrera con datos visibles). Verificado en navegador: 9.25 ⇒
    "9.25 · 37 UM / 4 UV"; añadir 6 ⇒ **7.63** en vivo (7.625→2 dec), progreso 2/40; carrera sin
    notas ⇒ `—` + "Aún no has registrado…" 0/21; RF-12: dismiss se queda / accept cambia y
    restaura registros al volver; RF-13 `beforeunload` ⇒ `defaultPrevented: true`. Consola sin
    errores. `npm test` → 46 pass; `tsc` → 0.

- [x] **T11. RF-15: offline tras la primera carga** (tarea añadida el 2026-10-05 con aprobación
  del usuario tras fallar el checklist: no había service worker).
  - Hecho cuando: tras cargar la página una vez, recargar con la red caída sirve la app completa
    (shell + datos de planes + estilos + JS), sin errores de consola.
  - ✅ 2026-10-05: `public/sw.js` (estrategia **stale-while-revalidate** para same-origin GET:
    sirve de caché al instante y repone en segundo plano; `skipWaiting`/`clients.claim` para
    activación inmediata), registro en `montaje.tsx` **solo en build de producción**
    (`import.meta.env.PROD`) para no interferir con el dev server de Vite, y `base: './'` +
    `build.assetsDir` en `vite.config.ts` para que el precache resuelva rutas relativas.
    Verificado con `npm run build` + `vite preview` y emulación **Offline**: recarga limpia,
    panel y pensum renderizan, notas persisten (localStorage), consola sin errores.
    `npm test` → 46 pass; `tsc` → 0.

---

## Checklist manual de cierre (spec 001, 2026-10-05)

| RF / RNF | Estado | Evidencia |
|---|---|---|
| RNF-1 | ✅ | Recálculo en vivo sin recarga: 61 UM / 8 UV ⇒ 7.63 al instante |
| RNF-2 | ✅ | Tab llega a selects → carrera → ciclos → materias; Enter abre modal con foco en el input; **Enter guarda** (fix: `<form onSubmit>`); Esc cierra; nota inválida + Enter mantiene el modal con `role="alert"` |
| RNF-3 | ✅ | Viewport 360×740 con panel + pensum: `scrollWidth == clientWidth == 360`, 0 elementos desbordantes |
| RNF-4 | ✅ | `src/domain/` puro, sin imports de UI; 46 tests con `node --test` |
| RF-15 | ✅ | **T11**: con Offline + recarga, la app carga y funciona (carrera, pensum, nota persistida, consola limpia) |
| RF-16 | ✅ | 28 requests: 0 externos, solo GET same-origin; ningún POST/PUT — las notas no salen del dispositivo |

**Fix aplicado durante el checklist:** `NotaModal.tsx` envuelto en `<form noValidate onSubmit>`
para que Enter en el input guarde (RNF-2 exigía operabilidad total con teclado). Verificado en los
dos sentidos: Enter guarda nota válida; Enter con `99` no cierra y muestra el error.

Si al dividir las tareas el trabajo supera **10**, propongo partir la spec antes de implementar.
