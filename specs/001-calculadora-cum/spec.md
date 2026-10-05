# Spec 001 — Calculadora de C.U.M (núcleo funcional)

Estado: aprobada

## Contexto y objetivo

Los estudiantes de la Universidad Don Bosco (El Salvador) no tienen una herramienta sencilla para
conocer su C.U.M: hoy deben recorrer su pensum y hacer la cuenta a mano. CalCUM UDB debe permitir
seleccionar su carrera, marcar las materias que ya cursó con su nota, y ver el C.U.M actualizado en
tiempo real, sin crear cuentas ni enviar datos a ningún servidor.

Esta spec cubre el **núcleo funcional** de la v1: selección de carrera, marcado de materias con nota
y cálculo del C.U.M. Quedan fuera (specs futuras): la extracción del dataset de pensums y la
exportación/compartición del resultado.

## Usuarios

- Estudiante de pregrado de la UDB (cualquiera de las 3 sedes/modalidades) que quiere saber su C.U.M.
- No hay usuarios administradores ni autenticación.

## Historias de usuario

- HU-1. Como estudiante, quiero elegir el tipo de carrera, la sede y la carrera, para ver solo el
  pensum que me corresponde.
- HU-2. Como estudiante, quiero marcar con un clic cada materia que ya cursé y asignarle su nota,
  para no tener que capturar datos que el pensum ya conoce (código, nombre, UV, ciclo).
- HU-3. Como estudiante, quiero ver mi C.U.M y su desglose actualizarse en cuanto cambio una nota,
  para entender de inmediato cómo me afecta cada materia.
- HU-4. Como estudiante, quiero corregir o borrar una nota ya puesta, para arreglar un error de
  captura.
- HU-5. Como estudiante, quiero que mi avance se guarde en mi dispositivo aunque cambie de carrera
  y vuelva, para no perder lo que ya capturé.

## Definiciones

- **U.M (Unidad de Mérito) de una materia** = `nota final × UV` de esa materia.
- **C.U.M** = `Σ U.M de todas las materias cursadas / Σ UV de todas las materias cursadas`.
  El denominador incluye **todas** las cursadas, aprobadas y reprobadas (decisión de constitución P1).
- **Materia cursada**: materia con una nota registrada en esta sesión. Las demás están **pendientes**.
- **Repetición**: si una materia llega a tener más de un registro, cuenta **una sola vez con su
  última nota**; sus UV entran **una sola vez** al denominador.
- **Aprobada / Reprobada**: materia cursada con nota **≥ 6** aprobada; **< 6** reprobada. El indicador
  es solo visual: **no** cambia la fórmula del C.U.M (P1: el denominador incluye cursadas de ambos
  tipos).
- **Carrera** se identifica por la tripleta `(tipo, sede, plan)` — nunca solo por su nombre.
- **Sede**: Soyapango | Antiguo Cuscatlán | UDB Virtual. La modalidad (Semipresencial/Distancia) es
  un dato de la carrera, no un filtro.

## Requisitos funcionales

- RF-1: CUANDO el usuario selecciona un tipo de carrera, EL SISTEMA muestra únicamente las sedes con
  oferta de ese tipo.
- RF-2: CUANDO el usuario selecciona tipo y sede, EL SISTEMA muestra únicamente las carreras de esa
  combinación, mostrando junto a cada una su total de UV y de materias.
- RF-3: SI una combinación seleccionada no tiene carreras disponibles, ENTONCES EL SISTEMA muestra un
  estado "sin resultados" con opción de cambiar la selección, y nunca ofrece un camino sin salida.
- RF-4: CUANDO el usuario elige una carrera, EL SISTEMA muestra su pensum agrupado por ciclos (I…X),
  y de cada materia al menos: código, nombre, UV y prerrequisito (o "—" si no tiene).
- RF-5: CUANDO el usuario hace clic en una materia pendiente, EL SISTEMA abre un modal para ingresar
  su nota.
- RF-6: SI la nota escrita está fuera del rango 1–10 o no es un número, ENTONCES EL SISTEMA impide
  guardar y muestra un mensaje de error junto al campo.
- RF-7: CUANDO el usuario guarda una nota válida, EL SISTEMA marca la materia como cursada, muestra
  su nota y recalcula el C.U.M.
- RF-8: CUANDO el usuario hace clic en una materia ya cursada, EL SISTEMA abre el mismo modal en modo
  editar, con la opción de eliminar la nota (la materia vuelve a pendiente y el C.U.M se recalcula).
- RF-9: MIENTRAS el usuario cambia notas, EL SISTEMA recalcula y muestra en el mismo instante el
  C.U.M redondeado a 2 decimales, el desglose `ΣUM / ΣUV` y el avance `materias cursadas / total`.
- RF-10: CUANDO no hay ninguna materia cursada, EL SISTEMA muestra el C.U.M como indicador vacío (sin
  dividir entre cero) y el avance en 0.
- RF-11: EL SISTEMA guarda cada registro como `{asignaturaId, nota}` y lo asocia a la clave
  `(tipo, sede, plan)` de su carrera.
- RF-12: CUANDO el usuario cambia de carrera con datos sin guardar de otra en pantalla, EL SISTEMA
  pide confirmación antes de perder el estado visible; al volver a una carrera, EL SISTEMA restaura
  sus registros.
- RF-13: CUANDO el usuario intenta cerrar o recargar la pestaña con registros de la sesión actual,
  EL SISTEMA pide confirmación antes de salir.
- RF-14: EL SISTEMA muestra en cada materia cursada un indicador de **aprobada** (nota ≥ 6) o
  **reprobada** (nota < 6), y en el panel el total de materias aprobadas y reprobadas.
- RF-15: EL SISTEMA funciona sin conexión a red después de haber cargado la página una vez.
- RF-16: EL SISTEMA no envía la nota ni ningún dato del usuario a ningún servidor (solo se guardan en
  su propio dispositivo).

## Requisitos no funcionales

- RNF-1: El C.U.M se recalcula con cada cambio en menos de 100 ms percibidos (cálculo local, sin
  recarga de página).
- RNF-2: Todo el flujo (seleccionar carrera → marcar materias → ver C.U.M) es operable solo con
  teclado, y el valor del C.U.M se anuncia a lectores de pantalla cuando cambia.
- RNF-3: La pantalla es usable en móvil (ancho ≥ 360 px) y en escritorio sin desplazamiento
  horizontal.
- RNF-4: La lógica del cálculo es independiente de la interfaz y del almacenamiento, y se prueba
  antes que la interfaz (constitución P5).

## Casos límite

- 0 materias cursadas → sin división entre cero (RF-10).
- Nota mínima 1 y nota máxima 10 → válidas; 0.5 y 10.5 → inválidas.
- Nota con decimales (p. ej. 7.5, 8.25) → válida y participa tal cual en el promedio.
- Nota exactamente 6 → aprobada; 5.99 → reprobada. El indicador nunca altera el C.U.M.
- Materia repetida en el pensum o capturada dos veces → cuenta una sola vez con la última nota.
- Borrar la última nota registrada → el panel vuelve al estado vacío.
- Carrera cuyo pensum incluye filas de electivas (UV variables) o ciclo complementario → el usuario
  puede marcarlas igual que cualquier otra materia.
- Cambiar de carrera y volver → las notas de ambas carreras coexisten por separado.

## Fuera de alcance

- Extracción/validación del dataset de pensums desde la UDB (spec 002).
- Exportar o compartir el resultado como imagen (spec 003).
- Posgrado (Maestrías/Doctorados), autenticación, backend, multiusuario.
- Proyecciones ("¿qué nota necesito?") y simuladores.

## Criterios de finalización

- Un estudiante puede llegar de cero a ver su C.U.M completo sin ayuda, en móvil y escritorio.
- Todos los RF y RNF anteriores tienen evidencia de prueba automatizada o de revisión verificable.
- Ninguna petición de red ocurre durante el uso (salvo la carga inicial de la página).
- `node --test` en verde para toda la lógica de cálculo.

## Dudas abiertas

*(Ninguna. Las 3 dudas iniciales fueron resueltas por el usuario el 2026-10-05: indicador
aprobado/reprobado con nota mínima 6 → RF-14; confirmación al cerrar pestaña → RF-13; mostrar
prerrequisito → RF-4.)*
