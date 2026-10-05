# Plan — Spec 001: Calculadora de C.U.M

Estado: aprobada
Cubre: spec `specs/001-calculadora-cum/spec.md` (aprobada)

> La spec describe el QUÉ; este archivo define el CÓMO. Los tests corren con **`node --test`** (ver AGENTS.md).

## 1. Archivos y responsabilidades

```
src/
  domain/
    tipos.ts          # Plan, Asignatura, Ciclo, RegistroNota, CumResult (contrato de datos)
    cum.ts            # calcularCum(plan, registros) + redondeo — PURO, sin imports de UI/almacén
    validacion.ts     # validarNota(str) → {ok, valor} | {ok:false, error} — PURO
    cascada.ts        # sedesParaTipo(), carrerasPara(tipo,sede) — PURO sobre el índice del dataset
  data/
    esquema.ts        # esquema Zod del contrato Plan (valida el JSON al cargarlo)
    repositorio.ts    # cargarPlanes() → índice en memoria; fallback a fixtures si no hay dataset
  state/
    store.ts          # store Zustand: registros por clave (tipo,sede,plan) + acciones
    persistencia.ts   # leer/escribir localStorage (solo {asignaturaId, nota} por clave) — sin datos sensibles
  components/
    FormularioCarrera.tsx  # RF-1, RF-2, RF-3
    PensumCiclos.tsx       # acordeones por ciclo — RF-4
    MateriaCard.tsx        # estado pendiente/cursada + indicador ≥6 — RF-4, RF-7, RF-14
    NotaModal.tsx          # ingresar/editar/eliminar nota, validación — RF-5, RF-6, RF-8
    PanelCum.tsx           # CUM + ΣUM/ΣUV + progreso + aprob./reprob. — RF-9, RF-10, RF-14
  app/
    montaje.tsx        # wiring: cargar datos → store → pantalla
```

Responsabilidad clave: `domain/` **no importa** de React, Zustand ni localStorage (P5). Si algo de
`domain/` necesita un import de UI, el diseño está mal.

## 2. Funciones puras

- `calcularCum(plan, registros) → CumResult`
- `validarNota(entrada) → ResultadoValidacion`
- `sedesParaTipo(tipo) / carrerasPara(tipo, sede)`
- No aplica el parámetro "hoy": el dominio no depende de fechas ni de tiempo (las notas no expiran).

## 3. Algoritmo (pseudocódigo)

```
calcularCum(plan, registros[]):
    uvPorId = índice de plan.asignaturas por id
    ultima = {}                                    # dedupe: última nota gana (P1)
    PARA CADA r EN registros EN ORDEN:
        ultima[r.asignaturaId] = r.nota            # una sola entrada por materia

    sumaUM = 0; sumaUV = 0; aprobadas = 0; reprobadas = 0
    PARA CADA (id, nota) EN ultima:
        SI uvPorId[id] NO EXISTE: LANZAR error     # dato corrupto, fallar ruidoso (P2)
        uv = uvPorId[id]
        sumaUM += nota * uv
        sumaUV += uv
        nota >= 6 ? aprobadas++ : reprobadas++

    cum = (sumaUV == 0) ? INDICADOR_VACIO          # sin división entre cero (RF-10)
                        : redondear(sumaUM / sumaUV, 2)   # RF-9
    DEVOLVER { cum, sumaUM, sumaUV, contadas: size(ultima), aprobadas, reprobadas }
```

`validarNota(entrada)`: trim → parse Number → `Number.isFinite` → `1 ≤ n ≤ 10` → si no, error.

## 4. Interfaz (desde la spec)

- **Formulario**: 2 `<select>` nativos en cascada Tipo → Sede → Carrera (opciones de sede filtradas
  por tipo; de carrera por tipo+sede) + estado "sin resultados".
- **Pensum**: acordeones por ciclo (I…X); por materia: código, nombre, UV, prerrequisito (o "—"),
  indicador y nota al estar cursada.
- **Modal**: un solo componente con modos `ingresar | editar` (editar incluye "Eliminar nota");
  input numérico, error inline, botón Guardar + `Esc`.
- **Panel**: CUM grande (2 decimales o `—`), `ΣUM / ΣUV`, progreso `n/total`, contadores
  aprobadas/reprobadas. `aria-live="polite"` para anunciar cambios (RNF-2).
- **Cierre de pestaña**: `beforeunload` solo si hay registros en la sesión (RF-13).

## 5. Decisiones justificadas (alternativa descartada)

| # | Decisión | Alternativa descartada | Por qué |
|---|---|---|---|
| D1 | **`node --test`** para el dominio | Vitest + jsdom (stack inicial) | AGENTS.md y la skill sdd lo exigen; corre sin bundler ni DOM, más rápido y sin config (P5) |
| D2 | Estado: `Record<claveCarrera, Record<asignaturaId, nota>>` en Zustand + `persist` a localStorage | IndexedDB / backend | ≤ ~50 pares por carrera; JSON plano es suficiente y RF-14 prohíbe servidor |
| D3 | Recalcular con `calcularCum` memoizado por `registros` de la carrera activa | Web Worker / cálculo incremental | ~50 materias ⇒ <1 ms; RNF-1 se cumple holgadamente |
| D4 | Selects nativos | Combobox con librería | Accesibles de fábrica y en móvil (RNF-2/RNF-3); la cascada se resuelve filtrando opciones |
| D5 | Validación de nota **solo rango 1–10** (cualquier decimal) | Múltiplos de 0.25 / 0.5 | La spec no restringe el decimal; no añadir reglas que la spec no manda |
| D6 | Dataset inyectable vía repositorio con fixtures de prueba | Datos importados directo en componentes | Permite probar el dominio sin el pipeline de la spec 002 y aísla el contrato (esquema Zod) |
| D7 | Confirmación de salida (`beforeunload`) **además** de persistir en cada cambio | Persistir solo al salir | RF-13 pide confirmar; persistir auto evita pérdida real y hace la confirmación defensa en profundidad |

## 6. Estrategia de tests (`node --test`)

Archivo `tests/` con un script por unidad; caso rojo → código → verde (P5).

- **`cum.test.ts`** — RF-7, RF-9, RF-10, RF-14 + P1:
  0 materias ⇒ `INDICADOR_VACIO`; una materia; varias; dedupe (dos registros ⇒ una sola vez, última
  nota); decimales (7.5, 8.25); bordes 1 y 10; aprobada 6 / reprobada 5.99 con mismo CUM que si no
  hubiera indicador; id desconocido ⇒ lanza.
- **`validacion.test.ts`** — RF-6: "", "0", "10.1", "abc", NaN ⇒ error; "1", "6", "10", "7.5" ⇒ ok.
- **`cascada.test.ts`** — RF-1, RF-2, RF-3: Profesorados ⇒ solo Soyapango; combinación vacía ⇒
  lista vacía (la UI decide el estado sin resultados).
- **`persistencia.test.ts`** — RF-11, RF-12: roundtrip por clave; dos carreras no se mezclan;
  solo claves `{asignaturaId, nota}` (P6).
- **Checklist manual** (no automatizable sin DOM): RF-5/RF-8 flujos del modal, RF-13 antes de cerrar,
  RNF-2 teclado/lector, RNF-3 móvil 360 px, RNF-14 ausencia de peticiones de red.

## 7. Cobertura de RF

| RF | Cubierto por |
|---|---|
| RF-1, RF-2, RF-3 | `cascada.ts` + `FormularioCarrera` + tests cascada |
| RF-4 | `PensumCiclos`, `MateriaCard` (código, nombre, UV, prerrequisito) |
| RF-5, RF-6, RF-7, RF-8 | `NotaModal` + `validacion.ts` + tests validación |
| RF-9, RF-10, RF-14 | `cum.ts` + `PanelCum` + tests cum |
| RF-11, RF-12 | `store.ts`, `persistencia.ts` + tests persistencia |
| RF-13 | `beforeunload` en `montaje.tsx` (checklist manual) |
| RF-15, RF-16 | sin fetch en el flujo + solo localStorage (checklist manual) |
| RNF-1 | memoización D3 + verificación de tiempo en test de cum |
| RNF-2, RNF-3 | atributos ARIA y revisión responsive (checklist manual) |
| RNF-4 | arquitectura `domain/` sin imports de UI (P5) — verificable con revisión |

## 8. Dependencias y riesgos

- **Dependencia externa**: el contrato `Plan` (esquema Zod) anticipa la spec 002 (dataset). Aquí se
  valida contra fixtures; cuando 002 entregue `data/planes/*.json`, no debe cambiar el contrato.
- **Riesgo**: si el dataset real trae campos distintos a los del contrato, cambia la spec 002, no esta.
