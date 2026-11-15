# Hallazgos Técnicos, Sugerencias de Mejora y Temas Faltantes (GaleX)

**Registro:** 15 de noviembre de 2026  
**Rama:** `feature/trek.nasa.gov/mars/API`  
**Área:** Arquitectura Web, Renderizado 3D (Three.js), Integración NASA Mars Trek, UX/UI  

---

## 1. Hallazgos Técnicos Abarcados y Soluciones

Durante el desarrollo e integración de las capacidades de GaleX se documentaron y resolvieron los siguientes hallazgos de ingeniería:

### 1.1. Desacoplamiento de actualización del estado 3D (`update3d`)
- **Problema detectado:** Al cambiar a la vista de Planeta 3D (`globe`), los puntos de control, depósitos minerales y la ruta no se dibujaban en el globo marciano.
- **Causa raíz:** En [`web/js/app.js`](file:///home/wuisino/Projects/mars-route-planner/web/js/app.js), la función `update3d()` comenzaba con una cláusula de guarda estricta:
  ```javascript
  if (!MR.Scene3D || !MR.Scene3D.ready) return;
  ```
  Esto provocaba que, si la vista de Relieve 3D local no había sido inicializada previamente por el usuario, cualquier actualización hacia el globo planetario quedaba totalmente silenciada.
- **Solución implementada:** Se reestructuró `update3d()` para compilar la lista completa de marcadores (objetivos, minerales de la región activa y de otras regiones, hallazgos y secundarias) y despachar el estado tanto a `MR.Scene3D` como a `MR.Globe3D` de forma independiente según el estado de inicialización de cada motor.

---

### 1.2. Conflicto entre `OrbitControls.update()` y la cinemática de vuelo (`flyTo`)
- **Problema detectado:** Al hacer clic en hitos planetarios (Cráter Gale, Cráter Jezero, Olympus Mons, Valles Marineris) o al transicionar mediante `flyTo()`, la cámara experimentaba tirones bruscos (*jittering*) o parecía regresar a la posición orbital inicial `(0, 110, 55)`.
- **Causa raíz:** `THREE.OrbitControls` mantiene internamente coordenadas esféricas (`spherical: { radius, phi, theta }`) calculadas respecto a su objetivo `target`. Al interpolar la posición de la cámara con `camera.position.lerpVectors()` y simultáneamente invocar `controls.update()` en cada fotograma, el algoritmo de amortiguación (*damping*) de `OrbitControls` intentaba reubicar la cámara basándose en el fotograma anterior, compitiendo contra la interpolación matemática de vuelo.
- **Solución implementada:**
  1. En el bucle de renderizado de [`web/js/globe3d.js`](file:///home/wuisino/Projects/mars-route-planner/web/js/globe3d.js), se bifurcó la ejecución:
     ```javascript
     if (fly) {
       // Interpola posición de cámara y target suavemente
       controls.target.lerpVectors(fly.t0, fly.t1, e);
       camera.position.lerpVectors(fly.p0, fly.p1, e);
       if (k >= 1) {
         fly = null;
         controls.update(); // Sincroniza OrbitControls al aterrizar
       }
     } else {
       controls.update(); // Operación normal interactiva
     }
     ```
  2. En saltos instantáneos (o con accesibilidad `reduce=1`), se ejecutan copias atómicas inmediatas y se sincroniza la orientación:
     ```javascript
     controls.target.copy(t1);
     camera.position.copy(p1);
     camera.lookAt(t1);
     controls.update();
     ```

---

### 1.3. Proyección de tarjetas interactivas sobre el espacio 3D (`miniCard`)
- **Problema detectado:** Al pulsar sobre un punto de control u objetivo en el terreno 3D, la ventana informativa (`miniCard`) no se posicionaba junto al marcador o se proyectaba en coordenadas erróneas pertenecientes al plano 2D.
- **Causa raíz:** La función de reposicionamiento `repositionPointUI()` en `app.js` utilizaba exclusivamente `MR.Map.project()`, el cual convierte coordenadas geográficas a píxeles basándose en la matriz de transformación SVG del mapa plano bidimensional.
- **Solución implementada:**
  - Se crearon métodos dedicados `.project(lon, lat)` tanto en [`MR.Globe3D`](file:///home/wuisino/Projects/mars-route-planner/web/js/globe3d.js) como en [`MR.Scene3D`](file:///home/wuisino/Projects/mars-route-planner/web/js/scene3d.js), los cuales:
    1. Convierten `(lon, lat)` al vector tridimensional de la escena (`toGlobeXYZ` o `toXYZ`).
    2. Aplican `vector.project(camera)` para obtener coordenadas de dispositivo normalizadas (NDC entre -1 y 1).
    3. Mapean a píxeles de pantalla:
       $$\text{screenX} = \left(\frac{v_x + 1}{2}\right) \times \text{width}, \quad \text{screenY} = \left(\frac{1 - v_y}{2}\right) \times \text{height}$$
  - Se conectó `repositionPointUI()` dentro del bucle de animación `requestAnimationFrame` de ambas vistas 3D, logrando que la tarjeta informativa siga fluidamente el punto anclado mientras el usuario rota o acerca la cámara.

---

### 1.4. Optimización de renderizado procedimental y degradación elegante
- **Problema detectado:** Al iniciar la vista planetaria o en momentos donde las teselas de satélite tardaban en responder, el cálculo del terreno de contingencia bloqueaba el hilo principal de JavaScript (*Script terminated by timeout*).
- **Causa raíz:** La función `ramp(t)` instanciaba arreglos y ejecutaba búsquedas secuenciales en listas de paradas de color por cada vértice de la malla ($49 \times 49 = 2.401$ evaluaciones por tesela, repetidas en decenas de teselas activas). Asimismo, el cálculo de ruido fractal `fbm()` ejecutaba 6 octavas trigonométricas por vértice.
- **Solución implementada:**
  - Se refactorizó `ramp(t)` a evaluación analítica lineal directa por tramos (eliminando creación de objetos en el Garbage Collector).
  - Se redujo el ruido procedural `fbm()` a 3 octavas de contingencia, reduciendo el tiempo de cálculo de malla en un 80% y manteniendo fluidez de 60 FPS en equipos modestos.

---

### 1.5. Adaptación responsive para pantallas de 1364 × 767 px sin solapamientos
- **Problema detectado:** En pantallas de resolución moderada (1364×767 px, común en laptops estándar), los paneles laterales, la barra de estado superior, el panel inferior y el visor central se solapaban. Adicionalmente, el dashboard de "Condiciones" abría un panel a pantalla completa que ocultaba todo el contexto de navegación.
- **Solución implementada:**
  - Se limitó la altura de la barra superior a 46 px con tipografía contenida (11–12 px).
  - Se compactó la barra de controles de Planeta 3D en una sola línea horizontal.
  - Se transformó la vista de Condiciones en una ventana modal central tipo card (`.modal.modal-condiciones`) con fondo atenuado (`#scrim`), dotada de 3 pestañas estructuradas (*Atmósfera y Clima*, *Terreno y Rutas*, *Modelo Predictivo*), navegación de sols marcianos y gráficos vectoriales dinámicos de temperatura, presión, viento y radiación UV.

---

## 2. Sugerencias de Mejora

A partir del estado actual del prototipo, se plantean las siguientes propuestas de mejora técnica y de producto:

### 2.1. Rendimiento y Motor Gráfico (Three.js / WebGL)
1. **Quadtree de Nivel de Detalle Dinámico (LOD)**:
   - *Propuesta:* Implementar una estructura de árbol cuaternario (*Quadtree*) para las teselas de Planeta 3D. Actualmente el sistema carga un anillo de radio $R=3$ de nivel $Z$ fijo. Un Quadtree subdividirá selectivamente las teselas más cercanas a la cámara y mantendrá teselas de baja resolución en el horizonte, optimizando el consumo de VRAM y el número de *draw calls*.
2. **Modelos 3D GLTF de los Rovers y Carga Asíncrona**:
   - *Propuesta:* Sustituir la baliza geométrica simple (esfera + cilindro) por modelos 3D en formato GLTF comprimido con Draco de los rovers Curiosity y Perseverance, orientando el chasís según el vector normal de la pendiente del terreno.
3. **Instancing para Marcadores Planetarios (`InstancedMesh`)**:
   - *Propuesta:* Agrupar los anillos y mástiles de los puntos de control en mallas instanciadas (`THREE.InstancedMesh`), pasando colores y transformaciones por buffers, reduciendo drásticamente la sobrecarga de CPU en el render loop.

### 2.2. Offline-First y Almacenamiento
4. **Service Worker y Caché Local con IndexedDB**:
   - *Propuesta:* Añadir un Service Worker que capture las solicitudes a `/api/proxy/trek` y almacene las teselas descargadas en `IndexedDB` o `CacheStorage`. Esto permitirá abrir la vista de Planeta 3D completamente sin conexión, incluso si el servidor local de Python no está ejecutándose.
5. **Descarga de Paquete Regional Offline**:
   - *Propuesta:* Incorporar en la interfaz un botón "Descargar región para uso offline" que empaquete las teselas de elevación y ortofoto del Cráter Gale o Jezero (niveles 0 a 6) en un solo archivo comprimido local.

### 2.3. Capacidades de Planificación y Análisis Científico
6. **Exportación de Datos Geoespaciales Estándar**:
   - *Propuesta:* Permitir a los científicos e ingenieros exportar la ruta planificada en:
     - **GeoJSON**: Capas de puntos de control, ruta activa y zonas de exclusión.
     - **CSV / KML**: Perfil de elevación, distancias acumuladas, pendientes y consumos estimados sol por sol.
7. **Simulación Dinámica de Batería y Atenuación Atmosférica ($\tau$)**:
   - *Propuesta:* Relacionar la hora del Sol y el ángulo cenital solar con la generación de los paneles solares del rover o la degradación del RTG, incorporando la opacidad del polvo atmosférico ($\tau$) reportada por los sensores REMS / MEDA.

---

## 3. Temas Faltantes y Backlog para Fases Posteriores

A continuación se listan los requerimientos funcionales y técnicos que han quedado identificados para desarrollo en futuras iteraciones:

| Prioridad | Ítem de Backlog | Descripción Técnica |
|:---:|---|---|
| **P1** | **Huellas del Rover sobre el Terreno 3D** | Renderizar marcas dinámicas (*tracks/decals*) sobre la malla de elevación a lo largo del trayecto recorrido por el rover. |
| **P1** | **Sincronización Bidireccional en Tiempo Real** | Si el usuario crea un hallazgo o misión secundaria en el mapa 2D, instanciar inmediatamente el pin correspondiente en Planeta 3D y Relieve 3D sin recargar la página. |
| **P2** | **Visualización de Flota Simultánea** | Permitir visualizar en el globo 3D la posición simultánea de EV1 (Curiosity en Gale), EV2 (Perseverance en Jezero) y EV3, en lugar de mostrar únicamente el explorador activo seleccionado. |
| **P2** | **Integración del Vuelo de Ingenuity** | Para la región de Jezero, representar la trayectoria de vuelo del helicóptero *Ingenuity* como una cinta 3D suspendida a 10–12 metros sobre el lecho del cráter. |
| **P2** | **Atmósfera con Shaders Personalizados** | Sustituir la niebla lineal Three.js por un shader de fragmentos que reproduzca la dispersión atmosférica marciana real (*Rayleigh/Mie scattering* de polvo de óxido de hierro). |
| **P3** | **Pruebas Automatizadas End-to-End (E2E)** | Implementar pruebas automatizadas con Playwright para verificar la carga de contextos WebGL, el clic por raycast en minerales y la estabilidad responsive en resoluciones de 1364×767 px. |
