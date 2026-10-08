# AGENTS.md

## Qué es este repo

**CalCUM UDB** — calculadora de C.U.M (Coeficiente de Unidades de Mérito) para estudiantes de la
Universidad Don Bosco (El Salvador). La app (Vite + React) lee el dataset publicado por
`npm run datos` en `data/planes.json`; el scraping y el parseo de los pensums viven en `pipeline/`.

El plan técnico aprobado (stack, estructura de carpetas, milestones M1–M4) está en la conversación
de plan, no en un archivo. Si se necesita re-confirmarlo, preguntar al usuario antes de ejecutar.

## Fuente de verdad de los datos

`docs/01-oferta-academica-udb.md` es el dataset de referencia verificado por scraping:
oferta de carreras, UV por carrera, rutas de pensums PDF y reglas de negocio. **Leerlo antes de tocar
datos de la UDB.** Puntos que ya costaron trabajo y que se olvidan fácil:

- La oferta se agrupa por **3 sedes** (Soyapango, Antiguo Cuscatlán, UDB Virtual), no por "modalidad".
  La modalidad real (Semipresencial/Distancia) es un atributo de cada carrera.
- **Clave única de carrera = `(tipo, sede, plan, nombre)`** — el nombre **sí** entra (RF-4,
  corregido en la spec 002; la regla vieja era `(tipo, sede, plan)`). Con la tripleta a secas
  colisionan **11 grupos reales**: 8 ingenierías de Soyapango comparten
  `ingenieria|soyapango|plan-2024`, así que las notas de una carrera caerían en otra. Los
  homónimos con datos distintos siguen separados: Ing. en Ciencias de la Computación presencial
  es 161 UV/40 materias, virtual es 176 UV/44 materias.
- Las variantes de Antiguo Cuscatlán **reutilizan el mismo PDF de pensum** que Soyapango.
- Conviven varios planes (`plan-2022`, `plan-2024`, `plan-2025`, `planes_2026`). Versionar siempre.

### Scrapeo de los pensums

- Son **PDF de 1 página en formato infográfico**; el orden de extracción de texto sale
  **intercalado entre columnas**. `extract_text()` simple no sirve: usar parseo por layout
  (coordenadas x/y de columna). Ver skill `pdf` en `.agents/skills/pdf/`.
- La extracción desde el navegador funciona con **PDF.js vía `import()` dinámico desde CDN** dentro de
  `evaluate_script` (el entorno no tiene Python, ver abajo).
- **Validación obligatoria de todo dataset generado:** `Σ UV de las materias == UV total publicado`
  en el encabezado del PDF **y** `conteo == total de materias publicado`. Falla ruidosamente, no
  silenciosamente.
- Algunos enlaces de pensum vienen como `http://` (redirigen) — normalizar a `https://`.

## Reglas de negocio (confirmadas por el usuario — no re-litigar)

```
U.M (materia i) = Nota final_i × UV_i
C.U.M           = Σ (Nota_i × UV_i) / Σ UV_i
```

- El denominador incluye **TODAS las materias cursadas**, aprobadas y reprobadas (decisión explícita;
  no usar la convención clásica de "solo aprobadas").
- **Repitencia:** una materia cursada varias veces cuenta **una sola vez con su última nota**.
- Escala de notas: **decimales 1–10**.
- Alcance v1: **solo pregrado** (Ingenierías, Licenciaturas, Técnicos, Profesorados). Sin Maestrías
  ni Doctorados.
- Dataset v1: **los ~50 pensums de pregrado completos**, no una muestra piloto.

## Decisiones de producto que ya están tomadas

- Dos selects en cascada **Tipo → Sede → Carrera**, con filtrado dinámico (hay tipos que solo existen
  en una sede; nunca dejar un camino sin resultados).
- Pensum en **diseño tipo tarjetas / acordeones por ciclo (I–X)**, no réplica de la grilla del PDF.
- Panel CUM en vivo con **desglose ΣUM/ΣUV + barra de progreso**, y **exportar/compartir** el
  resultado (PNG en cliente).
- Clic en materia pendiente → modal de nota; clic en materia ya cursada → modal de **editar/eliminar**.
- Persistencia en `localStorage` **por clave de carrera** (cambiar de carrera no borra el trabajo).
- Sin backend: todo el cálculo es aritmética en cliente.

## Entorno

- **No hay Python** en esta máquina (el `python`/`python3` del PATH son aliases de la Microsoft Store
  que fallan). Usar **Node v24** para scripts de datos y parsing.
- Shell es **PowerShell (pwsh)** en Windows — rutas con `C:\`, `$env:TEMP`, sin `&&` entre comandos.
- Temp aprobado para uso externo: `C:\Users\canta\AppData\Local\Temp\opencode`.
- Repo git con remoto `github.com:TLTO123/CalCUM` (rama `main`); rama por tarea cuando haya
  cambios arriesgados (P4).
- MCPs configurados en `opencode.json`: `chrome-devtools` (scraping), `context7` (docs de libs),
  `github`. El token de GitHub está en texto plano en `opencode.json` — **no copiarlo a ningún archivo
  del proyecto, y no commitearlo si se inicializa git**.

## Skills disponibles

`.agents/skills/` (ver `skills-lock.json`): `frontend-design` (dirección visual de la UI),
`design-taste-frontend-v1`, `pdf` (extracción de pensums), `find-skills`.

## Comandos

- Tests: `node --test`

## Reglas

- Lee `docs/constitution.md` y la spec activa (`specs/NNN-*/`) antes de tocar código.

## Memoria

- Al empezar, lee `MEMORY.md` para conocer el estado del proyecto y las decisiones tomadas.
- Al terminar una tarea, actualízalo: estado actual, decisiones importantes (con su porqué) y errores a evitar.
- Mantenlo breve (máximo ~50 líneas): resume o elimina lo que ya no aporte.
- Si algo se convierte en una regla permanente, propón moverlo a `AGENTS.md` en lugar de dejarlo en la memoria.
- No guardes nunca datos sensibles (claves, tokens, datos personales).

