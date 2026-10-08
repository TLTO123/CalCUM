# Tareas — Spec 003: Exportar y compartir el resultado como imagen

Estado: aprobadas (2026-10-07)

Regla: una tarea a la vez → test en rojo → código → `node --test` en verde → marcar → parar.
Cobertura mínima: 8 tareas, todas con comprobación verificable. Los **118 tests existentes** deben
seguir en verde en cada tarea.

- [x] **T1. Modelo puro de la tarjeta.** RF-1, RF-2, RF-9, RNF-3, RNF-7
  - Hecho cuando: existe `src/domain/exportar.ts` con `prepararTarjeta(plan, resultado, hoy)`,
    `envolverTexto(texto, anchoMax, medir)` y `nombreDeArchivo(tarjeta)`; `tests/exportar.test.ts`
    cubre: dos corridas con el mismo `hoy` ⇒ tarjeta idéntica; `cum` con decimales ⇒ `"8.50"`;
    `cum` null ⇒ indicador vacío; nombre, sede, plan y fecha presentes; ningún campo personal en
    la tarjeta; nombre de archivo en minúsculas sin acentos ni caracteres raros; con un medidor
    falso, el nombre de "Lic. en Idiomas con Especialidad en Lenguas Extranjeras" sale partido en
    varias líneas, ninguna por encima del ancho máximo. Rojo → verde, `typecheck` en verde.
  - ✅ 2026-10-07: **rojo → verde**. `tests/exportar.test.ts` (15 tests) escrito primero
    (`ERR_MODULE_NOT_FOUND`) y `src/domain/exportar.ts` después, con `prepararTarjeta`,
    `formatoFecha`, `pieDeTarjeta` (ayudante del pie que pide el pseudocódigo del plan §4),
    `nombreDeArchivo` (slug NFD + `calcum-<slug>-<aaaa-mm-dd>.png`, D11) y `envolverTexto` con
    medidor inyectado (D7). `npm test` → **133 pass / 0 fail** (118 + 15) · `tsc` → 0.

- [x] **T2. Capa de dibujo sobre `canvas`.** RF-1, RF-2, RF-9, RNF-2, RNF-7
  - Hecho cuando: existen `src/export/tema.ts` (`TEMA_CLARO`, escala 2, tamaños) y
    `src/export/dibujar.ts` con `dibujarTarjeta(ctx, tarjeta, tema)`; `tests/dibujar.test.ts` usa un
    `ctx` grabador y verifica que se pintan valor, desglose, conteo, carrera y fecha; que **ningún**
    `fillText` cae fuera de los límites del lienzo; que la barra mide 0 %, 50 % y 100 % según el
    avance; y que el lienzo lógico es 720×440 rasterizado a 2× (1440×880). Rojo → verde.
  - ✅ 2026-10-07: **rojo → verde** (`tests/dibujar.test.ts`, 9 tests). `src/export/tema.ts` con
    `TEMA_CLARO` (D5/D12: colores y tipografía como constantes, espejo de `estilos.css`) y
    `src/export/dibujar.ts` con la interfaz `Lienzo` (D6: subconjunto de
    `CanvasRenderingContext2D` que un contexto real cumple —comprobado en un test de tipos— y que
    el grabador de los tests implementa). El grabador mide 8 px/carácter y valida textos
    presentes, límites de todos los `fillText`, barra 0/50/100 %, `scale(2,2)`, paleta clara,
    `save`/`restore` balanceados y pintura determinista. Nota: un test falló primero por un dato
    mío mal calculado (22/43 = 51 %, no 50 %) y se corrigió el caso, no el código.
    `npm test` → **142 pass / 0 fail** · `tsc` → 0.

- [x] **T3. Entrega: compartir con fallback a descarga.** RF-3, RF-5, RF-7
  - Hecho cuando: existe `src/export/entregar.ts` con `entregarImagen(blob, nombre, deps)` y
    `tests/entregar.test.ts` cubre con `navigator` falso las cuatro rutas: con `canShare` ⇒ se
    llama `share` con el `File` y su nombre correctos y devuelve `compartido`; sin soporte ⇒
    `descarga` y `guardado`; `AbortError` ⇒ `cancelado` **sin** descargar (D4); cualquier otro
    error ⇒ descarga; y si la descarga también falla ⇒ `error`. Rojo → verde.
  - ✅ 2026-10-07: **rojo → verde** (`tests/entregar.test.ts`, 9 tests). `src/export/entregar.ts`
    con `ResultadoEntrega = compartido | guardado | cancelado | error`, la interfaz
    `NavigatorCompartir` (un `Navigator` real la cumple —test de tipos—) y las dependencias
    `navigator`/`descargar` **inyectadas** (D6). Rutas cubiertas: `canShare` ⇒ `share` con
    `File` cuyo nombre y tipo son los pedidos; sin `canShare` o con `false` ⇒ descarga;
    `AbortError` ⇒ `cancelado` **sin** descarga (D4); otro error de `share` ⇒ descarga (D10);
    `canShare` que lanza ⇒ sigue sin romper (RF-7); descarga rota ⇒ `error` como valor, nunca
    lanzando (RF-7); sin invocación explícita ⇒ nada actúa (RF-5). Nota: el primer rojo falló
    por un error propio (`const { entorno } = entorno(...)` en zona muerta) y se renombró el
    helper a `entornoPrueba`. `npm test` → **151 pass / 0 fail** · `tsc` → 0.

- [x] **T4. Botón y flujo en el panel.** RF-1, RF-4, RF-5, RF-10
  - Hecho cuando: `src/components/CumPanel.tsx` tiene el botón "Compartir resultado" que orquesta
    `new Date()` → `prepararTarjeta` → `canvas` → `toBlob` → `entregarImagen`; con **0** materias
    cursadas el botón está `disabled` y muestra el motivo al lado; sin contexto de `canvas` o con
    `toBlob` nulo el flujo termina en estado `error` (nunca entrega una imagen a medias);
    `src/app/estilos.css` lleva los estilos del botón y del mensaje; `npm run build` en verde.
  - ✅ 2026-10-07: **hecho**. `CumPanel.tsx` con `EstadoExportacion = inactivo | generando |
    listo | error`, el manejador `alCompartir` (guarda `if (sinNotas || generando) return`, RF-5)
    y los tres bordes de DOM del flujo (`hoyDe`, `generarPng` con lienzo en memoria
    720×440×2, y `descargarLocal` con `<a download>` efímero que se revoca tras un ciclo porque
    Firefox aborta si se revoca en el acto). Los caminos rotos (`getContext` nulo o `toBlob` nulo)
    lanzan y caen al estado `error` con mensaje recuperable (RF-7); el resto de la interfaz sigue
    usable porque el estado vive en el panel. `estilos.css`: `.panel-cum__acciones`,
    `__exportar` (hover/deshabilitado/`focus-visible` con acento `#2e9e5b`) y `__aviso`. Verificado
    en navegador: botón `disabled` con el motivo visible y consola sin errores; `npm test` →
    **151 pass / 0 fail** · `tsc` → 0 · `npm run build` → **0** (136,66 kB gzip, +1,94 kB).

- [x] **T5. Estados, teclado y anuncio.** RF-8, RNF-4
  - Hecho cuando: los estados `generando` / `listo` / `error` tienen texto visible; el mensaje de
    éxito vive en un `role="status"` con `aria-live="polite"` y el de error en `role="alert"`; el
    botón es alcanzable y operable con Enter/Espacio y muestra foco visible; checklist manual en
    navegador: se exporta de principio a fin **solo con teclado** y un lector de pantalla anuncia
    el resultado.
  - ✅ 2026-10-07: **hecho** (checklist manual; sin tests nuevos porque D3 prohíbe dependencias y
    `node --test` no tiene DOM). `CumPanel.tsx`: mensaje con `role="status"` + `aria-live="polite"`
    en éxito y `role="alert"` en error, con `key={estado}` para que el nodo se **recree** al cambiar
    de rol (si solo cambia el `role`, muchos lectores no vuelven a anunciar); el botón deshabilitado
    enlaza con `aria-describedby="panel-cum__motivo"` el motivo, expuesto por el árbol de
    accesibilidad como
    `button "Compartir resultado" description="Registra al menos una materia…" disableable disabled`;
    `estilos.css` añade `.panel-cum__aviso--error`. Checklist: desde `body`,
    `Tab` → 1 Tipo, 2 Sede, 3–7 carreras, **8 Compartir resultado** (el deshabilitado se salta);
    `Enter` en una materia abre el modal con foco en `input type="number"`, `8.5` + `Enter` guarda
    (C.U.M 8.50), `Tab` ×8 hasta el botón y `Enter` → "Imagen guardada en tus descargas." en
    `role="status"`; `Espacio` también dispara el flujo; anillo de foco `solid rgb(46,158,91)`
    (`#2e9e5b`); con `toBlob` saboteado el mensaje pasa a "No se pudo generar la imagen.
    Inténtalo de nuevo." en `role="alert"` y la consola queda limpia. **Hallazgo corregido:** al
    deshabilitar el botón durante `generando` el navegador le quitaba el foco (quedaba en `body`) →
    un `useEffect` se lo devuelve al llegar a `listo`/`error`; verificado `activeElement === botón`.
    Observación fuera de alcance: al guardar/eliminar una nota desde el modal el foco cae en `body`
    (herencia de la spec 001). No hay lector de pantalla en el entorno: el anuncio se comprobó por
    los roles/`aria-live` y el árbol de accesibilidad. `npm test` → **151 pass / 0 fail** · `tsc` → 0.

- [x] **T6. Verificación en navegador: cotejos, sin red, tamaño y tiempo.** RF-6, RF-9, RNF-1, RNF-5, RNF-6
  - Hecho cuando: se exportan **3 resultados distintos** (carrera presencial con nota decimal,
    carrera de UDB Virtual, y una de nombre largo) y cada PNG coincide con lo que está en pantalla
    (valor, desglose, avance, carrera y fecha); el export se hace con DevTools en **Offline** y la
    pestaña Network registra **0 peticiones**; el PNG pesa **< 1 MB** y se genera en **< 500 ms**;
    se comprueba además que compartir no disponible termina en descarga y que cancelar no descarga.
  - ✅ 2026-10-07: **hecho**. Tres PNG capturados leyendo el `Blob` con un gancho en `toBlob`
    (sin alterar el flujo) y cotejados uno a uno contra la captura de pantalla completa:
    1. *Ing. en Ciencias de la Computación* (Soyapango, plan-2024, notas 10/9.4/9.5/8.2) →
       **9.27**, `148.4 UM / 16 UV`, 4/40 · 4 aprobadas · 0 reprobadas — **83,4 kB, 64,6 ms**;
    2. *Lic. en Administración de Empresas (a distancia)* (**UDB Virtual**) → **7.80**,
       `31.2 UM / 4 UV`, 1/44 — **80,4 kB**; en pantalla la materia GEA901 muestra 7.8 y el
       panel 7.80, igual que la tarjeta;
    3. *Licenciatura en Idiomas con Especialidad en la Adquisición de Lenguas Extranjeras*
       (**nombre de 81 caracteres**) → **8.35**, `66.8 UM / 8 UV`, 1/34 — **87,1 kB, 74,7 ms**;
       el nombre entra completo en la tarjeta, sin cortar.
    Los tres son PNG válidos (firma `89504e470d0a1a0a`) de **1440×880** y coinciden con la
    pantalla en valor, desglose, barra de avance, conteo, carrera, sede (Campus Soyapango /
    UDB Virtual) y plan; la fecha del pie es **07/10/2026 = hoy**. La tarjeta sale siempre en
    **tema claro** aunque la página esté oscura (D5).
  - ✅ **Offline:** con `emulate networkConditions: Offline` (`navigator.onLine === false`) la
    exportación genera el mismo PNG (89 193 B) y la pestaña Network pasa de **32 a 32 peticiones
    (0 nuevas)**. La pestaña quedó limpia tras recargar (stubs de `navigator` deshechos).
  - ✅ **Tamaño y tiempo:** 80,4–87,1 kB (**< 1 MB**) y **64,6 / 74,7 / 95,8 ms (< 500 ms)**.
    *Cómo se midió y salvedad:* en este Chrome automatizado solo la **primera** codificación de
    cada carga es rápida; las siguientes tardan ~1,03 s. Se aisló el efecto: un lienzo de
    100×100 también tarda 1.010 ms, el `toDataURL` del mismo lienzo (mismo codificador) 27 ms,
    `setTimeout(0)` 0 ms y `requestAnimationFrame` 1 ms → el retardo lo pone el navegador en el
    callback de `toBlob`, no la app (el dibujo ocupa ≤ 1 ms y cada medida de < 500 ms es de una
    carga recién abierta, como lo haría un usuario).
  - ✅ **Entrega:** con `share` rechazando `AbortError` → "Compartir cancelado; tu resultado sigue
    en pantalla." en `role="status"` con **0** anclas de descarga (D4); con `canShare` en `false`
    → "Imagen guardada en tus descargas." con **1** ancla y nombre
    `calcum-licenciatura-en-idiomas-…-2026-10-07.png` (D11). Ambas rutas ocurrieron también de
    forma natural en las tres exportaciones. Consola sin errores.
  - Observaciones: (a) con la red caída `navigator.share()` quedó **pendiente** del navegador y el
    aviso se mantuvo en "Generando imagen…" hasta que volvió la conexión, en que se resolvió en
    "cancelado" — la app no hizo ninguna petición, es comportamiento de la API de compartir;
    (b) el `confirm` de cambio de carrera (`src/app/montaje.tsx:64`) se abrió entre dos llamadas y
    contaminó una primera medida (6,7 s) → se descartó y se volvió a medir limpia;
    (c) hay una clave legada de 3 segmentos en `localStorage` de pruebas antiguas que la app
    ignora (lee la clave de 4 segmentos).

- [x] **T7. Regresión completa y peso del bundle.** RNF-1
  - Hecho cuando: `npm test` en verde (los 118 existentes más los nuevos), `npm run typecheck` sin
    errores y `npm run build` en verde con un crecimiento de **≤ 5 kB gzip** sobre los 134,7 kB
    actuales (sin dependencias nuevas, D3).
  - ✅ 2026-10-07: **en verde**. `npm test` → **151 pass / 0 fail** (118 de las specs 001/002 +
    33 nuevos: 15 `exportar` + 9 `dibujar` + 9 `entregar`) · `npm run typecheck` (`tsc --noEmit`)
    → **0** · `npm run build` (`vite build`, 131 módulos) → **136,75 kB gzip** de JS
    (+**2,05 kB** sobre 134,7 kB, límite 5 kB) con CSS 1,52 kB y HTML 0,40 kB gzip. `package.json`
    sin tocar: **cero dependencias nuevas** (D3). El aviso de *chunk* > 500 kB es preexistente
    (el bundle lleva el dataset) y no es de esta spec.

- [x] **T8. Checklist de cierre y documentación.** RF-4, RF-5, RF-6, RF-8, RF-10, RNF-4 + criterios de finalización
  - Hecho cuando: `tasks.md` tiene su **checklist de cierre** con la evidencia por RF y RNF y los
    criterios de finalización de `spec.md` marcados; `README.md` documenta la función de
    compartir/exportar; `MEMORY.md` queda actualizado con el estado y los próximos pasos.
  - ✅ 2026-10-07: **hecho**. Checklist de cierre añadido más abajo: **10 RF + 7 RNF + 5 criterios
    de finalización**, todos marcados con su evidencia (tests, cotejos y medición de T6–T7) y dos
    salvedades explícitas (teclado verificado en escritorio; el reparto de tiempos de `toBlob` en
    Chrome automatizado). `spec.md` → `Estado: implementada (2026-10-07)`. `README.md`: sección
    **"Exportar y compartir tu resultado"** (contenido de la tarjeta, compartir con fallback,
    cancelación, deshabilitado sin notas, sin red y sin datos personales) + estructura del repo
    (`src/export/`, spec 003) y recuento de tests (151). `MEMORY.md` rehecho en **49 líneas** con
    el cierre de la spec, las decisiones D1–D13 y los aprendizajes nuevos.

---

## Checklist de cierre (T8) — 2026-10-07

### Requisitos funcionales

- [x] **RF-1 · imagen con el resultado visible.** `tests/exportar.test.ts` (valor a 2 decimales con
  indicador vacío incluido) + `tests/dibujar.test.ts` (valor, desglose, conteo, carrera y fecha
  pintados) + cotejo en navegador T6: 9.27 · 7.80 · 8.35 con `148.4 UM / 16 UV`, `31.2 UM / 4 UV`,
  `66.8 UM / 8 UV`, `4/40`, `1/44`, `1/34`, aprobadas y reprobadas.
- [x] **RF-2 · identificación de la carrera y fecha.** Test "nombre, sede, plan y fecha
  presentes" y "las tres sedes tienen etiqueta legible"; en T6 las tres tarjetas muestran
  `Campus Soyapango · plan-2024`, `UDB Virtual · plan-2024` y pie `CalCUM UDB · 07/10/2026` (= hoy).
- [x] **RF-3 · compartir con fallback y cancelación.** `tests/entregar.test.ts` (9 tests: las cuatro
  rutas) y en navegador T6: `canShare:false` ⇒ "Imagen guardada en tus descargas." con el archivo
  `calcum-…-2026-10-07.png`; `AbortError` ⇒ "Compartir cancelado; tu resultado sigue en pantalla."
  con **0** anclas de descarga (D4).
- [x] **RF-4 · sin materias cursadas no se ofrece.** Botón `disabled` con el motivo visible junto a
  la acción (T4) y enlazado con `aria-describedby` (árbol: `button "Compartir resultado"
  description="Registra al menos una materia…" disabled`, T5).
- [x] **RF-5 · solo bajo petición explícita.** Test "nada se comparte ni se descarga sin una
  invocación explícita" + guardas `if (sinNotas || generando) return` en `alCompartir` (T4);
  nunca se disparó solo en ninguna de las verificaciones de navegador.
- [x] **RF-6 · todo en el dispositivo.** T6 con DevTools **Offline**: `navigator.onLine === false`,
  Network **32 → 32 peticiones (0 nuevas)**, el PNG se genera igual.
- [x] **RF-7 · fallo con mensaje recuperable.** T4: `getContext`/`toBlob` nulos ⇒ estado `error`
  (nunca una imagen a medias); T3: `error` como valor, nunca lanzando; T5: con `toBlob`
  saboteado ⇒ "No se pudo generar la imagen. Inténtalo de nuevo." en `role="alert"` y se puede
  reintentar.
- [x] **RF-8 · interfaz usable y anunciada.** T5: estados con texto visible, `role="status"` en el
  éxito y `role="alert"` en el error con `key={estado}`, foco devuelto al botón (`activeElement`
  verificado) y consola limpia; el flujo es asíncrono y no bloquea la interacción.
- [x] **RF-9 · la imagen es el estado visible.** Tests "la tarjeta muestra lo que el panel; no
  recalcula nada" y "determinismo: dos corridas con el mismo `hoy` ⇒ tarjeta idéntica"; T6 cotejó
  **3** imágenes contra su captura de pantalla (los 3 casos pedidos).
- [x] **RF-10 · única acción, operable con teclado.** D2: un solo botón "Compartir resultado";
  T5: `Tab` hasta el botón (el deshabilitado se salta) y `Enter`/`Espacio` disparan el flujo.
  *Respaldo:* verificado en escritorio; es un `<button>` nativo con el mismo DOM y estilos en móvil.

### Requisitos no funcionales

- [x] **RNF-1 · < 500 ms sin bloquear.** T6: **64,6 / 74,7 / 95,8 ms** de extremo a extremo
  (dibujo ≤ 1 ms); *salvedad medida*: en este Chrome automatizado solo la primera codificación de
  cada carga es rápida y el navegador retiene las siguientes ~1,03 s (`toDataURL` del mismo lienzo:
  27 ms ⇒ el retardo es del navegador en el callback de `toBlob`).
- [x] **RNF-2 · densidad 2×.** Test "el lienzo lógico es 720×440 y se rasteriza a escala 2×"; T6:
  los tres PNG miden **1440×880**.
- [x] **RNF-3 · sin datos personales.** Test "la tarjeta no arrastra datos personales ni campos de
  más": solo carrera, sede, plan, fecha y las notas registradas.
- [x] **RNF-4 · teclado + lectores de pantalla.** Checklist completo de T5 (recorrido solo con
  teclado, anillo de foco `#2e9e5b`, roles/`aria-live` y árbol de accesibilidad). No hay lector de
  pantalla en el entorno: el anuncio se comprobó por roles.
- [x] **RNF-5 · sin conexión.** T6: exportación completa con la red emulada en Offline.
- [x] **RNF-6 · < 1 MB.** T6: **80,4 / 83,4 / 87,1 kB**.
- [x] **RNF-7 · tipografía, paleta clara y nombres largos.** Tests "todos los textos usan la
  tipografía y la paleta clara de la app" y `envolverTexto` con el nombre de 81 caracteres partido
  en líneas dentro del ancho; T6: la tarjeta sale **clara** aunque la página esté oscura (D5) y el
  nombre de la Licenciatura en Idiomas aparece completo, sin cortar.

### Criterios de finalización de `spec.md`

- [x] Imagen en **3 toques o menos** desde el panel: el botón está en el panel de resultado y un
  toque basta (comparte o, sin soporte, descarga).
- [x] La imagen coincide con la pantalla en **3 casos de cotejo** (T6: presencial con decimal,
  UDB Virtual, nombre largo).
- [x] Generación **sin ninguna petición de red** (T6: Offline, 32 → 32).
- [x] Compartir no disponible ⇒ **PNG guardable**, no un error (T6 caso B).
- [x] `npm test` en verde (**151 pass / 0 fail**) y `npm run typecheck` sin errores (**0**) — T7.

### Cierre administrativo

- [x] `spec.md` pasa a `Estado: implementada (2026-10-07)`.
- [x] `README.md` documenta la función de compartir/exportar.
- [x] `MEMORY.md` actualizado.

Si al dividir el trabajo se superan las 10 tareas, propongo partir la spec antes de seguir
implementando.
