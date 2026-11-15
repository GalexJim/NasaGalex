# Resumen Ejecutivo de Sesiones, Hallazgos Técnicos y Propuestas de Mejora (GaleX / Mars Route Planner)

**Registro:** 15 de noviembre de 2026  
**Rama de trabajo:** `feature/trek.nasa.gov/mars/API`  
**Entorno de ejecución:** Linux (x86_64), Python 3.14.7, Three.js (WebGL), NASA Mars Trek API / WMTS  
**Resolución objetivo de visualización:** Laptops compactas (1364 × 767 / 1366 × 768) y escritorio estándar  

---

## 1. Contexto y Objetivos de la Intervención

A lo largo de las sesiones de trabajo se abordaron requerimientos fundamentales para evolucionar el prototipo **GaleX (Mars Route Planner)** hacia una plataforma de navegación planetaria integrada, unificada, responsiva y científicamente rigurosa. Los objetivos principales fueron:

1. **Unificación de la experiencia de usuario en un único endpoint (`http://127.0.0.1:8000/`)**: Eliminar pestañas y páginas huérfanas (como `mars-terreno-3d.html`), consolidando la navegación entre **Mapa 2D**, **Relieve 3D** (cráter local) y **Planeta 3D** (globo orbital con datos NASA Mars Trek) bajo la misma barra de navegación, controles y estado reactivo.
2. **Sincronización y Merge con `origin/main`**: Integrar sin conflictos los commits de la rama principal (soporte de teselas DEM locales en `3dView/dem_tiles/`, proxy persistente de teselas NASA Trek en `backend/server.py` y catálogo de capas).
3. **Integración de Capas Científicas NASA Mars Trek en Planeta 3D**: Incorporar mosaicos hipsométricos, de sombreado morfológico, albedo óptico y superposiciones espectrales (MOLA/HRSC, Viking MDIM 2.1, TES Inercia Térmica y TES Plagioclasa) con compositing en tiempo real sobre texturas dinámicas Canvas 2D.
4. **Diseño Responsive y Ergonomía Visual en Pantallas de Laptop (1364 × 767)**: Reestructurar la interfaz de usuario para garantizar que ninguna ventana o panel tape el área de trabajo ni genere solapamientos, transformando la vista de "Condiciones de Misión" de una pantalla completa invasiva a una ventana central flotante modular.
5. **Homologación de Puntos de Control, Minerales y Rutas en Planeta 3D**: Trasladar toda la riqueza interactiva y científica de la vista de Relieve 3D a la vista global de Planeta 3D (pines 3D de objetivos, cristales minerales rotatorios con colores por categoría geológica, rutas en tubos 3D, baliza pulsante del rover y raycasting interactivo con fichas proyectadas).

---

## 2. Cronología de Solicitudes y Soluciones Implementadas

### 2.1. Sincronización y Merge de Cambios desde `main`
- **Requerimiento:** Evaluar qué modificaciones traía `origin/main` (commit `3956504`), verificar posibles colisiones con los documentos de trabajo y realizar el merge e integración en el prototipo.
- **Solución:**
  - Se ejecutó un *fast-forward merge* limpio de `origin/main`.
  - Se verificó la disponibilidad del proxy local en `/api/proxy/trek` con almacenamiento persistente en disco para evitar sobrecargar los servidores de la NASA y garantizar funcionamiento offline-first.
  - Se comprobó la integridad de las 7 carpetas de niveles de zoom DEM (`0` a `6`) en `3dView/dem_tiles/`.

### 2.2. Integración de la GUI Unificada para Planeta 3D
- **Requerimiento:** Adherir el visor 3D del planeta dentro de la aplicación principal (`http://127.0.0.1:8000/`) compartiendo los controles superiores, cambio de región, selector de vistas y misiones, sin saltar a pestañas independientes.
- **Solución:**
  - Se incorporó el botón `Planeta 3D` dentro del selector de vistas `.viewswitch` (`web/index.html` y `web/js/app.js`).
  - Se crearon contenedores dedicados `#mapGlobe` y panel de control HUD `#ctlGlobe`.
  - Se modularizó el motor en [`web/js/globe3d.js`](file:///home/wuisino/Projects/mars-route-planner/web/js/globe3d.js) (`MR.Globe3D`), con ciclo de vida completo (`init()`, `start()`, `stop()`, `resize()`, `goToRegion()`).

### 2.3. Catálogo Multi-Capa NASA Mars Trek y Compositing Dinámico
- **Requerimiento:** Aplicar las capas científicas oficiales de la NASA obtenidas desde Mars Trek API, con control de visibilidad, opacidad y metadatos explicativos.
- **Capas implementadas:**
  1. *MGS MOLA + Mars Express HRSC ClrShade* (Base, 200 m/px): Hipsometría láser de -8.200 m a +21.200 m.
  2. *MGS MOLA + Mars Express HRSC Shade* (Base, 200 m/px): Sombreado pancromático estructural.
  3. *Viking Orbiter Color Mosaic MDIM 2.1* (Base, 232 m/px): Color real óptico del albedo superficial.
  4. *MGS TES Global Thermal Inertia* (Overlay, 3 km/px): Inercia térmica (polvo vs. roca consolidada).
  5. *MGS TES Global Plagioclase Abundance* (Overlay, 3 km/px): Abundancia volumétrica del feldespato ígneo.
- **Solución técnica:**
  - Compositing en lienzo Canvas 2D de 256×256 px por cada tesela, renderizando la capa base al 100% y aplicando las capas de superposición con su `globalAlpha` configurable mediante sliders.
  - Panel lateral reactivo con miniaturas, botones de alternancia, controles de opacidad y ventanas emergentes de descripción científica.

### 2.4. Optimización UX/UI para Laptops (1364 × 767)
- **Requerimiento:** Adaptar la interfaz para pantallas de tamaño moderado de computadores portátiles (específicamente 1364×767 px), evitando solapamientos y rediseñando la vista de Condiciones para no bloquear el lienzo.
- **Solución:**
  - **Barra de estado superior (`.statusbar`)**: Altura reducida a 46 px, márgenes compactos, tamaño de fuente optimizado (11–12 px) y disposición horizontal fluida.
  - **Selector de vistas (`.viewswitch`)**: Diseño flotante tipo píldora translúcida con `backdrop-filter: blur(8px)`.
  - **Control de Planeta 3D (`#ctlGlobe`)**: Agrupación en una sola fila compacta (slider de exageración, botones de capas rápidas, accesos a hitos planetarios y lectura de coordenadas).
  - **HUD Dock inferior (`#dock`)**: Reubicación y contención para evitar invadir las áreas interactivas del mapa.
  - **Refactorización de "Condiciones de Misión"**:
    - Se eliminó la clase `.fullview` que tomaba el 100% de la ventana.
    - Se transformó en una ventana modal central (`.modal.modal-condiciones`) de 740 × 580 px máximos (86vw × 84vh), centrada con fondo oscuro difuminado (`#scrim`).
    - Se conservaron intactas las 3 pestañas: *Atmósfera y Clima* (gráficos REMS de temperatura, presión, viento y radiación UV por Sol), *Terreno y Rutas* (resumen de pendientes, rugosidad y facilidad de paso) y *Modelo Predictivo* (coeficientes del modelo Random Forest y pesos A*).

### 2.5. Puntos de Control, Minerales y Rutas en Planeta 3D
- **Requerimiento:** Implementar en la vista de Planeta 3D los puntos de control, depósitos minerales, rutas activas y posición del rover de forma idéntica a Relieve 3D.
- **Solución:**
  - **Geometrías 3D diferenciadas**: Conos para metas, cilindros para bases, prismas hexagonales para refugios y octaedros para ciencia/referencia.
  - **Cristales minerales animados**: Diamantes octaédricos que giran continuamente sobre su eje Y, acompañados de un anillo de pulso en el suelo y un mástil luminoso.
  - **Colores por categoría mineralógica**:
    - *Carbonatos / Olivino*: `#00D26A` (verde esmeralda).
    - *Arcillas / Filosilicatos*: `#00C8E0` (azul cian).
    - *Sulfatos hidratados*: `#4DA6FF` (azul azur).
    - *Óxidos de hierro*: `#FF7043` (ámbar / óxido).
    - *Silicatos basálticos*: `#90A4AE` (gris pizarra).
  - **Rutas en tubos 3D**: Tubo azul para la ruta activa (`#4D8DFF`), tubo verde para el trayecto ya completado (`#46C882`), y tubos violetas para misiones secundarias (`#A68BFF`).
  - **Rover baliza**: Esfera del color del explorador con haz vertical translúcido pulsante que avanza con la simulación en tiempo real.
  - **Escala adaptativa (`pinScale`)**: Cálculo dinámico en el render loop en función de `camera.position.distanceTo(controls.target)`, logrando que los pines sean claramente visibles tanto en órbita global como a nivel de cráter sin tapar el terreno.
  - **Proyección de pantalla y Raycasting**:
    - Implementación de [`MR.Globe3D.project(lon, lat)`](file:///home/wuisino/Projects/mars-route-planner/web/js/globe3d.js) y [`MR.Scene3D.project(lon, lat)`](file:///home/wuisino/Projects/mars-route-planner/web/js/scene3d.js) para anclar tarjetas interactivas (`miniCard`) sobre el espacio 3D.
    - Detección precisa de clic y hover: cursor pointer, tooltips informativos inmediatos y apertura de fichas científicas y de misión.

---

## 3. Hallazgos Técnicos y Arquitectónicos

Durante el desarrollo e integración se identificaron y solucionaron diversos desafíos técnicos relevantes:

| # | Hallazgo Técnico | Diagnóstico | Solución Implementada |
|---|---|---|---|
| **1** | Bloqueo en actualización de estado (`update3d`) | `web/js/app.js` contenía un retorno temprano `if (!MR.Scene3D \|\| !MR.Scene3D.ready) return;`, lo que impedía que `MR.Globe3D` recibiera rutas, minerales y pines si no se había inicializado la vista local de relieve. | Se desacopló la función `update3d()` para actualizar independientemente `MR.Scene3D` y `MR.Globe3D` según su disponibilidad. |
| **2** | Conflicto entre `OrbitControls` e interpolación de vuelo | Al ejecutar `flyTo()`, `camera.position.lerpVectors()` modificaba la posición de la cámara, pero en cada fotograma `controls.update()` recalculaba las coordenadas esféricas del control con amortiguación (*damping*), generando tirones o regresión de posición. | Se condicionó el bucle de renderizado: si `fly` está activo se omiten los cálculos de `controls.update()`, y al finalizar el vuelo se invoca `controls.update()` una sola vez para sincronizar los ángulos orbitales. |
| **3** | Proyección de tarjetas flotantes (`miniCard`) | El sistema de tarjetas emergentes invocaba exclusivamente `MR.Map.project()` (diseñado sólo para 2D SVG), haciendo que al hacer clic en un pin 3D la tarjeta apareciera en coordenadas desfasadas o fijas. | Se añadieron métodos `.project(lon, lat)` en `MR.Globe3D` y `MR.Scene3D` utilizando `Vector3.project(camera)` y las dimensiones del viewport, enlazándolos con `repositionPointUI()` en cada fotograma. |
| **4** | Sobrecarga computacional en `ramp()` y `fbm()` procedimental | En situaciones sin conexión o demora de teselas, la generación de mallas con resolución `SEGS = 48` evaluaba ruido fractal de 6 octavas y búsquedas en arreglos para 2.401 vértices por tesela sincrónicamente, causando advertencias de tiempo de ejecución en navegadores limitados. | Se optimizó `ramp(t)` a cálculo analítico directo por ramas sin asignación de arrays temporales y se redujo `fbm` a 3 octavas para el fallback de contingencia. |
| **5** | Captura de pantalla en navegadores headless | Al tomar capturas automatizadas con Firefox en modo headless bajo Linux, las transiciones CSS (.28s) provocaban capturas semitransparentes. | Se incorporó soporte de `reduce=1` por parámetro URL, forzando `html.reduce` para que todas las animaciones y vuelos cinemáticos sean instantáneos durante pruebas y verificaciones visuales. |

---

## 4. Sugerencias de Mejora

Con base en la experiencia obtenida en la integración, se proponen las siguientes mejoras para las próximas fases:

### 4.1. Rendimiento y Gráficos 3D
1. **Nivel de Detalle Dinámico (LOD) mediante Quadtree Estricto**:
   - Implementar un árbol cuaternario (Quadtree) jerárquico que divida únicamente las teselas visibles en el cono de visión (*frustum culling*) y fusione las teselas distantes, reduciendo drásticamente el consumo de memoria en dispositivos móviles y GPUs integradas.
2. **Modelos 3D GLTF/GLB del Rover**:
   - Reemplazar las primitivas geométricas (esfera y cilindro) por modelos 3D optimizados en formato GLTF con textura PBR del rover Curiosity y Perseverance, incluyendo animación de orientación de ruedas según la pendiente.
3. **Efecto de Atmósfera y Dispersión Rayleigh Marciana**:
   - Reemplazar la niebla lineal simple (`THREE.Fog`) por un shader personalizado de dispersión atmosférica que simule el cielo asalmonado/rojizo característico de Marte y el horizonte azulado en los atardeceres.

### 4.2. Persistencia y Capacidades Offline
4. **Caché Completa mediante Service Worker e IndexedDB**:
   - Si bien el servidor local en Python almacena en caché las teselas de NASA Trek, implementar un Service Worker en el cliente que guarde en `CacheStorage` o `IndexedDB` las teselas visualizadas, permitiendo que la aplicación funcione al 100% de manera autónoma incluso si el backend se apaga temporalmente.
5. **Precarga Regional Inteligente (Prefetch)**:
   - Al seleccionar "Cráter Gale" o "Cráter Jezero", disparar una precarga en segundo plano de las teselas de niveles de zoom 4, 5 y 6 correspondientes al bounding box del cráter.

### 4.3. Herramientas Científicas y de Análisis
6. **Exportación de Datos Geoespaciales**:
   - Habilitar descarga del plan de ruta generado en formatos estándar: **GeoJSON** (para visualización en QGIS/ArcGIS), **GeoTIFF** de la franja del recorrido y **CSV** con el perfil altimétrico y estimación de consumo de batería/oxígeno.
7. **Simulación de Longitud Solar ($L_s$) y Polvo Atmosférico ($\tau$)**:
   - Conectar la hora del Sol con la inclinación del vector de luz solar (`sun.position`) y el parámetro de opacidad del polvo ($\tau$), simulando el impacto real en los paneles solares y la visibilidad de los instrumentos ópticos.

---

## 5. Temas Faltantes y Próximos Pasos (Backlog)

Los siguientes ítems se identifican como temas complementarios que no formaron parte del alcance inmediato de esta iteración o que requieren desarrollo posterior:

- [ ] **Animación de trazas y rodaduras sobre el terreno**: Generación de mallas dinámicas o calcomanías (*decals*) que dejen las marcas de las ruedas del rover sobre la textura del terreno conforme avanza la simulación.
- [ ] **Sincronización bidireccional de marcadores de usuario en vivo**: Cuando el usuario crea un hallazgo o una nueva misión secundaria en el mapa 2D mediante clic derecho/menú contextual, reflejar de forma inmediata el nuevo pin 3D en Planeta 3D sin requerir recálculo de ruta.
- [ ] **Soporte simultáneo de múltiples exploradores en el Planeta 3D**: Mostrar simultáneamente las posiciones de EV1, EV2 y EV3 en sus respectivas rutas sobre el globo terráqueo en vez de conmutar sólo al explorador activo.
- [ ] **Integración del helicóptero Ingenuity**: Para la región de Jezero, añadir la trayectoria aérea de los vuelos de Ingenuity como una ruta aérea 3D elevada sobre el lecho del cráter.
- [ ] **Pruebas Automatizadas End-to-End (E2E)**: Implementar una suite de pruebas con Playwright o Cypress que verifique la inicialización de WebGL, el clic en marcadores 3D mediante coordenadas simuladas y la apertura correcta de los modales.

---

## 6. Verificación y Commits Clave

Las modificaciones documentadas han sido validadas mediante pruebas de sintaxis JavaScript (`node -c`), suite de pruebas de dominio y almacenamiento (`pytest tests/test_smoke.py`), y capturas fotográficas en resolución de laptop (1364×767 px).

**Commits de referencia en `feature/trek.nasa.gov/mars/API`:**
- `3956504`: Merge de `origin/main` con soporte de teselas DEM y proxy persistente.
- `5e82b5e`: Optimización responsive de interfaz para laptops (1366×768 / 1364×767 px).
- `73adfc7`: Refactorización de Condiciones de Misión a ventana modal central con 3 pestañas.
- `76e13ed`: Implementación de puntos de control, depósitos minerales interactivos, tubos de ruta y telemetría en Planeta 3D.
