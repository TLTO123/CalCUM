# Plan — Spec 003: Exportar y compartir el resultado como imagen

Estado: **implementada** (2026-10-07; cambio D6/D11 incorporado el 2026-10-08)

Objetivo: generar en el navegador un PNG con el resultado visible del C.U.M y entregarlo al
sistema para compartirlo o guardarlo, **sin dependencias nuevas y sin ninguna petición de red**.

## 1. Mapeo RF → piezas

| RF | Pieza responsable |
|---|---|
| RF-1, RF-2, RF-9 | `src/domain/exportar.ts` (`prepararTarjeta`) + `src/export/dibujar.ts` |
| RF-3, RF-7, RF-11 | `src/export/entregar.ts` (`canShare` → `share` → distinción fallo/cancelación → descarga) y manejo de error en `CumPanel.tsx`; la señal de "hubo diálogo" vive en `src/export/hoja.ts` |
| RF-4 | `CumPanel.tsx`: acción deshabilitada con el motivo al lado (decisión D9) |
| RF-5 | `CumPanel.tsx`: solo se invoca dentro del manejador del clic |
| RF-6 | No hay `fetch` en `src/`; el PNG sale del `canvas` local (se comprueba en el checklist) |
| RF-8, RNF-4 | `CumPanel.tsx`: mensajes en un `role="status"` con `aria-live`, teclado sobre el botón |
| RF-10 | Botón único dentro de la sección del panel |
| RNF-1 | Dibujo síncrono (un solo `fillText` por línea) + `canvas.toBlob()` asíncrono |
| RNF-2 | `src/export/dibujar.ts` rasteriza a **escala 2×** (decisión D8) |
| RNF-3 | `prepararTarjeta` solo copia carrera, plan, fecha y notas (test que no aparezcan otros campos) |
| RNF-5 | Flujo sin red (hereda RF-15 de la spec 001) |
| RNF-6 | Checklist: medir el peso del PNG generado |
| RNF-7 | `envolverTexto` con medidor real (D7) + tema fijo (D5) |

## 2. Archivos y responsabilidades

**Nuevos:**

| Archivo | Responsabilidad |
|---|---|
| `src/domain/exportar.ts` | **Funciones puras** (sin DOM, sin reloj): `prepararTarjeta`, `envolverTexto`, `nombreDeArchivo` |
| `src/export/dibujar.ts` | **Dibujo**: `dibujarTarjeta(ctx, tarjeta, tema)` sobre un `CanvasRenderingContext2D` que recibe por parámetro |
| `src/export/entregar.ts` | **Entrega**: `entregarImagen(blob, nombre, { navigator, descargar, hoja, ahora, plazo })` → `compartido` \| `guardado` \| `cancelado` \| `error` |
| `src/export/hoja.ts` | **Señal de diálogo**: `crearHoja(win, doc)` escucha `blur`/`visibilitychange` mientras `share()` está pendiente y responde `¿huboDialogo?()` |
| `src/export/tema.ts` | Constantes de la tarjeta (colores, tamaños, escala, tipografía) y `TEMA_CLARO` |
| `tests/exportar.test.ts`, `tests/dibujar.test.ts`, `tests/entregar.test.ts`, `tests/hoja.test.ts` | Pruebas con `node --test` sobre las piezas puras |

**Modificados:**

| Archivo | Cambio |
|---|---|
| `src/components/CumPanel.tsx` | Botón único de exportar/compartir, estados `inactivo → generando → listo/error` y mensaje `aria-live` |
| `src/app/estilos.css` | Estilos del botón y del mensaje (paleta existente: `#2e9e5b`, `#d05252`) |

No se toca `src/domain/cum.ts`, el store, el repositorio ni el contrato de datos: la spec 003 solo
añade una salida del resultado ya calculado.

## 3. Funciones puras y determinismo (P5)

```ts
prepararTarjeta(plan, resultado, hoy)  → Tarjeta   // hoy: { dd, mm, aaaa } inyectado, nunca new Date() aquí
envolverTexto(texto, anchoMax, medir)  → string[]  // medir inyectado: measureText en navegador, fijo en tests
nombreDeArchivo(tarjeta)               → string    // calcum-<slug>-<aaaa-mm-dd>.png
dibujarTarjeta(ctx, tarjeta, tema)     → void      // ctx inyectado → se prueba con un grabador
entregarImagen(blob, nombre, deps)     → ResultadoEntrega  // navigator y descargar inyectados
```

- `new Date()` y `document.createElement` viven solo en `CumPanel.tsx` (borde de la interfaz).
- Las funciones puras no tocan DOM, red ni reloj: así se prueban con `node --test`.

## 4. Algoritmo (pseudocódigo)

**Generación (en el clic):**

```
al pulsar el botón:
  si cursadas == 0 → no hacer nada (RF-4, el botón está deshabilitado)
  estado ← generando
  hoy    ← new Date()                      # único punto con reloj
  tarjeta← prepararTarjeta(plan, resultado, hoy)
  canvas ← createElement('canvas'); canvas ← 720×440 lógicos × escala 2
  ctx    ← canvas.getContext('2d')
  si ctx == null → estado ← error (RF-7)
  dibujarTarjeta(ctx, tarjeta, TEMA_CLARO)
  blob   ← await canvas.toBlob(…, 'image/png')
  si blob == null → estado ← error (RF-7)
  r      ← entregarImagen(blob, nombreDeArchivo(tarjeta), { navigator, descargar })
  estado ← listo, con el mensaje correspondiente a r
```

**Dibujo:**

```
dibujarTarjeta(ctx, tarjeta, tema):
  fondo ← roundRect(0, 0, ancho, alto) con borde suave          # tema claro fijo (D5)
  y ← margen (32)
  "TU C.U.M"            minúsculas altas, 12px, opacidad 0.7    # etiqueta
  valor                 72px bold, cifras tabulares → tarjeta.cum ?? "—"
  desglose              15px, opacidad 0.75                     # "1234 UM / 152 UV" o texto de estado vacío
  barra                 fondo redondeado 8px + relleno #2e9e5b con ancho = porcentaje
  conteo                14px → "N / M materias cursadas · A aprobadas · B reprobadas"
  --- separador tenue ---
  carrera               16px semibold, líneas de envolverTexto(texto, anchoDisponible, ctx.measureText)
  sede · plan           13px, opacidad 0.7
  pie                   12px, opacidad 0.6 → "CalCUM UDB · <fecha>" (alineado al pie)
```

**Entrega:**

```
entregarImagen(blob, nombre, { navigator, descargar, hoja, ahora, plazo }):
  archivo ← new File([blob], nombre, { type: 'image/png' })
  si no hay canShare o devuelve falso
      → descargar(blob, nombre) → 'guardado'                          # D10 (sin cambios)
  hoja.reiniciar()                                                    # empieza a escuchar foco (D14)
  inicio ← ahora()
  con tiempo límite corriendo (D15), esperar a share({ files: [archivo] }) y resolver:
      éxito                                    → 'compartido'
      plazo (5 s) vencido y nunca hubo diálogo  → descargar → 'guardado'      # RF-11
      rechaza con la hoja vista                 → AbortError ⇒ 'cancelado'   # D4 intacto
                                                  otro      ⇒ descargar
      rechaza sin hoja:
         AbortError + mensaje de cancelación + transcurrido ≥ 300 ms
                                               → 'cancelado'   # hoja dentro del navegador (Android)
         cualquier otro caso                    → descargar → 'guardado'     # RF-11
  si la descarga ya corrió por plazo, los asentamientos tardíos se ignoran (una sola entrega)
  si descargar lanza error → 'error' (RF-7)
  hoja.desinstalar() en todos los caminos de salida
```

El motivo de las dos señales (foco **y** tiempo/mensaje): un diálogo real **tarda en aparecer
milisegundos y roba el foco**; el fallo medido no abrió nada y esperó 30 018 ms. Un rechazo
instantáneo (<300 ms) no puede provenir de un diálogo que el usuario llegó a ver.

## 5. Interfaz

- **Entrada:** el botón vive dentro de `<section aria-label="Resultado del C.U.M">`, después del
  conteo, y recibe `plan` y `registros` que el panel ya tiene.
- **Etiqueta:** "Compartir resultado".
- **Sin nada cursada (RF-4):** botón `disabled` + texto explicativo: "Registra al menos una
  materia para compartir tu resultado." (no se oculta: así se descubre la función).
- **Estados:** `generando` (botón deshabilitado, texto "Generando imagen…"), `listo` ("Imagen
  lista: compartida" / "Imagen guardada" / "Compartida cancelada"), `error` ("No se pudo generar
  la imagen. Inténtalo de nuevo." en `role="alert"`).
- **Salida:** `File`/`Blob` PNG; el `<a download>` de fallback se crea y se revoca en el acto.
- **Anuncio:** el mensaje vive en un elemento `role="status" aria-live="polite"`; el error en
  `role="alert"` (RF-8, RNF-4).

## 6. Decisiones del plan (con la alternativa descartada)

Las decisiones de producto **D1–D5 están en `spec.md`** (contenido, acción única, canvas sin
dependencias, cancelar no descarga, tema claro fijo). Este plan añade las técnicas:

| # | Decisión | Descartada y por qué |
|---|---|---|
| D6 | **Lógica pura en `src/domain/exportar.ts` y capa DOM en `src/export/`** | Todo dentro de `CumPanel.tsx`: mezcla la lógica con la UI y obliga a montar React para probarla (P5) |
| D7 | **`envolverTexto` con un medidor inyectado** (navegador: `ctx.measureText`; tests: medidor fijo) | Cortar por número fijo de caracteres: se corta mal con nombres largos y con la tipografía real del sistema |
| D8 | **`canvas` creado en memoria a escala 2× (720×440 lógicos → 1440×880 px)** | `OffscreenCanvas`: no disponible en todos los navegadores; capturar el DOM (D3) ya quedó descartado |
| D9 | **Botón deshabilitado con el motivo** cuando no hay notas | Ocultar el botón: cumple RF-4 pero el usuario nunca se entera de que la función existe |
| D10 | **Comprobar `canShare({files})` antes de `share`, y fallback a `<a download>`** | Llamar `share` directo: en escritorio lanza una excepción poco clara en lugar de caer en la descarga |
| D11 | **Nombre `calcum-<slug-carrera>-<aaaa-mm-dd>.png`** | Nombre genérico: dos imágenes guardadas no se distinguen y el archivo compartido pierde contexto |
| D12 | **Tema como constante `TEMA_CLARO` en `src/export/tema.ts`** con comentario que apunta a `estilos.css` | Leer `getComputedStyle` del panel: depende del DOM, no se prueba en Node y la tarjeta saldría distinta según el sistema (D5) |
| D13 | **Un solo botón y un solo flujo**, sin configuración de tamaño ni de plantilla | Ajustes de resolución/tema en pantalla: más alcance, más tests y una decisión que el usuario no pide |
| D14 | **Distinguir "fallo" de "cancelación" por la señal de que hubo un diálogo**: mientras `share()` está pendiente se escucha el foco/visibilidad de la página; además, sin esa señal solo se acepta una cancelación con mensaje de cancelación y ≥300 ms | Clasificar solo por el texto del error (`AbortError`): el propio navegador usa `AbortError` tanto para "el usuario canceló" como para "no pude compartir" (caso medido: `Share failed` sin UI), y esa ambigüedad es justo lo que dejaba al usuario sin imagen |
| D15 | **Tiempo límite de 5 s sin diálogo** → se descarga sin esperar el rechazo del navegador | Esperar el rechazo natural: en el caso medido son **30 s** con el aviso clavado en "Generando imagen…". Plazo mayor (10 s): peor experiencia con el mismo resultado; menor (1 s): arriesga cortar hojas lentas |
| D16 | **La señal de diálogo vive en `src/export/hoja.ts`** con `win`/`doc` inyectados y oyentes simétricos (se desinstalan siempre) | Ponerlo dentro de `entregar.ts`: convertiría una pieza pura y fácil de probar en Node en una que depende del `window` global |

## 7. Estrategia de tests (`node --test`)

| Test | Cubre | Caso |
|---|---|---|
| `tests/exportar.test.ts` | RF-1, RF-2, RF-9, RNF-3 | `prepararTarjeta` con `hoy` fija ⇒ dos corridas idénticas; valor "8.50"; carrera/sede/plan/fecha presentes; sin campos personales; `cum` null ⇒ indicador vacío; `nombreDeArchivo` en minúsculas sin acentos ni caracteres raros |
| `tests/exportar.test.ts` (envolver) | RNF-7 | Con medidor falso, nombre largo ⇒ varias líneas, ninguna por encima del ancho máximo; texto corto ⇒ una sola línea |
| `tests/dibujar.test.ts` | RF-1, RF-2, RF-9, RNF-2, RNF-7 | `ctx` grabador: se pintan valor, desglose, conteo, carrera y fecha; todo `fillText` dentro de los límites; barra al 0 %, al 50 % y al 100 % con el ancho correcto; escala 2× aplicada |
| `tests/entregar.test.ts` | RF-3, RF-7, RF-5 | `navigator` falso: soportado ⇒ `share` llamado con el archivo y nombre correctos; sin `canShare` ⇒ descarga; `AbortError` **con hoja vista** ⇒ `cancelado` **sin** descarga (D4); otro error ⇒ descarga; descarga rota ⇒ `error` |
| `tests/entregar.test.ts` (RF-11) | RF-11 | `AbortError: "Share failed"` **sin hoja** (rechazo tardío) ⇒ descarga `guardado`; rechazo **instantáneo** sin hoja ⇒ descarga (no pudo haber diálogo); `AbortError: "Share canceled"` **sin hoja** a los 900 ms ⇒ `cancelado` (hoja dentro del navegador); promesa **pendiente** pasado el plazo ⇒ descarga y, si asienta después, **no** se entrega dos veces |
| `tests/hoja.test.ts` (nuevo) | RF-11, D14 | Con `win`/`doc` falsos: sin eventos ⇒ `false`; `blur` ⇒ `true`; `visibilitychange` a `hidden` ⇒ `true`; no se reinicia al volver; `desinstalar()` deja el documento sin oyentes |
| Checklist manual (navegador) | RF-4, RF-5, RF-6, RF-8, RF-10, RNF-1, RNF-4, RNF-5, RNF-6 | Botón deshabilitado con motivo; 3 toques; teclado y `aria-live`; 0 peticiones de red al exportar; peso del PNG < 1 MB; tiempo < 500 ms; exportar en dos carreras distintas |
| Reproducción del fallo (navegador) | RF-11 | Con el Chrome de escritorio donde `share()` falla sin UI: el flujo termina en **"Imagen guardada en tus descargas."** con el archivo descargado, nunca en "Compartir cancelado" sin archivo |

Criterio: **rojo → verde → marcar tarea → parar**, y los **118 tests existentes siguen en verde**.

## 8. Riesgos y mitigaciones

1. **Compartir en iOS/Safari** exige el gesto del usuario y puede rechazar el `File` tras un
   `await`: si `share` falla por cualquier motivo distinto de cancelar, se cae a la descarga
   (D10) y el flujo nunca termina en un callejón sin salida.
2. **Medida de texto distinta por sistema operativo**: se mide con `measureText` real en el
   navegador; las pruebas de Node usan un medidor falso y solo validan la lógica de corte (D7).
3. **Peso del bundle**: sin dependencias nuevas el crecimiento debe ser de pocos kB; se revisa con
   `npm run build` (hoy 134,7 kB gzip).
4. **`canvas` sin contexto o `toBlob` nulo**: ambos caminos terminan en el estado `error` con
   mensaje recuperable (RF-7), nunca en una imagen a medias.
5. **Tamaño y velocidad del PNG**: 1440×880 con colores planos comprime muy por debajo de 1 MB;
   se mide en el checklist (RNF-1 y RNF-6).
6. **Trabajo estimado**: ~8 tareas (modelo puro → dibujo → entrega → panel → accesibilidad →
   verificación en navegador → checklist de cierre). Si se superan las 10, se propone partir la
   spec antes de seguir implementando.
7. **La hoja de compartir puede no robar foco** en algunos navegadores (hojas renderizadas dentro
   de la propia pestaña): se mitiga con la segunda señal (mensaje de cancelación + ≥300 ms + plazo
   de 5 s). Si aun así se descargara tras un cancelar real, el perjuicio es mínimo (el usuario se
   encuentra el PNG en Descargas) y nunca queda sin la imagen, que es lo que ocurría antes.
8. **Doble entrega si el navegador resuelve tarde** (ya descargado por plazo y luego `compartido`):
   se ignora todo asentamiento posterior a la primera entrega, con un único punto de decisión.
