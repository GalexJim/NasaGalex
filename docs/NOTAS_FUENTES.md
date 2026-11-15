# Notas de fuentes — qué aporta cada insumo y qué se puede reutilizar

Estado: Fase 0 (revisión de insumos). Última revisión: 2026-11-15.

## Cómo se revisó

- Los insumos **no están dentro del repo**: viven en `Nasa_Challenge/Fuentes/` (carpeta hermana del proyecto). Se leyeron ahí, sin copiarlos al repo.
- Los PDF se leyeron por su capa de texto (`pdftotext`). **No se interpretaron figuras, tablas-imagen ni notas al margen**: si una cifra solo aparece en una imagen, no está recogida aquí.
- `SPOC-master.zip` y `spoc_lite-master.zip` se extrajeron a una carpeta temporal fuera del repo y se inspeccionaron sin ejecutar nada.
- También hay en `Fuentes/Codes/` `ISIS3-dev.zip` y `open-source-rover-master.zip`. No estaban en la lista de la tarea y **no se leyeron**.
- El PDF «Flujo de interacciones base» (reglas de UX) **no está** en el repo ni en `Fuentes/`. Las reglas de UX que se aplican son las que vienen en el enunciado de la tarea (máximo 5 datos en vivo, cada uno con "?" y fuente, paneles poco cargados).

## Resumen por insumo

| Insumo | Qué es | Fases que apoya | ¿Reutilizable? |
|---|---|---|---|
| Simonsen (NASA HQ, 6-ago-2024) | Presentación sobre el entorno de radiación en Marte y riesgos para la salud | 1 | Cifras citables (con fuente). Sin código. |
| Tasoula et al., *Space Radiation Book Chapter* | Capítulo de libro sobre radiación espacial y salud | 1 | Cifras y límites citables. Sin código. |
| Nelson (NASA, 14-oct-2021), *Beyond Artemis III – EVA Gap* | Resumen de brechas tecnológicas de EVA | 3 (solo marco cualitativo) | Ninguna cifra operativa. |
| Bennett et al. 2023 (JGR Planets) | Campaña de Curiosity en Glen Torridon | 2 | Solo como cita. Licencia restrictiva. |
| Brown et al. 2024 (JOSS 07256) | Artículo sobre la librería `pdr` (lector de datos PDS) | Opcional, scripts | Idea de herramienta; la licencia del software no está en el artículo. |
| SPOC-master.zip | Sitio web de SPOC (HTML/CSS/imágenes) | 2 (solo conceptos) | **No** (sin código, sin licencia). |
| spoc_lite-master.zip | Clasificador de arena C++/ROS | 2 (solo conceptos) | **No** (licencia "TODO", sin LICENSE). |

## 1. Simonsen — *The Martian Radiation Environment and Human Health Risks* (NASA HQ, 6-ago-2024)

Presentación para el panel de la National Academies *A Science Strategy for the Human Exploration of Mars*. Es material de agencia, de acceso público. Se cita por el título de la diapositiva (el texto extraído no conserva la numeración).

**Valores que se pueden citar** (todos con su diapositiva):

| Dato | Valor | Diapositiva |
|---|---|---|
| Tasa de dosis equivalente en superficie de Marte | ≈ 0,65 mSv/día, similar a la ISS | *Comparison of Radiation Exposures & Environments* |
| MSL-RAD en el piso de Gale (23 g/cm² de CO₂), 2012–2017 | ≈ 0,64 mSv/día (0,21 mGy/día); en tránsito 1,7 mSv/día | *MSL RAD measured Dose Rates* |
| Columna de atmósfera en Gale | ≈ 21–23 g/cm² (≈ 1000 g/cm² en la Tierra) | *Interaction of free space radiation…* |
| GCR (rayos cósmicos galácticos) | ~89 % protones, ~10 % He, ~1 % núcleos pesados; difíciles de blindar | *Space Radiation Environment* |
| Ciclo solar | Máximo solar: más probabilidad de SPE y menos GCR (≈ 50 % menos de dosis efectiva GCR) | *Space Radiation Environment*, *GCR Shielding* |
| SPE (eventos de partículas solares) en MSL-RAD | La tasa de dosis salta ×10 a ×100 en tránsito, pero aporta solo ≈ 5 % de la dosis total del viaje | *MSL RAD measured Dose Rates* |
| Límite permisible de dosis efectiva por un SPE | 250 mSv | *Solar Particle Events – Requirements & Design Guidance* |
| Dosis estimada por un SPE grande en superficie de Marte | ≈ 40 mSv sin blindaje; ≈ 25 mSv con refugio de 10 cm de agua equivalente (espectro de referencia: suma de eventos de oct-1989) | ídem |
| Límite de carrera | 600 mSv | *Risk Posture for Mars Demo Mission* |
| Salidas lunares (Artemis, 30 días) | 40–60 mSv | *Comparison of Radiation Exposures…* |
| Brecha declarada | El pronóstico de SPE y el monitoreo independiente de la Tierra siguen siendo una carencia | *Space Radiation Protection Gaps* |

**Qué aporta al proyecto:** la tasa base de GCR en superficie y la escala del riesgo por SPE, con límites oficiales para fijar los umbrales de aviso y crítico.

**Límites de la fuente:** son valores promedio medidos en el piso del cráter, no una dosis por hora, ni por altura, ni dentro de un traje EVA. Ningún dato aquí permite calcular la dosis de un astronauta con traje en una pendiente concreta.

## 2. Tasoula et al. — *Health Impacts of Radiation in Space and Countermeasures* (capítulo de libro)

Coautor: Gregory A. Nelson (NASA JSC, disciplina CNS del elemento de radiación espacial). El PDF no trae año ni editorial; cita literatura hasta 2025. **La licencia no figura en el texto**: se puede citar, pero no copiar ni redistribuir su contenido hasta confirmarla.

**Valores que se pueden citar:**

| Dato | Valor |
|---|---|
| MSL-RAD (Zeitlin et al. 2013) | 1,84 mSv/día en tránsito y 0,7 mSv/día en superficie |
| Atmósfera de Marte | 15–25 g/cm² según la topografía; frena buena parte de los SPE, pero casi nada de los GCR |
| SPE y EVA | Protones > 30 MeV atraviesan los trajes EVA y pueden causar síndrome de radiación aguda (ARS) |
| Mitigación operativa | Pronóstico, monitoreo en tiempo real y retrasar, abortar o cancelar la EVA; refugios de tormenta |
| Refugios naturales | «Las estructuras geológicas naturales pueden usarse como refugio frente a SPE intensos» |
| Límites NASA (cita a NASA 2023) | Carrera: 600 mSv. SPE: dosis efectiva < 250 mSv. Cristalino: 1000 mGy-Eq en 30 días y 4000 mGy-Eq en la carrera |
| ARS | Efectos hematopoyéticos desde ~1 Gy; el texto describe fases prodrómica, latente y manifiesta |
| Incertidumbre | El modelo de riesgo de cáncer de la NASA estima una incertidumbre relativa de ≈ 260 % |

**Discrepancia anotada:** 0,7 mSv/día (capítulo, citando a Zeitlin 2013) frente a 0,64–0,65 mSv/día (Simonsen, citando a Hassler 2014). Son compatibles dentro de la variabilidad. El código actual ya usa `0.027 mSv/h` en EVA (`core.js:208`), que a 24 h da 0,648 mSv/día, coherente con ambas cifras.

**Qué aporta:** la justificación cualitativa de las alertas de radiación (por qué una EVA es el caso crítico y qué acciones ofrecer: pausar, abortar, volver al refugio), y la idea de que el relieve puede dar refugio.

## 3. Nelson — *Beyond Artemis III: EVA Gap Update & Overview* (14-oct-2021, STI 20210021737)

Presentación pública de Chris Nelson (EVA Strategic Planning & Architecture Lead). Sin restricciones de exportación.

**Qué dice (texto):**
- Hay más de 100 brechas que afectan la EVA en la arquitectura de exploración, ~88 de ellas en EVA de Marte.
- Tres tipos de brecha: **conocimiento** (parámetros de misión desconocidos que fijarán los requisitos), **desarrollo** y **tecnología**.
- Cuatro grandes áreas de desarrollo: reducción de masa, sistema suitport, informática (autonomía, comunicaciones, navegación, iluminación) y sistemas para vacío/atmósfera parcial (CO₂, térmico).
- Contexto Artemis: dos tripulantes, 6,5 días en superficie lunar, hasta cuatro caminatas más una quinta de reserva por contingencia.

**Lo que NO dice, y es importante para la Fase 3:** no contiene duración de la EVA, ritmos de caminata, pausas ni margen de reserva en horas o consumibles. La jornada de 08:00 a 17:00 y la función de Tobler adaptada **no se pueden justificar numéricamente con este documento**.

**Uso honesto en la Fase 3:** citarlo para el *marco*: los parámetros de la EVA en Marte son brechas de conocimiento abiertas, por eso la jornada, las pausas y la reserva se exponen como **supuestos configurables y rotulados como tales**. La estructura «caminatas planificadas + una de reserva» sirve de analogía para la reserva de seguridad, siempre indicando que es lunar, no marciana.

## 4. Bennett et al. 2023 — *The Curiosity Rover's Exploration of Glen Torridon* (JGR Planets, 10.1029/2022JE007185)

**Licencia: CC BY-NC-ND.** Se puede citar y parafrasear con atribución, sin uso comercial y **sin adaptar ni modificar** el texto. No se copian figuras ni tablas.

**Hechos que respaldan la Fase 2 (límites de usar el recorrido del rover como etiqueta):**
- El recorrido de Glen Torridon se definió con **waypoints de la ciencia** («identified by the science team in response to the overarching science questions»), no como el camino más fácil. La forma del recorrido refleja dónde estaba la geología de interés.
- Algunos waypoints están impuestos por el terreno: la entrada a Glen Torridon es un acantilado «for the most part not traversable by a rover», y el único punto de descenso seguro fijó el inicio del tramo. La ruta hacia la unidad de sulfatos tuvo que rodear los **Sands of Forvie** (campo de rizaduras).
- El rover llegó a una inclinación récord de **32,0°** al subir el escarpe del pedimento Greenheugh. Esto muestra que el recorrido contiene tramos más empinados que el veto de 20° del planificador. Es una **inclinación del rover**, no una pendiente promedio de celda de 44 m, y no se pueden comparar directamente.
- Requisitos de las operaciones del rover: para perforar necesita una superficie plana de al menos 10 cm; las huellas de rueda miden 40 cm.
- Recorrido total hasta la sol 3072: 24,9 km y 430 m de ascenso; dentro de Glen Torridon ≈ 5 km.

**Lo que el artículo no cubre** (no se debe atribuir a Bennett): trajes EVA, marcha humana, caídas, polvo en el visor, fatiga. Esos contrastes rover–astronauta son razonamiento propio y deben aparecer en `docs/` marcados como **supuestos**, no como hallazgos de la fuente.

## 5. Brown et al. 2024 — *PDR: The Planetary Data Reader* (JOSS 9(102), 7256)

- Artículo bajo **CC BY 4.0**. Se puede reutilizar con atribución.
- Describe `pdr`, una librería Python que lee productos PDS3/PDS4 (imágenes como `ndarray`, tablas como DataFrames). No se incluye el código; solo el artículo.
- **La licencia del software `pdr` no está en el artículo**. Hay que verificarla en su repositorio antes de depender de ella.
- Uso posible (opcional, no necesario para la web): sustituir el parser manual de `scripts/prepare_rems.py` o leer datos PDS de MSL-RAD para reemplazar con mediciones las cifras de dosis tomadas de las presentaciones. Requeriría una dependencia nueva y descargas de red; **no se hará sin tu aprobación**.

## 6. SPOC y SPOC-Lite (JPL/Caltech)

**`SPOC-master.zip`:** contiene solo el sitio web (`index.html`, CSS, fuentes, imágenes y videos). **No hay código del clasificador.** Pie de página: «© 2020 California Institute of Technology». No hay archivo de licencia.

**`spoc_lite-master.zip`:** clasificador de arena en C++/ROS (Ubuntu 14.04, ROS Indigo, `catkin`) con SVM (modelos `.model`, características LBP/DCT). **Los tres `package.xml` declaran `<license>TODO</license>` y no hay `LICENSE`.** Incluye una copia de `libsvm.cpp` y `linearsvm/blas` de terceros.

**Decisión de licencia: no se reutiliza ningún código de SPOC ni de SPOC-Lite.** Sin licencia explícita, los derechos quedan reservados por defecto, y técnicamente tampoco encaja: opera sobre imágenes de cámara de rover en ROS, no sobre capas orbitales en JavaScript.

**Conceptos que sí se pueden citar como contexto** (afirmaciones del sitio SPOC, no verificadas por nosotros):
- La movilidad de los rovers es muy sensible al tipo de terreno; Spirit quedó atrapado en arena y Opportunity y Curiosity también se atascaron.
- SPOC-HiRISE clasifica cada píxel de HiRISE en 17 clases a 25 cm y afirma >90 % de exactitud frente a etiquetas humanas.
- AI4Mars reunió 10 000+ etiquetas de ciudadanos sobre imágenes NAVCAM de Curiosity.
- SPOC-Lite entrega una probabilidad de arena con umbral configurable (por defecto 0,8): un patrón de diseño comparable al umbral configurable de nuestras alertas.

**Qué aporta a la Fase 2:** nuestro modelo de transitabilidad **no tiene clase de arena/suelo**, solo pendiente, rugosidad, textura óptica, gradiente y térmico. Hay que decirlo en «Limitaciones y supuestos», porque la arena es el riesgo principal documentado para los rovers.

## Observaciones sobre el repo que afectan a las fases siguientes

Surgieron al revisar `core.js`, `app.js` y los datos. Son hechos de la revisión, no cambios hechos.

1. **No hay repositorio git** en la carpeta del proyecto, así que los commits por fase requieren `git init` primero.
2. **Radiación ya existe en parte** (`core.js:208`): `radRate = 0.027 mSv/h` en EVA y `0.012 mSv/h` en rover. El valor de EVA equivale a ≈ 0,65 mSv/día (coincide con Simonsen). **El de 0,012 no tiene fuente** y debe marcarse como supuesto. Hoy solo se muestra en el panel de métricas de perfil (`app.js:350`).
3. **El panel de datos en vivo ya tiene exactamente 5 tarjetas** (Temperatura, Pendiente, Facilidad de paso, UV, Presión; `app.js:1823`). Añadir la radiación obliga a reemplazar o fusionar una.
4. **La jornada está fija en el código:** `EVA_START = 8`, `EVA_END = 17` (`app.js:24`), y la simulación avanza a un ritmo de 2 min marcianos por segundo real.
5. **La movilidad por defecto es `rover`** (`newTrip`, `app.js:30`) y `estimateHours` usa por defecto la velocidad de rover (`core.js:173`). El briefing llama «de caminata» a esas horas. Hay que comprobar en la Fase 3 si las horas del briefing salen de la función de caminata o de la del rover, antes de explicar por qué salen «4 a 5 soles».
6. **El bundle web solo lleva** `dem, slope, roughness, traversability, thermal, color_index, spectral, traverse_km, blocked`. **No incluye `texture` ni `gradient`**, y `data/processed/layers.npz` no está en el repo (está en `.gitignore`). En `data/raw/` sí están el DEM, la imagen óptica, THEMIS, Viking y el recorrido. Para medir incertidumbre entre árboles (Fase 2) hay que regenerar las capas con `scripts/build_layers.py` y cargar `models/terrain_model.joblib` (scikit-learn 1.8.0 está instalado); no se puede hacer solo con lo que ya viaja a la web.
7. **Persistencia del backend:** SQLite ya tiene `hallazgo`, `mensaje`, `mision` y `reporte`; el almacén JSONL (`backend/docstore.py`) maneja telemetría y objetivos. Encaja con la Fase 4 sin cambiar la arquitectura.

## Tabla de supuestos pendientes de rotular

| Supuesto | Dónde está | Estado |
|---|---|---|
| Dosis EVA 0,027 mSv/h | `core.js` | Respaldado (≈ 0,65 mSv/día, Simonsen) |
| Dosis rover 0,012 mSv/h (× 0,44 frente a caminar) | `core.js` (`MR.radiation.P.roverFactor`) | Rotulado «supuesto» en la interfaz (Fase 1) |
| Jornada EVA 08:00–17:00, pausas y reserva | `MR.eva` en `core.js` | Configurables y rotulados «supuesto» (Fase 3, `docs/JORNADA_EVA.md`) |
| Factor 0,55 del traje, 0,35 por terreno y × 0,6 en tramos empinados | `core.js` (`walkSpeed`, `speedAt`) | Sin fuente → «supuesto» (Fase 3) |
| O₂ 72 L/h, 576 L (8 h) para EVA; batería 12 kWh | `core.js:199–204` | Sin fuente → «supuesto» |
| Veto de pendiente 20° | `core.js:134` | Decisión de diseño del planificador, no un límite medido |

## Modelo de radiación de la Fase 1: qué es fuente y qué es supuesto

Implementado en `MR.radiation` (`web/js/core.js`). La interfaz rotula cada parámetro como FUENTE o SUPUESTO en Condiciones → Radiación.

| Parámetro | Tipo | Origen |
|---|---|---|
| Tasa base 0,65 mSv/día | Fuente | Simonsen 2024 (MSL-RAD, piso de Gale); Tasoula et al. citan 0,7 |
| Atmósfera de referencia ≈ 23 g/cm² | Fuente | Simonsen 2024 |
| 20 % de la dosis por albedo (no lo tapa el relieve) | Fuente | Simonsen 2024 |
| Escala de altura 11,1 km | Aproximación del prototipo | Ya usada para la presión en `MR.weather` |
| Sensibilidad a la altura (+50 % sin atmósfera) | **Supuesto** | Solo la dirección está respaldada |
| Blindaje por cielo visible del DEM | **Supuesto** | Geometría simple a 177 m por celda |
| Rover presurizado × 0,44 | **Supuesto** | Heredado del prototipo |
| Evento solar × 40 durante 36 h | **Supuesto** | Compatible con ×10–×100 medido en tránsito y con 40 mSv de referencia sin blindaje |
| Sin dosis dentro del refugio | **Supuesto** | Simplificación |
| Umbral de alerta 5 mSv por jornada | **Supuesto** | Umbral operativo de la app, no un límite de la NASA |

Solo vale para Gale: en Jezero se usa la tasa base sin ajuste por altura ni relieve.
