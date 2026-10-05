# Levantamiento de datos — Universidad Don Bosco (El Salvador)

> Fuente primaria: https://www.udb.edu.sv/udb/pagina/listado_carreras
> Fecha de extracción: 2026-10-05 (vía chrome-devtools + fetch + PDF.js)
> Estado: **dataset de referencia para CalCUM UDB** (sin código de aplicación aún)

---

## 1. Estructura del sitio y agrupadores

La página de carreras organiza la oferta en **3 pestañas de sede/modalidad**:

| Pestaña | Contenido | Panel DOM | Total |
|---|---|---|---|
| Campus Soyapango (presencial/semipresencial) | Ing. 9 · Lic. 9 · Téc. 14 · Prof. 1 | `collapse1_*` | **33** |
| Campus Antiguo Cuscatlán | Ing. 2 · Lic. 7 · Téc. 6 · Maestrías 9 · Doctorados 3 | `collapse2_*` | **27** |
| UDB Virtual (a distancia) | Ing. 2 · Lic. 4 · Téc. 5 · Maestrías 4 | `.tab_content_3` | **15** |

Subtipos de carrera (pregrado): **Ingenierías, Licenciaturas, Técnicos, Profesorados**.
Posgrado: **Maestrías, Doctorados** (solo relevante si se amplía el alcance; el C.U.M aplica a pregrado).

Patrón de URLs de carreras:
- `https://www.udb.edu.sv/udb/carreras/carrera/<slug>` (presencial; los de AC repiten el nombre + `__campus_antiguo_cuscatlan`)
- `https://www.udbvirtual.edu.sv/<slug>` (distancia, dominio distinto)

---

## 2. Campus Soyapango — 33 carreras

### 2.1 Ingenierías (9) — 5 años / 10 ciclos, semipresencial

| Carrera | Materias | UV | Pensum (PDF) |
|---|---:|---:|---|
| Ingeniería Mecánica | 40 | 160 | `pensum-ingenieria-mecanica-plan-2022.pdf` |
| Ingeniería Industrial | 40 | 160 | `pensum-ingenieria-industrial-plan-2024.pdf` |
| Ingeniería Biomédica | 40 | 164 | `pensum-ingenieria-biomedica-plan-2024.pdf` |
| Ingeniería en Ciencias de la Computación | 40 | 161 | `pensum-ingenieria-en-ciencias-de-la-computacion-plan-2024.pdf` |
| Ingeniería Eléctrica | 40 | 162 | `pensum-ingenieria-electrica-plan-2024.pdf` |
| Ingeniería Mecatrónica | 40 | 161 | `pensum-ingenieria-mecatronica-plan-2024.pdf` |
| Ingeniería en Aeronáutica | 41 | 162 | `pensum-ingenieria-en-aeronautica-plan-2024.pdf` |
| Ingeniería en Electrónica y Automatización | 40 | 163 | `pensum-ingenieria-electronica-y-automatizacion-plan-2024.pdf` |
| Ingeniería en Telecomunicaciones y Redes | 40 | 162 | `pensum-ingenieria-en-telecomunicaciones-y-redes-plan-2024.pdf` |

### 2.2 Licenciaturas (9)

| Carrera | Duración | Materias | UV |
|---|---|---:|---:|
| Lic. en Teología Pastoral | 5 años / 10 ciclos | 33 | 171 |
| Lic. en Idiomas (Adquisición de Lenguas Extranjeras) | 5 / 10 | 34 | 168 |
| Lic. en Idiomas (Turismo) | 5 / 10 | 36 | 177 |
| Lic. en Ciencias de la Comunicación *(plan 2026)* | 5 / 10 | 40 | 160 |
| Lic. en Diseño Gráfico | 5 / 10 | 39 | 161 |
| Lic. en Diseño Industrial | 5 / 10 | 39 | 161 |
| Lic. en Marketing | 5 / 10 | 40 | 165 |
| Lic. en Contaduría Pública | 5 / 10 | 40 | 165 |
| Lic. en Administración de Empresas | 5 / 10 | 40 | 166 |

### 2.3 Técnicos (14)

| Carrera | Duración | Materias | UV |
|---|---|---:|---:|
| Téc. en Ingeniería Mecánica | 2 años / 4 ciclos | 20 | 79 |
| Téc. en Ingeniería Eléctrica | 2 / 4 | 20 | 79 |
| Téc. en Ingeniería Electrónica | 2 / 4 | 20 | 82 |
| Téc. en Ingeniería Biomédica | 2 / 4 | 20 | 81 |
| Téc. en Ingeniería en Computación | 2 / 4 | 20 | 79 |
| Téc. en Multimedia *(plan 2026)* | 2 / 4 | 16 | 64 |
| Téc. en Diseño Gráfico | 2 / 4 | 20 | 77 |
| Téc. en Control de la Calidad | 2 / 4 | 20 | 79 |
| Téc. en Mantenimiento Aeronáutico | 2 / 4 | 22 | 113 |
| Téc. en Ortesis y Prótesis (presencial) | 3 años / 6 ciclos | 24 | 132 |
| Téc. en Guía de Turismo Bilingüe *(plan 2026)* | 2 / 4 | 15 | 74 |
| Téc. en Asesoría Financiera Sostenible | 2 / 4 | 16 | 69 |
| Téc. en Gestión del Talento Humano | 2 años | 16 | 66 |
| Téc. en Ortesis y Prótesis (a distancia) *(plan 2025)* | 2.5 años / 5 ciclos | 20 | 107 |

### 2.4 Profesorados (1)

| Carrera | Duración | Materias | UV |
|---|---|---:|---:|
| Profesorado en Teología Pastoral | 3 años / 6 ciclos | 21 | 103 |

---

## 3. Campus Antiguo Cuscatlán — 27 carreras

Las 15 de pregrado son **variantes de carreras de Soyapango y reutilizan el MISMO PDF de pensum** (plan idéntico, sedes compartidas).

| Tipo | Carreras | UV |
|---|---|---|
| Ingenierías (2) | Industrial (160), Ciencias de la Computación (161) | 160–161 |
| Licenciaturas (7) | Marketing 165 · Idiomas-Turismo 177 · Diseño Gráfico 161 · Comunicación 160 · Administración de Empresas 166 · Idiomas-Extranjeras 168 · Contaduría Pública 165 | 160–177 |
| Técnicos (6) | Diseño Gráfico 77 · Multimedia 64 · Ing. en Computación 79 · Guía de Turismo Bilingüe 74 · Asesoría Financiera 69 · Gestión del Talento Humano 66 | 64–79 |
| Maestrías (9) | Educación · Enseñanza de Lenguas Extranjeras · Ciencias Sociales (cotit. UCA-UDB) · Gestión del Currículum/Didáctica/Evaluación · Seguridad y Gestión de Riesgos Informáticos · Gestión de la Calidad · Gestión Energética y Diseño Ambiental · Gerencia de Mantenimiento Industrial (cotit. UCA-UDB) · Teología | — |
| Doctorados (3) | Ciencias Sociales (cotit. UCA-UDB) · Teología · Educación | — |

---

## 4. UDB Virtual (a distancia) — 15 carreras

Dominio propio `www.udbvirtual.edu.sv` (site Laravel/Moodle, datos de carrera en HTML, **pensums con UV distintos a los presenciales**).

| Tipo | Carreras |
|---|---|
| Ingenierías (2) | Ciencias de la Computación (**44 materias, 176 UV**, 10 ciclos) · Industrial |
| Licenciaturas (4) | Diseño Gráfico · Marketing · Ciencias de la Comunicación · Administración de Empresas |
| Técnicos (5) | Multimedia · Diseño Gráfico · Ing. en Computación · Control de la Calidad · **Marketing Digital y Ventas** (solo virtual) |
| Maestrías (4) | Ciencia de Datos e Inteligencia de Negocios · Arquitectura de Software · Dirección de Marketing · Políticas para la Prevención de la Violencia Juvenil en Cultura de Paz |

> ⚠️ **Hallazgo clave:** "Ingeniería en Ciencias de la Computación" presencial = 161 UV / 40 materias;
> virtual = 176 UV / 44 materias. La clave de carrera debe ser `(carrera, sede/modalidad, plan)`.

---

## 5. Estructura de los pensums (PDF)

Los pensums son **PDF de 1 página, formato infográfico**, descargables desde cada página de carrera
(host `www.udb.edu.sv/udb_files/content_resource/es/pensum/...`).

- **Variantes de ruta/plan:** `/rebranding2024/`, `/planes_2025/`, `/planes_2026/`
  (el nombre del archivo indica el plan: `...-plan-2022|2024|2025|2026.pdf`).
- **Encabezado:** nombre de carrera, "GUÍA", rango de ciclos (ej. *Ciclo 01-2024 – Ciclo 02-2027*),
  y los totales oficiales: `UNIDADES VALORATIVAS: 161` / `TOTAL DE MATERIAS A CURSAR: 40`.
- **Columnas por ciclo (I → X):** `Código | Nombre de la Asignatura | Unidades Valorativas | Prerrequisito | Nº Correlativo`.
- **Leyenda:** asignaturas electivas (sujetas a demanda), ciclo complementario, `•` = prácticas de laboratorio,
  correlativas ("Bachillerato" = requisito de ingreso, no materia).
- **Electivas** aparecen como fila `- Electiva -` (ej. 4 UV) sin código fijo.
- Modalidades de trabajo de graduación: proyecto o seminario (no afectan el cálculo).

**Problema técnico detectado:** el orden de extracción de texto del PDF está *mezclado* por columnas
(los ítems de ciclos distintos se intercalan). Requiere parseo **sensible a coordenadas/layout**
(`pdfplumber` con `extract_words()` + agrupación por x/y de columna), no `extract_text()` simple.
**Validación obligatoria:** `Σ UV por materia == UV total declarado` y `conteo == materias declaradas`.

---

## 6. Riesgos y reglas de negocio derivadas

1. **Versionado de planes:** un estudiante rinde bajo el plan vigente a su ingreso → el modelo de datos
   debe guardar `plan` y las UV por materia **por plan**, no por carrera.
2. **Homónimos entre sedes/modalidades:** misma carrera, distinto pensum (presencial vs. virtual).
3. **Enlaces mixtos `http://`/`https://`** en algunos pensums (redirigen; normalizar).
4. **Metadatos incompletos** en el HTML (`Impartida en:` / `Modalidad:` nulos en varias fichas)
   → inferirse de la pestaña a la que pertenecen.
5. ~~Definición de C.U.M a confirmar~~ → **RESUELTA (decisión del usuario):** el denominador incluye
   **TODAS las materias cursadas** (aprobadas y reprobadas), ver §7.
6. **Escalas de nota** a confirmar con el normativo UDB (1–10) antes de implementar validaciones.

---

## 7. Reglas de negocio del cálculo (confirmadas)

**Decisión:** el denominador del C.U.M incluye **todas las materias cursadas**, no solo las aprobadas.

```
U.M de la materia i  =  Nota final_i × UV_i
C.U.M                =  Σ (Nota_i × UV_i)  /  Σ UV_i     [para TODAS las materias cursadas]
```

- Cada materia **una sola entrada** en el cálculo (su UV cuenta en el denominador **una vez**).
- Es, en la práctica, un **promedio ponderado por UV** de todas las materias registradas.
- Las materias **reprobadas** sí diluyen el C.U.M (su UV entra al denominador con su nota real en el numerador).
- Las UV de cada materia provienen del **pensum del plan** bajo el cual cursó el estudiante (no del dato ingresado a mano).

**Regla de repitencia (confirmada):** si una materia se cursa más de una vez, cuenta **una sola vez con su
última nota**; su UV entra **una sola vez** al denominador.

**Alcance de la v1 (confirmado):**
- **Solo pregrado**: Ingenierías, Licenciaturas, Técnicos y Profesorados de las 3 sedes/modalidades
  (Soyapango, Antiguo Cuscatlán, UDB Virtual). Se excluyen Maestrías y Doctorados.
- **Dataset completo**: se extraen los ~50 pensums de pregrado (presencial + virtual), con código, nombre,
  UV, ciclo y prerrequisito de cada asignatura. No se hace versión piloto acotada.

**Pendientes menores (no bloquean la arquitectura):**
- Escala de notas y nota mínima de aprobación (solo afecta validaciones/UX, no la fórmula).
