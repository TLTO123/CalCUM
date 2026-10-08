# Spec 003 — Exportar y compartir el resultado como imagen

Estado: **implementada** (2026-10-07; cambio D6/D11 incorporado el 2026-10-08)

## Contexto y objetivo

Las specs 001 y 002 dejaron la calculadora funcional y con el dataset real de las 59 carreras: el
estudiante ya ve su C.U.M en vivo, pero **no puede llevárselo a ningún lado**. En la práctica, el
resultado se comparte por WhatsApp o se guarda como captura hecha a mano, que recorta el panel, no
incluye la carrera y se ve distinto en cada dispositivo.

Esta spec entrega la **exportación del resultado como imagen PNG, generada en el propio
dispositivo**, y su **compartición** sin pasar por ningún servidor: la decisión de producto tomada
en la spec 001 y explícitamente diferida a esta ("Exportar o compartir el resultado como imagen
(spec 003)").

Por qué importa: es la única función que hace que el dato **salga** del dispositivo (P6). Por eso
tiene que ser una acción explícita del usuario, sin red y sin identificadores personales.

## Usuarios

- **Estudiante UDB** que quiere guardar su C.U.M o enviarlo a un familiar, compañero o tutor.
- No hay usuarios administradores ni autenticación.

## Historias de usuario

- HU-1. Como estudiante, quiero exportar mi resultado como una imagen nítida con mi carrera, para
  guardarlo o mandarlo por mensaje sin hacer una captura a mano.
- HU-2. Como estudiante, quiero compartir la imagen con la app que elija el sistema, para enviarla
  sin primero guardarla y buscarla en el archivo.
- HU-3. Como estudiante de una carrera con nombre largo, quiero que el texto de la imagen no se
  corte, para que se lea completa al compartirla.
- HU-4. Como usuario, quiero que la imagen se genere en mi dispositivo y sin conexión, para que mi
  resultado no se suba a ningún servidor.
- HU-5. Como usuario sin nada cursado, quiero que el sistema no me ofrezca exportar un resultado
  vacío.

## Definiciones

- **Exportar**: generar un archivo `PNG` en el dispositivo y guardarlo.
- **Compartir**: entregar ese mismo `PNG` a otra aplicación del dispositivo mediante el sistema
  operativo, sin que el proyecto intervenga en a dónde va.
- **Acción única**: el panel ofrece **un solo botón** que intenta compartir y, si no es posible,
  descarga el PNG. No hay dos botones (decisión D2).
- **Resultado**: el contenido visible del panel de C.U.M: valor a 2 decimales, `ΣUM / ΣUV`, avance
  `cursadas / total`, aprobadas y reprobadas, más la identificación de la carrera.
- **Estado visible**: exactamente lo que la app muestra en ese instante; la imagen no calcula nada
  por su cuenta.

## Requisitos funcionales

- RF-1: CUANDO el usuario tiene al menos una materia cursada y activa la acción de exportar y
  compartir, EL SISTEMA genera una imagen PNG con el resultado visible: C.U.M a 2 decimales (o el
  indicador vacío), `ΣUM / ΣUV`, `cursadas / total`, aprobadas y reprobadas.
- RF-2: La imagen incluye la identificación de la carrera (nombre, sede y plan vigente) y la fecha
  de generación, de modo que al compartirla se entienda de dónde sale y de cuándo es.
- RF-3: CUANDO el usuario activa la acción, EL SISTEMA entrega el PNG a la aplicación que el
  usuario elija mediante el sistema operativo; SI el navegador **no lo permite o no consigue
  abrir el compartido**, ENTONCES el sistema **descarga** el mismo PNG como archivo y no pierde el
  resultado. SI el usuario **cancela un diálogo que sí llegó a mostrarse**, ENTONCES el sistema no
  hace nada más: no descarga y el resultado sigue en pantalla.
- RF-4: SI no hay ninguna materia cursada, ENTONCES EL SISTEMA no ofrece exportar ni compartir, y
  explica el motivo junto a la acción.
- RF-5: EL SISTEMA solo genera o comparte la imagen cuando el usuario lo pide expresamente; nunca
  de forma automática ni al cambiar de carrera.
- RF-6: CUANDO se genera la imagen, EL SISTEMA la produce íntegramente en el dispositivo, sin
  peticiones de red y sin enviar el resultado a ningún servicio.
- RF-7: SI la generación de la imagen falla, ENTONCES EL SISTEMA muestra un mensaje de error
  recuperable y no entrega una imagen incompleta ni borra el resultado.
- RF-8: MIENTRAS la imagen se genera, EL SISTEMA mantiene usable la interfaz y anuncia el
  resultado a los lectores de pantalla.
- RF-9: La imagen refleja exactamente el estado visible: mismo valor redondeado a 2 decimales,
  mismos conteos y misma carrera (si el usuario cambia de carrera antes de exportar, se exporta la
  que está en pantalla).
- RF-10: EL SISTEMA ofrece una **única acción** de exportar/compartir desde el panel de resultado,
  operable con teclado en móvil y en escritorio.
- RF-11: SI el intento de compartir termina en error **sin que al usuario se le haya presentado un
  diálogo de compartir que pudiera cancelar** (p. ej. el navegador anuncia que puede compartir pero
  no ofrece destinos ni puede abrir la hoja del sistema), ENTONCES EL SISTEMA **descarga** el PNG y
  lo anuncia como guardado, de modo que el resultado nunca se pierda. SOLO se trata como
  cancelación —y por tanto sin descarga, RF-3— el caso en que el usuario llegó a ver el diálogo y
  lo cerró.

## Requisitos no funcionales

- RNF-1: La imagen se genera en menos de 500 ms percibidos en un dispositivo móvil de gama baja,
  sin bloquear la interacción con la app.
- RNF-2: El PNG se rasteriza a densidad de al menos 2× para que el texto se lea nítido en pantallas
  retina y al ampliarlo en un chat.
- RNF-3: El contenido de la imagen no incluye datos personales (no hay cuenta, ni nombre, ni correo,
  ni identificadores del dispositivo): solo carrera, plan, fecha y las notas que el propio usuario
  registró (P6).
- RNF-4: El flujo completo (panel → exportar/compartir) es operable solo con teclado y anunciado a
  lectores de pantalla (RNF-2 de la spec 001).
- RNF-5: El flujo funciona sin conexión después de cargar la página una vez (RF-15 de la spec 001).
- RNF-6: El tamaño del PNG no supera 1 MB, para que el compartido sea rápido en datos móviles.
- RNF-7: El texto de la imagen usa la tipografía de la app y su **paleta en versión clara** (fondo
  claro, texto oscuro, mismos acentos), y soporta nombres de carrera largos sin cortarse.

## Casos límite

1. 0 materias cursadas → la acción no está disponible (RF-4).
2. Navegador o sistema sin API de compartir (p. ej. Firefox o Safari en escritorio) → fallback a
   guardar el PNG.
3. El usuario cancela el diálogo de compartir → nada se pierde, el resultado sigue en pantalla.
4. Nombre de carrera largo ("Lic. en Idiomas con Especialidad en Lenguas Extranjeras") → el texto
   se ajusta, no se corta ni se sale de la imagen.
5. C.U.M con decimales (8.25) → en la imagen aparece 8.25, igual que en el panel.
6. 100 % de materias cursadas → la barra de progreso se muestra llena, sin desbordes.
7. El usuario cambia de carrera y exporta → se exporta la carrera visible, con sus propias notas.
8. Se exporta dos veces seguidas → ambas imágenes se guardan; el nombre del archivo identifica
   carrera y fecha.
9. Móvil de 360 px → el botón de exportar/compartir y el panel caben sin desplazamiento
   horizontal (RNF-3 de la spec 001).
10. Sin soporte de canvas en el navegador → mensaje de error recuperable (RF-7).
11. El navegador **anuncia** `share` pero no puede abrir la hoja de compartir (escritorio Windows
    sin destinos, sesión controlada por herramientas, Windows sin experiencia de compartir) → el
    intento falla pasados varios segundos **sin ningún diálogo visible** y el PNG se **descarga**;
    no se muestra "cancelado", que dejaría al usuario sin la imagen (RF-11).

## Fuera de alcance

- Exportar el pensum completo con la lista de materias cursadas y sus notas (decidido en D1: la
  imagen es solo el panel de resultado).
- Compartir texto plano, PDF o capturar toda la página de la app.
- Subir la imagen a un servidor o generar un enlace público (P6 y RF-16 de la spec 001).
- Dos botones independientes para compartir y para guardar (decidido en D2: es una sola acción).
- Seguir el tema oscuro del sistema en la imagen (decidido en D5: la tarjeta es de tema claro
  fijo).
- Editor de imagen (cambiar colores, añadir logo o firma).
- Posgrado, autenticación, backend y proyecciones ("¿qué nota necesito?").

## Criterios de finalización

- Un estudiante obtiene la imagen de su resultado en **3 toques o menos** desde el panel, en móvil
  y en escritorio.
- La imagen coincide con lo que se ve en pantalla (valor, desglose, avance y carrera) en al menos
  los 3 casos de cotejo manual.
- La generación ocurre sin ninguna petición de red y sin salir del dispositivo.
- Con el servicio de compartir no disponible, el flujo termina en un PNG guardable, no en un error.
- Cuando el navegador no puede abrir el compartido, el usuario termina con el **PNG en sus
  descargas** y un mensaje de "guardado", nunca con un "cancelado" sin archivo (RF-11).
- `npm test` en verde (incluida la lógica que prepara el contenido de la imagen) y
  `npm run typecheck` sin errores.

## Decisiones de clarificación (2026-10-07, aprobadas por el usuario)

- **D1 → contenido de la imagen: solo el panel de resultado.** La tarjeta lleva C.U.M, desglose
  `ΣUM/ΣUV`, avance, aprobadas/reprobadas, carrera + sede + plan y fecha. El listado de materias
  con sus notas queda fuera: reduce lo que sale del dispositivo (P6, RNF-3) y se lee mejor en un
  chat. Alternativa descartada: tarjeta larga con las notas de cada materia.
- **D2 → una sola acción en el panel.** El botón intenta compartir con el sistema y, si el
  navegador no lo soporta o el usuario cancela, descarga el PNG. Alternativa descartada: dos
  botones ("Compartir" y "Guardar"), que ocupan espacio en un panel ya compacto en móvil.
- **D3 → sin dependencias: el PNG se dibuja en `canvas`.** El contenido de la tarjeta se prepara
  como **modelo de datos puro** (testeable con `node --test`, P5) y una capa lo dibuja. Alternativa
  descartada: librería de captura de DOM (~40–100 kB gzip más en un bundle de 134 kB, y su lógica
  no se prueba en Node).
- **D4 → cancelar el diálogo de compartir no descarga** (2026-10-07, al redactar el plan; corrige
  el RF-3 original, que preveía descargar también al cancelar). Solo cuando el navegador **no
  soporta** compartir se recurre a la descarga. Alternativa descartada: descargar al cancelar —
  una descarga sorpresa tras un "no" del usuario.
- **D5 → tema claro fijo en la imagen** (2026-10-07): fondo claro, texto oscuro y los mismos
  acentos que la app (`#2e9e5b` / `#d05252`), sea cual sea el modo oscuro del sistema.
  Alternativa descartada: leer `getComputedStyle` — depende del DOM, no se prueba en Node y haría
  que el mismo resultado se viera distinto según el dispositivo.
- **D6 → falla sin diálogo ⇒ descarga; solo una cancelación real no descarga** (2026-10-07, en
  uso real posterior al cierre). Corrige y delimita **D4**: `AbortError` significa a la vez "el
  usuario canceló" y "el navegador no pudo compartir", y tratarlas igual dejaba al usuario sin la
  imagen. Evidencia del caso: `canShare` devolvió `true`, `share()` falló con `AbortError: "Share
  failed"` **a los 30 s** y la página **nunca perdió el foco**, o sea que no existió diálogo que
  cancelar; la app respondió "Compartir cancelado" y no guardó nada. Criterio de distinción:
  cancelación = el usuario llegó a ver y cerrar el diálogo; cualquier otro error = fallo ⇒ descarga
  (RF-11). Alternativa descartada: descargar ante **cualquier** `AbortError` — en móvil produciría
  una descarga tras un "no" explícito del usuario, el problema que D4 venía a evitar.

## Dudas abiertas

*(Ninguna. Las 3 dudas iniciales se resolvieron el 2026-10-07: contenido de la imagen → D1;
mecanismo de exportación → D2; generación del PNG → D3. En la fase de plan se añadieron D4
(cancelar no descarga, corrigiendo el RF-3) y D5 (tema claro fijo), aprobadas el mismo día.
El 2026-10-07, en uso real sobre Chrome/Windows, el `AbortError` ambiguo de `share()` dejó al
usuario sin imagen → nuevo RF-11 y **D6**.)*
