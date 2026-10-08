# CalCUM UDB

Calculadora de **C.U.M** (Coeficiente de Unidades de Mérito) para estudiantes de pregrado de la
Universidad Don Bosco (El Salvador).

Selecciona tu carrera, marca las materias que ya cursaste con su nota y ve tu coeficiente
recalculándose en vivo. **Sin cuentas ni backend**: todo el cálculo ocurre en tu navegador y tus
notas solo se guardan en tu `localStorage`.

## La fórmula

```
U.M (materia i) = Nota final_i × UV_i

C.U.M = Σ (Nota_i × UV_i) / Σ UV_i
```

- El denominador incluye **todas** las materias cursadas, aprobadas y reprobadas.
- Si repites una materia, cuenta **una sola vez con tu última nota**.
- Escala de notas de **1 a 10**, con decimales.

## Qué incluye

- **Las 59 carreras de pregrado** publicadas por la UDB: 33 de Campus Soyapango, 15 de Campus
  Antiguo Cuscatlán y 11 de UDB Virtual, con sus pensums oficiales extraídos y validados.
- Selección en cascada **Tipo → Sede → Carrera**, filtrada en vivo.
- Pensum organizado por ciclos (I–X) en tarjetas: clic en una materia pendiente para poner su
  nota, clic en una ya cursada para editarla o eliminarla.
- Panel de C.U.M en vivo con desglose `ΣUM / ΣUV`, materias aprobadas/reprobadas y barra de
  progreso.
- Indicador de **aprobada / reprobada** en cada materia (nota mínima 6) y aviso al cerrar o
  recargar la pestaña si guardaste notas en la sesión.
- Funciona **sin conexión** después de la primera carga (service worker).

## Exportar y compartir tu resultado

El panel de resultado tiene **un único botón**, *Compartir resultado*, que genera una **imagen PNG
en tu propio dispositivo** (canvas, sin librerías ni servidor) con:

- tu C.U.M a dos decimales, el desglose `ΣUM / ΣUV`, la barra de avance y el conteo de materias
  cursadas, aprobadas y reprobadas;
- el **nombre de la carrera, su sede y el plan** vigentes, más la **fecha** de generación;
- tema claro y alta densidad (720×440 rasterizada a **2×** → 1440×880) para que el texto se lea
  nítido en un chat.

La imagen se entrega a la aplicación que elijas con el **compartir del sistema**; si tu navegador no
lo permite, el mismo PNG se **descarga** con el nombre `calcum-<carrera>-<aaaa-mm-dd>.png`. Si
**cancelas** el diálogo del sistema no pasa nada más: no se descarga nada y tu resultado sigue en
pantalla. Y si el navegador **anuncia que puede compartir pero no llega a abrir ningún diálogo**
(algunos Chrome de escritorio), a los **5 segundos** se rinde y **descarga** el PNG en lugar de
dejarte sin imagen: solo se habla de "cancelado" cuando hubo un diálogo que de verdad pudiste ver y
cerrar. Con materias sin registrar la acción aparece deshabilitada con su motivo al lado. Todo
ocurre **sin ninguna petición de red** y la tarjeta no lleva ningún dato personal: solo carrera,
plan, fecha y tus propias notas.

## Requisitos

- **Node.js 24 o superior** — el pipeline de datos corre TypeScript directamente; el proyecto no
  usa Python ni herramientas externas.
- npm (viene con Node).

## Puesta en marcha

```bash
npm install
npx vite                 # app en http://localhost:5173
```

### Regenerar el dataset

`data/planes.json` viene versionado y es lo que consume la aplicación. Para regenerarlo desde los
PDF de origen:

```bash
npm run datos            # usa las fuentes fijas en pipeline/fuentes/ (sin red)
npm run datos:refrescar  # además vuelve a descargar los pensums de la UDB (usa red)
```

El proceso **falla ruidosamente** (exit ≠ 0) si la suma de UV o el número de materias de cualquier
pensum no cuadran con los totales publicados: nunca se publica un dataset parcial. La salida queda
en `data/planes.json`, la auditoría por carrera en `data/manifiesto.json` y el resumen del proceso
en `docs/02-reporte-dataset.md`.

### Verificación

```bash
npm test                 # node --test → 163 tests
npm run typecheck        # tsc --noEmit
npm run build            # build de producción en dist/
npx vite preview         # sirve dist/ en http://localhost:4173
```

## Estructura del repositorio

```
src/
  domain/       cálculo del C.U.M, cascada, validación y modelo de la tarjeta exportada
  data/         contrato de datos (Zod) y repositorio que lee data/planes.json
  state/        Zustand + persistencia en localStorage por clave de carrera
  components/   panel C.U.M, formulario de carrera, pensum por ciclos, modal de nota
  export/       dibujo del PNG en canvas (tema claro) y entrega por compartir/descarga
  app/          montaje de la app y estilos
pipeline/       generación del dataset: pdf.ts, parsear.ts, ocr.ts, validar.ts, generar.ts
                (las fuentes PDF/JPG y tessdata están versionadas para funcionar sin red)
data/           planes.json (59 planes) + manifiesto.json (origen y fecha de cada plan)
tests/          pruebas con node --test: dominio, exportación, pipeline y contrato
specs/          001-calculadora-cum, 002-dataset-pensums y 003-exportar-png (spec, plan y tareas)
docs/           constitución, oferta académica de referencia y reporte del dataset
```

## Alcance de la v1

- **Solo pregrado**: ingenierías, licenciaturas, técnicos y profesorados. Sin maestrías ni
  doctorados.
- **Sin backend ni red en tiempo de ejecución**: el dataset es un artefacto estático y las notas
  nunca salen del dispositivo.
- Sin proyecciones ("¿qué nota necesito?") ni simuladores.

## Desarrollo con Spec-Driven Development

El proyecto sigue el flujo SDD definido en `docs/constitution.md` (principios innegociables):
`Constitución → Spec → Clarificación → Plan → Tareas → Implementación → Validación → Cambio`.

Cada spec vive en `specs/NNN-nombre/` con su `spec.md` (el QUÉ y el POR QUÉ), `plan.md` (el CÓMO)
y `tasks.md` (las tareas con su comprobación verifiable). **Nada avanza de fase sin aprobación
explícita del usuario.** `AGENTS.md` resume las reglas del repo y `MEMORY.md` guarda el estado
actual del trabajo.

## Datos y privacidad

Los pensums son documentos **públicos** publicados por la UDB; el dataset no contiene datos
personales ni credenciales. Tus notas se guardan únicamente en el `localStorage` de tu navegador,
asociadas a la clave de tu carrera, y no se envían a ningún servidor.
