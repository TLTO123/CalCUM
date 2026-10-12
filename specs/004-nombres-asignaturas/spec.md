# Spec 004 — Nombres de asignatura saneados en el dataset

Estado: **implementada** (aprobada el 2026-10-08; cerrada con T8 el 2026-10-11)

## Contexto y objetivo

La spec 002 publicó el dataset completo de las 59 carreras con la validación que exige P2 de la
constitución: `Σ UV == UV publicado` y `nº de materias == total publicado`. Esa validación **no
mira los nombres**, y ahí quedó un hueco: hoy se publican **46 nombres con basura** de un total de
1.794, **todos** de UDB Virtual, repartidos en **9 carreras** (el peor caso, Lic. en Diseño Gráfico,
con 19 de sus 39 materias); las 50 carreras de Soyapango y Antiguo Cuscatlán están limpias.

El recuento salió de **seis señales estructurales** medidas sobre los 1.794 nombres reales, no de
una lectura a ojo: glifo prohibido (31), nombre que no empieza en mayúscula (11), nombre cuyo
último token es una preposición suelta (1), menos de 4 caracteres (3), espacios dobles o en los
extremos (0) y mismo código con nombres muy distintos entre planes (5 parejas). El conteo inicial
que solo miraba glifos se quedó en 31 y dejaba fuera 15 casos.

La basura tiene cuatro formas:

- glifos que no son texto: `Diseño de | Contenidos Multimedia`, `Creatividad Publicitaria | | |`.
  En el documento de origen son **las líneas divisorias de las celdas de la tabla**, que el lector
  de imagen devuelve como si fueran letras (66 de esos ítems en el pensum de Diseño Gráfico, con
  ancho de 0,5 a 1,4 pt);
- palabras partidas o troceadas: `Técnicas de ición`, `Aplicadaal`, `parala`, `¡yy`;
- nombres **truncados**, por la izquierda (`ipografía`, `e Preproducción Multimedia`,
  `y onocimiento`) o por la derecha (`Administración de`, `Digital`), sin que se vea nada raro en
  el resto del nombre;
- materias **sin ningún nombre legible**: `DPA919` publica `| | |` y `DWM919` publica `| |`.

Por qué importa: el nombre es el único campo que el estudiante reconoce de su pensum. Un nombre
con `|` o partido en dos hace que la app parezca un volcado crudo, y **dos materias sin nombre son
dos materias sin identidad**: el estudiante no puede saber qué está registrando. Es también la
misma clase de fallo que P2 prohíbe; solo que aquí no se detecta porque nada compara el nombre con
nada.

## Usuarios

- **Estudiante UDB** de las carreras de UDB Virtual, que ve los nombres en el pensum de su carrera.
- **Mantenedor del proyecto**, que regenera el dataset y audita lo que sale.

## Historias de usuario

- HU-1. Como estudiante, quiero que cada materia de mi pensum muestre su nombre completo y legible
  para reconocer mi carrera.
- HU-2. Como estudiante, quiero que ninguna materia aparezca sin nombre para poder registrarle
  nota.
- HU-3. Como mantenedor, quiero que una regeneración no vuelva a publicar nombres con basura, para
  no tener que cazarlos a mano cada vez.
- HU-4. Como mantenedor, quiero que cada nombre corregido cite el documento del que salió, para
  poder auditarlo sin reabrir todo el proceso.

## Definiciones

- **Nombre de asignatura**: el campo `nombre` que el dataset publica por materia y que la
  aplicación muestra en el pensum.
- **Glifo de ruido**: carácter que el lector devuelve y que en el documento no es texto, sino un
  trazo de la tabla (`|`, `¦`, `[`, `¡` suelto). Se distingue de una letra por su ancho
  despreciable y por no formar palabra.
- **Corrección curada**: entrada del registro de correcciones que fija el nombre de una asignatura
  concreta —identificada por carrera, código y ciclo— cuando la extracción no puede recuperarlo, y
  que cita el documento de origen.

## Requisitos funcionales

- RF-1: EL SISTEMA publica el nombre de cada asignatura **saneado**: sin glifos de ruido, sin
  palabras partidas por un espacio que no existe en el documento, sin espacios dobles y con al
  menos 4 caracteres.
- RF-2: CUANDO el lector de un pensum publicado como imagen devuelve un ítem que proviene de una
  línea divisoria de la tabla y no de una letra, EL SISTEMA lo descarta **antes** de componer el
  nombre, de modo que el ruido no llegue al texto.
- RF-3: CUANDO la extracción no puede recuperar el nombre de una asignatura —queda vacío, truncado
  o con palabras ilegibles—, EL SISTEMA aplica la corrección curada registrada para esa
  asignatura.
- RF-4: SI una asignatura queda **sin nombre recuperable** y no tiene corrección curada, ENTONCES
  el sistema no publica el dataset y señala la asignatura exacta (carrera, código y ciclo). Nunca
  se publica un nombre vacío.
- RF-5: EL SISTEMA valida el dataset completo con un **control de nombres** que reproduce RF-1.
  SI un nombre incumple alguna de estas reglas, ENTONCES la publicación se detiene y reporta la
  carrera, el código y el nombre problemático, con el mismo criterio que las validaciones de UV y
  de número de materias:

  a) está vacío o mide menos de 4 caracteres;
  b) contiene un glifo prohibido (`|`, `¦`, `[`, `]`, `{`, `}`, `¡`, `!`);
  c) tiene espacios dobles o espacios en los extremos;
  d) **no empieza en mayúscula**: señala un nombre truncado por la izquierda (`ipografía`,
     `e Preproducción Multimedia`);
  e) su **último token es una preposición o conjunción suelta** (`de`, `del`, `y`, `en`, `con`,
     `para`, `por`, `al`, `la`, `el`, `los`, `las`, `un`, `una`, `e`, `o`): señala un nombre
     truncado por la derecha (`Administración de`).

  Las reglas d) y e) miden sobre el dataset real 11 y 1 verdaderos positivos con **0 falsos
  positivos**. Lo que ninguna regla objetiva puede decidir —una palabra leída mal sin que se note
  en la estructura, como `parala` o `Aplicadaal`— lo cubren RF-7 y el cotejo del anexo A.
- RF-6: EL SISTEMA registra en el manifiesto y en el reporte de generación cada corrección curada
  aplicada, con su asignatura y el documento del que se tomó el nombre.
- RF-7: CUANDO el mismo código aparece en más de un plan del dataset con nombres **muy distintos**,
  EL SISTEMA emite una advertencia en el reporte, sin bloquear: es la señal de que uno de los dos
  salió mal y hay que cotejarlo contra el documento.
- RF-8: EL SISTEMA mantiene intactos el contrato y la estructura del dataset: el saneamiento solo
  cambia el valor de `nombre`, nunca código, UV, ciclo, prerrequisito ni identificadores.
- RF-9: EL SISTEMA mantiene la reproducibilidad: las correcciones curadas viven en el repositorio
  y dos corridas sobre los mismos orígenes aplican exactamente las mismas.

## Requisitos no funcionales

- RNF-1: El saneamiento corre dentro del pipeline existente, sin Python, sin red y sin
  herramientas externas al proyecto (hereda RNF-1 de la spec 002).
- RNF-2: La aplicación no cambia: recibe el mismo contrato de datos (hereda RNF-2 de la spec 002).
- RNF-3: Ningún nombre se corrige editando el dataset publicado a mano: toda corrección entra por
  el pipeline y queda versionada.

## Casos límite

1. Regla de tabla leída como glifo: 66 ítems `|` de ancho 0,5–1,4 pt en el pensum de Diseño
   Gráfico virtual; el ruido se cuela dentro del nombre.
2. Nombre leído en dos columnas: `Costos y de | Presupuestos Negocios de Diseño` publica el nombre
   real `Costos y Presupuestos de Negocios de Diseño` troceado y en desorden. El saneado quita los
   `|` pero no recupera el orden, así que el nombre sigue dañado — lo corrigió el cotejo de T6 y
   quedó en el anexo B.1, fuera de alcance.
3. Palabra partida por el lector: `Técnicas de ición` (falta `Compos`), `Aplicadaal`, `parala`.
4. Nombre truncado por el borde de su celda: `Administración de` y `Uy`.
5. Asignatura sin ningún nombre legible: `DPA919` (`| | |`) y `DWM919` (`| |`), ambas del ciclo IX
   de Lic. Diseño Gráfico y **ausentes de cualquier otro plan**, así que no hay dónde cruzarlas.
6. Mismo código con nombres distintos en dos planes: `DCG919` publica `Uy` en la Licenciatura y
   `Dibujo Técnico parala | Comunicación Gráfica` en el Técnico. Ninguno de los dos es fuente de
   verdad: manda el documento de origen de cada plan.
7. Un nombre que, tras limpiar el ruido, queda vacío: no puede publicarse ni lanzar un error
   tardío dentro del dibujo de la tarjeta; debe detener la generación.
8. Una corrección curada cuyo código ya no aparece en el documento regenerado (la UDB publicó un
   pensum nuevo): debe fallar ruidosamente, no ignorarse en silencio.
9. Nombres legítimos que contienen símbolos válidos (`&`, `°`, `°N`, comas, paréntesis): el control
   no debe confundirlos con ruido.

## Fuera de alcance

- Cambiar el motor de OCR ni sus modos de segmentación: el diagnóstico muestra que la mayoría del
  daño sale de las reglas de la tabla y no de la letra, y el propio pipeline documenta que ningún
  modo de segmentación ve todo a la vez.
- Corregir la nomenclatura oficial de la UDB: se **transcribe** el documento, no se mejora.
- La interfaz del pensum y el modelo de la tarjeta exportada (specs 001 y 003).
- Las validaciones de UV y de número de materias (spec 002, intactas).
- Los nombres de las carreras: solo los de las asignaturas.

## Criterios de finalización

- **0 nombres** que incumplan ninguna de las cinco reglas del control (RF-5) en las 59 carreras,
  con ese control en verde.
- Los **46 casos del anexo A** clasificados y **las 21 curaciones** ejecutadas —los 19 que el
  control marca en `curar` más `EFD905` y `DCG919` del Técnico en Diseño Gráfico, que solo los ve
  RF-7— cotejadas una a una contra su documento de origen, con el nombre final registrado en el
  reporte. Los otros 21 casos quedan resueltos por el saneado automático o resultan sanos al
  cotejarlos, menos los 6 que pasan a `fuera` (anexo B.1).
- Los casos del **anexo B** quedan documentados con su nombre real y su fuente, y **fuera** del
  registro: el usuario decidió el 2026-10-09 no curarlos en esta spec.
- El dataset publicado **no cambia** en nada salvo en los nombres saneados: mismo número de
  carreras, materias, UV, códigos e identificadores que la spec 002 (RF-8).
- Dos corridas consecutivas producen el mismo dataset byte a byte (RF-9).
- El manifiesto y el reporte listan las correcciones curadas aplicadas con su fuente (RF-6).
- `npm test` en verde (los 164 existentes más los nuevos) y `npm run typecheck` sin errores.

## Dudas abiertas

- Ninguna. El usuario aprobó el enfoque completo (2026-10-08) y que el control de nombres
  **bloquee** la publicación en vez de advertir. El mismo día aprobó la **ampliación de alcance**
  que trajo la medición de las seis señales: anexo A de 31 → 46 casos, RF-5 con cinco reglas y
  cotejo de 19 curaciones.
- El 2026-10-09, durante el cotejo de T6, el usuario decidió tres cosas que afinan ese alcance:
  **(1)** `EPI906` se cura como `Ecoeficiencia de Procesos Industriales`, corrigiendo a mano la
  errata `Insdustriales` que el PDF de origen trae escrita — única excepción al «se transcribe,
  no se mejora», explícita en el registro; **(2)** el registro pasa de 19 a **21 curaciones** con
  `EFD905` de la Lic. en Ciencias de la Comunicación y `CMM909` de la Lic. en Marketing, dos
  truncamientos por el borde de la celda que el control no ve; **(3)** el daño que el cotejo dejó
  al descubierto fuera de esas 21 —6 casos del propio anexo A y unos 15 más que solo se ven
  cruzando contra los gemelos presenciales— queda **fuera de alcance** y documentado en el anexo B.

---

## Anexo A — Los 46 nombres con basura, por señal y por estado

Seis señales medidas sobre los 1.794 nombres reales (hay nombres con más de una, por eso la
columna de señales suma 56 sobre 46 casos):

| Señal | Qué delata | Casos |
|---|---|---|
| **glifo** — glifo prohibido en el nombre crudo | líneas de tabla leídas como texto | 31 |
| **sin mayúscula** — no empieza en mayúscula | truncado por la izquierda | 11 |
| **termina en prep** — el último token es preposición o conjunción suelta | truncado por la derecha | 1 |
| **menos de 4 caracteres** — incluye el vacío | nombre perdido | 3 |
| **cruce** — mismo código con menos del 50 % de solape de tokens entre planes | daño que solo se ve comparando | 10 (5 parejas) |
| espacios dobles o en los extremos | — | 0 |

Estado: **sano** = el saneado automático (T1/T2) lo deja correcto; **curar** = sigue dañado, el
control lo bloquea y hay que fijar su nombre contra el documento; **pareja** = pasa el control pero
RF-7 lo señala por divergir de su homónimo de otro plan; **fuera** = dañado de verdad, pero fuera
del alcance aprobado de T6/T7 (ver anexo B).

| Carrera (UDB Virtual) | Ciclo | Código | Nombre publicado | Tras el saneado | Señal | Estado |
|---|---|---|---|---|---|---|
| Ingeniería Industrial | 7 | `EPI906` | `de Procesos Insdustriales` | `de Procesos Insdustriales` | sin mayúscula | curar |
| Lic. Administración de Empresas | 3 | `EDN902` | `Estadística de Negocios` | `Estadística de Negocios` | cruce | pareja |
| Lic. Administración de Empresas | 7 | `EDN902` | `Análisis e Interpretación de Estados Financieros` | `Análisis e Interpretación de Estados Financieros` | cruce | pareja |
| Lic. Ciencias de la Comunicación | 1 | `GIC905` | `y onocimiento` | `y onocimiento` | sin mayúscula, cruce | curar |
| Lic. Ciencias de la Comunicación | 3 | `EFD905` | `Edición de Fotografía` | `Edición de Fotografía` | cruce | curar |
| Lic. Ciencias de la Comunicación | 4 | `PPI905` | `Práctica Profesional \|` | `Práctica Profesional` | glifo | sano |
| Lic. Ciencias de la Comunicación | 5 | `EDA905` | `\| Estudio de Audiencias` | `Estudio de Audiencias` | glifo | sano |
| Lic. Ciencias de la Comunicación | 5 | `IYE905` | `\| \| Innovación y \| Emprendimiento` | `Innovación y Emprendimiento` | glifo | sano |
| Lic. Ciencias de la Comunicación | 9 | `EYP905` | `[oe Etiqueta y Protocolo` | `[oe Etiqueta y Protocolo` | glifo | curar |
| Lic. Diseño Gráfico | 2 | `PRM919` | `e Preproducción Multimedia` | `e Preproducción Multimedia` | sin mayúscula | curar |
| Lic. Diseño Gráfico | 3 | `-` | `Costos y de \| Presupuestos Negocios de Diseño` | `Costos y de Presupuestos Negocios de Diseño` | glifo | fuera |
| Lic. Diseño Gráfico | 3 | `DCG919` | `Uy \|` | `Uy` | glifo, menos de 4, cruce | curar |
| Lic. Diseño Gráfico | 3 | `DCM919` | `Diseño de \| Contenidos Multimedia` | `Diseño de Contenidos Multimedia` | glifo | sano |
| Lic. Diseño Gráfico | 3 | `IAD919` | `\| Aplicada al Diseño` | `Aplicada al Diseño` | glifo | fuera |
| Lic. Diseño Gráfico | 3 | `TIP919` | `\| Tipografía \|` | `Tipografía` | glifo, cruce | pareja |
| Lic. Diseño Gráfico | 4 | `-` | `\| Investigación de Mercados \| \|` | `Investigación de Mercados` | glifo | sano |
| Lic. Diseño Gráfico | 4 | `AND919` | `\| Animación Digital` | `Animación Digital` | glifo | sano |
| Lic. Diseño Gráfico | 4 | `CRP919` | `Creatividad Publicitaria \| \| \|` | `Creatividad Publicitaria` | glifo | sano |
| Lic. Diseño Gráfico | 4 | `DTR919` | `\| \| Diseño Tridimensional \|` | `Diseño Tridimensional` | glifo | sano |
| Lic. Diseño Gráfico | 4 | `PPM919` | `\| \| Publicación de Productos \| Multimedia \|` | `Publicación de Productos Multimedia` | glifo | sano |
| Lic. Diseño Gráfico | 6 | `EMD919` | `Estrategias de Marketing Digital —\|` | `Estrategias de Marketing Digital —` | glifo | fuera |
| Lic. Diseño Gráfico | 6 | `GCP919` | `de Proyectos` | `de Proyectos` | sin mayúscula | curar |
| Lic. Diseño Gráfico | 7 | `DEE919` | `Diseño, oy \| Estrategia de Empaques y Envases` | `Diseño, oy Estrategia de Empaques y Envases` | glifo | fuera |
| Lic. Diseño Gráfico | 8 | `ADD919` | `\| Animación 2D y 3D` | `Animación 2D y 3D` | glifo | sano |
| Lic. Diseño Gráfico | 8 | `LDP919` | `\| Lógica de Programación` | `Lógica de Programación` | glifo | sano |
| Lic. Diseño Gráfico | 9 | `DPA919` | `\| \| \|` | *(vacío)* | glifo, menos de 4 | curar |
| Lic. Diseño Gráfico | 9 | `DWM919` | `\| \|` | *(vacío)* | glifo, menos de 4 | curar |
| Lic. Diseño Gráfico | 9 | `EPI919` | `Ética y Propiedad Intelectual \| \|` | `Ética y Propiedad Intelectual` | glifo | sano |
| Lic. Marketing | 1 | `TIC902` | `de Tecnologías Información y Comunicación` | `de Tecnologías Información y Comunicación` | sin mayúscula | curar |
| Lic. Marketing | 3 | `ADE920` | `Análisis de Datos Empresariales \|` | `Análisis de Datos Empresariales` | glifo | sano |
| Lic. Marketing | 4 | `CMM909` | `Canales y Métricas Digital \|` | `Canales y Métricas Digital` | glifo | curar |
| Técnico Diseño Gráfico | 2 | `TCV919` | `Técnicas de ición \| Composición Visual` | `Técnicas de ición Composición Visual` | glifo | fuera |
| Técnico Diseño Gráfico | 3 | `CND919` | `\| Presupuestos \| de Negocios de Diseño` | `Presupuestos de Negocios de Diseño` | glifo | fuera |
| Técnico Diseño Gráfico | 3 | `DCG919` | `\| Dibujo Técnico parala \| Comunicación Gráfica` | `Dibujo Técnico parala Comunicación Gráfica` | glifo, cruce | pareja |
| Técnico Diseño Gráfico | 3 | `TIP919` | `ipografía` | `ipografía` | sin mayúscula, cruce | curar |
| Técnico Ing. en Computación | 2 | `ADB901` | `y Diseño Análisis de Sistemas y Bases` | `y Diseño Análisis de Sistemas y Bases` | sin mayúscula | curar |
| Técnico Ing. en Computación | 2 | `DAS901` | `de con Aplicaciones Software Propietario` | `de con Aplicaciones Software Propietario` | sin mayúscula | curar |
| Técnico Ing. en Computación | 3 | `ASN901` | `Administración de \| \|` | `Administración de` | glifo, termina en prep | curar |
| Técnico Ing. en Computación | 3 | `SPP901` | `\| Servidores en Plataformas Propietarias` | `Servidores en Plataformas Propietarias` | glifo | sano |
| Técnico Ing. en Computación | 4 | `ADP901` | `Administración \| de Proyectos` | `Administración de Proyectos` | glifo | sano |
| Técnico Ing. en Computación | 4 | `EIC901` | `Electrónica Internet \| ¡yy \| Aplicadaal de las Cosas` | `Electrónica Internet ¡yy Aplicadaal de las Cosas` | glifo | curar |
| Técnico Marketing Digital y Ventas | 1 | `TIC902` | `de Tecnologías Información y Comunicación` | `de Tecnologías Información y Comunicación` | sin mayúscula | curar |
| Técnico Marketing Digital y Ventas | 4 | `CMM909` | `e Canales y Métricas de Marketing Digital` | `e Canales y Métricas de Marketing Digital` | sin mayúscula | curar |
| Técnico Multimedia | 1 | `GIC905` | `la y Conocimiento` | `la y Conocimiento` | sin mayúscula, cruce | curar |
| Técnico Multimedia | 3 | `EFD905` | `Digital` | `Digital` | cruce | pareja |
| Técnico Multimedia | 4 | `PPI905` | `Práctica Profesional \|` | `Práctica Profesional` | glifo | sano |

**Totales**: 46 casos · 16 **sano** (el filtro los deja correctos) · 19 **curar** · 5 **pareja** ·
6 **fuera** (dañados, pero el usuario dejó su curación fuera del alcance el 2026-10-09; ver
anexo B) → **21 curaciones**: los 19 marcados `curar` más `EFD905` del Técnico en Multimedia y
`DCG919` del Técnico en Diseño Gráfico, los dos únicos dañados que **solo** descubre RF-7. De las
5 parejas, 4 son sanas — `EDN902` en sus dos ciclos es probable reuso de código de la UDB (los dos
nombres están completos), y `TIP919` de la Licenciatura está correcto—; la pareja entera se coteja
igual, porque RF-7 no sabe de qué lado está el error.

Tres comprobaciones que sostienen el diagnóstico: `DCM919`, `DTR919`, `AND919` y `CRP919` publican
el nombre **exactamente igual** en el pensum del Técnico una vez quitado el `|`, lo que confirma que
el `|` es ruido y no parte del nombre; `DCG919` está dañado **en los dos planes**, lo que muestra
que el saneamiento automático no basta y hay que cotejar contra el documento; y los 46 casos
están en las 9 carreras de UDB Virtual —cero en Soyapango y Antiguo Cuscatlán—, que son las que la
UDB publica como imagen sin capa de texto.

---

## Anexo B — Daño conocido y fuera del alcance (hallazgo del cotejo de T6)

El cotejo de T6 contra los documentos de origen y el cruce contra los **gemelos presenciales**
(los planes de Soyapango, que publican los mismos pensums con capa de texto) destapó daño que el
anexo A **no puede ver por construcción**: sus seis señales miden la *estructura* del texto
publicado, así que todo nombre que empieza en mayúscula, no trae glifos y termina en sustantivo
pasa por sano aunque le falte media frase. El usuario decidió el 2026-10-09 **dejarlo fuera del
alcance** de esta spec: queda aquí documentado, no ignorado.

### B.1 — Los 6 del anexo A clasificados erróneamente como «sano»

Ya corregidos en la tabla del anexo A (pasan a `fuera`). Cotejados contra el JPG de su pensum y
contra su gemelo presencial, que es donde se ve que el nombre publicado está incompleto:

| Carrera (UDB Virtual) | Ciclo | Código | Publica | El documento dice |
|---|---|---|---|---|
| Lic. Diseño Gráfico | 3 | `-` | `Costos y de Presupuestos Negocios de Diseño` | `Costos y Presupuestos de Negocios de Diseño` |
| Lic. Diseño Gráfico | 3 | `IAD919` | `Aplicada al Diseño` | `Ilustración Aplicada al Diseño` |
| Lic. Diseño Gráfico | 6 | `EMD919` | `Estrategias de Marketing Digital —` | `Estrategias de Marketing Digital` |
| Lic. Diseño Gráfico | 7 | `DEE919` | `Diseño, oy Estrategia de Empaques y Envases` | `Diseño, Desarrollo y Estrategia de Empaques y Envases` |
| Técnico Diseño Gráfico | 2 | `TCV919` | `Técnicas de ición Composición Visual` | `Técnicas de Composición Visual` |
| Técnico Diseño Gráfico | 3 | `CND919` | `Presupuestos de Negocios de Diseño` | `Costos y Presupuestos de Negocios de Diseño` |

El primer caso es además un doble hallazgo. La propia spec lo describe en el caso límite 2 como
«dos nombres en una sola celda», y el anexo A lo daba por resuelto por el saneado: **no lo está**.
El saneado quita los `|` pero deja las palabras en el orden en que las apila el lector de dos
columnas, y el nombre resultante no es ninguno de los dos. El recorte de esa fila leyó también un
código (`CND919`, el mismo del Técnico) que el lector de página completa no llegó a recuperar; en
el dataset la fila queda como `-`/`electiva-4`, y corregir el **código** ya sería tocar RF-8, así
que T6 solo cura el nombre por su `id`.

### B.2 — Daño adicional que solo se ve cruzando contra los gemelos presenciales

Carreras fuera de las 9 del anexo A que publican pensums de imagen, más daño del mismo tipo dentro
de ellas. Ninguna señal estructural lo marca (RF-5 la da por limpia), pero el nombre publicado
difiere del del gemelo presencial de forma que no se explica por transcripción:

| Carrera (UDB Virtual) | Ciclo | Código | Publica | Gemelo presencial |
|---|---|---|---|---|
| Lic. Marketing | 4 | `MOC920` | `; Empresarial` | `Modelaje Cuantitativo Empresarial` |
| Lic. Marketing | 5 | `CEM920` | `Comunicación de Estratégica Marketing` | `Comunicación Estratégica de Marketing` |
| Lic. Marketing | 6 | `LEE902` | `Empresarial 1` | `Legislación Empresarial` |
| Lic. Marketing | 7 | `ECI920` | `Competitividad` | `Economía Internacional y Competitividad` |
| Lic. Marketing | 7 | `OPC920` | `Operaciones Comerciales 11` | `Operaciones Comerciales` |
| Lic. Marketing | 8 | `CDM920` | `Empresas Empresas` | `Creación de Empresas` |
| Lic. Marketing | 9 | `BEP920` | `1 Producto` | `Branding y Estrategias de Producto` |
| Lic. Marketing | 10 | `IEP920` | `Prospectiva Estratégica` | `Innovación Empresarial y Prospectiva Estratégica` |
| Lic. Diseño Gráfico | 7 | `MAD919` | `Modelado 3D Análogoy Digital` | `Modelado 3D Análogo y Digital` |
| Lic. Ciencias de la Comunicación | 7 | `TCM905` | `Taller de y Manager` | *(pendiente de cotejar contra el documento)* |
| Técnico Ing. en Computación | 1 | `LME901` | `Lenguajes de y Estilo Web` | `Lenguajes de Marcado y Estilo Web` |
| Técnico Ing. en Computación | 2 | `DAW901` | `Desarrollo de Aplicaciones Web con Software en el Cliente` | `…con Software Interpretados en el Cliente` |
| Técnico Ing. en Computación | 3 | `DWF901` | `Desarrollo de conWeb Aplicaciones Frameworks` | `Desarrollo de Aplicaciones con Web Frameworks` |
| Técnico Diseño Gráfico | 1 | `-` | `Investigación e Creatividad Innovación` | `Investigación, Creatividad e Innovación` |
| Técnico Diseño Gráfico | 4 | `PPM919` | `Publicación de Multimedia` | `Publicación de Productos Multimedia` |
| Ing. Ciencias de la Computación | 8 | `GCS941` | `Gestión de la Cálidad del Software` | `Gestión de la Calidad del Software` |

Dos advertencias sobre esta tabla, para quien la retome:

- La columna «gemelo presencial» es **señal, no fuente de verdad**: RF-3 exige cotejar contra el
  documento del propio plan. `DAW901`, por ejemplo, puede ser una diferencia legítima entre planes
  y no un truncamiento; y `TCM905` sigue sin resolverse. Antes de curar ninguno hay que leer el
  JPG/PDF de su pensum con el mismo procedimiento de T6.
- `Sofware` en `DSM941` (Técnico Ing. en Computación) y `Cálidad` en `GCS941` están así **en el
  documento de origen**: son erratas de la UDB. La spec manda transcribir, no mejorar, así que no
  entran al registro de correcciones — igual que la errata original de `Insdustriales` en `EPI906`,
  que el mantenedor decidió corregir a mano el 2026-10-09 (única excepción, explícita, en el
  registro).
- Los planes cuyo ciclo **no está alineado** con su gemelo (Ingenierías y Lic. Administración, con
  5 materias en un ciclo donde el presencial tiene 4) no se pueden comparar por posición: el cruce
  automático produce falsos positivos y quedó descartado. Esos daños, si existen, solo se ven
  cotejando contra el documento.

### B.3 — Qué haría falta para cerrar el hueco

El daño del anexo B es de la misma familia que el del anexo A, así que el remedio también es el
mismo y no pide nada nuevo: ampliar el registro de correcciones curadas (T6, RF-3) con los casos
cotejados y regenerar (T7). Lo que el proyecto **no** tiene hoy es un control que lo detecte solo:
RF-5 mide estructura y por definición no ve un nombre completo en la forma pero cortado en el
fondo. Detectarlo automáticamente exigiría comparar los nombres entre planes afines — que es
exactamente lo que hace RF-7, pero **sin bloquear** y solo sobre el mismo código; bajarlo a un umbral
más agresivo produciría falsos positivos sobre asignaturas con nombres legítimamente distintos.
