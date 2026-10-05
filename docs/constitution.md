# Constitución — CalCUM UDB

Estado: **aprobada**

Principios innegociables del proyecto. Están por encima de specs, planes y código: cualquier
conflicto se resuelve a favor de esta constitución y, si hace falta romperla, se cambia **aquí
primero** y con aprobación explícita del usuario.

Flujo SDD que rige el proyecto (skill `sdd`):
`Constitución → Spec → Clarificación → Plan → Tareas → Implementación → Validación → Cambio`.
La spec manda: si algo no está en una spec, no se implementa.

---

## P1 · La fórmula del C.U.M es ley

`C.U.M = Σ(nota × UV) / Σ UV` sobre **todas** las materias cursadas (aprobadas y reprobadas), con
la **última nota** cuando una materia se repite, contando una sola vez.

**Verificación:** los tests cubren una reprobada en el denominador y pasan; ningún cambio de código
altera la fórmula sin actualizar antes este archivo.

## P2 · Ningún dato de la UDB entra sin validarse

Todo pensum generado debe cumplir `Σ UV de las materias == UV total publicado` **y**
`nº de materias == total de materias publicado`.

**Verificación:** el pipeline termina con error explícito (exit ≠ 0) ante cualquier descuadre; ningún
JSON queda en `data/` sin haber pasado ambas comprobaciones.

## P3 · La spec manda sobre el código

Si algo no está en una spec de `specs/NNN-*/`, no se implementa. Los cambios de requisito entran
primero en la spec, después en el plan/tareas y al final en el código.

**Verificación:** cada tarea de `tasks.md` referencia RFs que existen en `spec.md`; ninguna función
nueva aparece en `src/` sin su RF correspondiente.

## P4 · Nada avanza de fase sin aprobación explícita

`Constitución → Spec → Plan → Tareas → Implementación → Validación`: el usuario aprueba cada
frontera antes de cruzarla.

**Verificación:** el `Estado:` de la spec solo avanza (`borrador → aprobada → implementada`) tras un
sí explícito; no hay tareas marcadas `[x]` en una spec no aprobada.

## P5 · Funciones puras y verificables primero

La lógica de cálculo vive sin dependencias de UI ni de almacenamiento, y se prueba antes de escribir
el código que la usa (tests en rojo → verdes con `node --test`).

**Verificación:** `calculateCum` corre en un test de Node sin montar React ni tocar `localStorage`;
los casos límite (0 materias → sin división, decimales, dedupe de repitencia) tienen test.

## P6 · Cero datos sensibles, cero backend

No se recolecta ni guarda información personal del estudiante fuera de su propio `localStorage`;
ningún token, clave o dato personal se escribe en el repo.

**Verificación:** `grep` sobre el repo sin coincidencias de tokens/datos personales; la app funciona
sin red después de cargar la página; `localStorage` contiene solo `{asignaturaId, nota}`.
