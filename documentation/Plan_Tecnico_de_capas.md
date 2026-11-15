# Plan técnico de GaleX

## 1. Identificación del proyecto

- **Categoría:** mapeo climático, planificación de rutas y apoyo a la exploración.
- **Producto:** aplicación web interactiva, offline-first.
- **Evento:** NASA Space Apps Challenge.
- **Entrega del MVP:** 15 de noviembre de 2026, 11:59 p. m. (America/Bogota).
- **Equipo:** 6 personas.
- **Idioma:** español por defecto, con selector a inglés.

## 2. Resumen ejecutivo

GaleX será un prototipo de apoyo a decisiones para la exploración humana y robótica de Marte. La aplicación integrará capas topográficas, ambientales y científicas procedentes de misiones de NASA con información simulada de estaciones meteorológicas automáticas distribuidas sobre una retícula marciana.

El astronauta podrá seleccionar un punto de partida, uno o varios objetivos científicos y un refugio final. El sistema propondrá rutas alternativas —segura, rápida y científica— considerando pendiente, características del terreno, tiempo, energía, oxígeno, temperatura, radiación y disponibilidad de refugios. Los operadores de misión y científicos podrán inspeccionar las mismas condiciones, rutas, alertas y reportes.

GaleX es una **demo científica y tecnológica**, no un sistema certificado para operaciones humanas. Toda información mostrada deberá identificar su procedencia como `OBSERVADA`, `DERIVADA` o `SIMULADA`.

## 3. Problema

Una caminata o recorrido robótico sobre Marte requiere combinar información que normalmente está separada:

- relieve, pendiente y rugosidad;
- temperatura, presión, viento, humedad y polvo;
- radiación UV e ionizante;
- capacidad de movilidad del explorador;
- oxígeno, energía, tiempo EVA y reservas de emergencia;
- objetivos científicos, minerales y lugares previamente observados por rovers;
- refugios o puntos seguros alcanzables.

Una ruta corta puede ser inviable por pendiente, terreno inestable, temperatura, radiación o falta de reservas. GaleX organizará estas variables en una vista común y explicará por qué recomienda o rechaza cada alternativa.

## 4. Objetivo general

Construir un MVP web offline-first que integre datos marcianos por capas y genere rutas explicables para astronautas y rovers, con funcionamiento offline, múltiples regiones y simulación de cambios ambientales mediante estaciones MDA.

## 5. Objetivos específicos

1. Visualizar Gale Crater y Jezero Crater mediante mapas por capas y una vista topográfica 2.5D.
2. Permitir seleccionar inicio, uno o varios objetivos y un refugio final.
3. Generar rutas alternativas con prioridades segura, rápida y científica.
4. Aplicar restricciones duras de pendiente, recursos, temperatura, radiación y alcance a refugios.
5. Representar oxígeno, energía, duración EVA y dosis acumulada como recursos consumibles.
6. Simular observaciones de estaciones MDA sobre una retícula de Marte.
7. Reproducir datos históricos NASA como una secuencia temporal acelerada.
8. Emitir alertas breves con detalle, causa, umbral, tramo afectado y acción recomendada.
9. Registrar descubrimientos, coordenadas, rutas y reportes en una bitácora local.
10. Preservar el prototipo actual de Gale como baseline reproducible.

## 6. Usuarios y roles

### 6.1 Astronauta

- planifica y ejecuta excursiones;
- selecciona objetivos y prioridades;
- consulta recursos, riesgos y refugios;
- recibe alertas y alternativas;
- registra descubrimientos y condiciones observadas.

### 6.2 Operador de misión

- monitorea posición, ruta, recursos y alertas;
- revisa la bitácora;
- prepara paquetes de datos para sincronización;
- analiza desviaciones entre ruta planeada y ejecutada.

### 6.3 Científico

- consulta capas e instrumentos;
- filtra objetivos por material o interés científico;
- revisa reportes y coordenadas;
- evalúa la procedencia e incertidumbre de los datos.

## 7. Regiones del MVP

### 7.1 Gale Crater

Será el escenario más completo porque el repositorio ya contiene:

- DEM y capas derivadas;
- recorrido de Curiosity;
- datos REMS;
- THEMIS, Viking, CRISM y detecciones minerales;
- modelo base y planificación A*;
- mapas, métricas y ruta de referencia.

La ruta Bradbury Landing–Mount Sharp se conservará como ejemplo técnico, no como misión EVA recomendada.

### 7.2 Jezero Crater

Será el segundo escenario del MVP para demostrar la arquitectura multirregión. Integrará, según disponibilidad local y tiempo de implementación:

- recorrido y lugares de Perseverance;
- contexto topográfico y visual de Jezero;
- observaciones MEDA;
- objetivos de PIXL, SHERLOC o SuperCam;
- refugios y estaciones MDA simulados.

Los objetivos asociados con minerales, ambientes habitables o posibles biofirmas se mostrarán como **lugares de interés científico**, nunca como evidencia confirmada de vida microbiana.

## 8. Retícula y estaciones MDA

En GaleX, **MDA** es la denominación del proyecto para estaciones meteorológicas automáticas hipotéticas. Su objetivo es medir condiciones locales y transmitirlas a un satélite o nodo de comunicaciones. No se afirmará que esta red existe actualmente en Marte.

![Retícula propuesta de Marte](image-2.png)

![Referencia visual de una estación MDA](image-3.png)

### 8.1 Modelo de retícula

- Cada región se divide en celdas identificables.
- El diseño conceptual propone una MDA por cada celda de la retícula.
- El MVP podrá instanciar sólo una muestra representativa de estaciones para mantener la demostración ejecutable dentro del plazo.
- Cada MDA se representa como un punto georreferenciado dentro de su celda.
- Una estación inactiva o todavía no simulada se mostrará como `SIN DATOS`; las estimaciones derivadas nunca sustituirán silenciosamente una observación.
- La resolución visual no se confundirá con la resolución real de los instrumentos.

### 8.2 Variables MDA propuestas

- temperatura del aire y del suelo;
- presión atmosférica;
- velocidad y dirección del viento;
- humedad relativa;
- opacidad y concentración de polvo;
- radiación UV;
- radiación ionizante o dosis estimada, cuando exista una fuente válida;
- estado de la estación, fecha marciana, calidad e incertidumbre.

### 8.3 Estados de procedencia

| Estado | Significado | Ejemplo |
|---|---|---|
| `OBSERVADA` | Medida por un instrumento real | REMS, MEDA, RAD |
| `DERIVADA` | Calculada a partir de observaciones | pendiente, rugosidad, costo energético |
| `SIMULADA` | Generada para la demo | mensajes de una MDA hipotética |

## 9. Capas de información

### 9.1 Terreno

- elevación;
- pendiente;
- rugosidad;
- sombras y contexto óptico;
- zonas bloqueadas;
- distancia a refugios y estaciones.

### 9.2 Ambiente

- temperatura;
- presión;
- viento;
- humedad;
- polvo y visibilidad;
- radiación UV;
- radiación ionizante y dosis acumulada.

![Referencia de mapa térmico](image.png)

![Referencia de visualización de viento](image-1.png)

### 9.3 Ciencia

- minerales hidratados;
- cobertura espectral;
- objetivos PIXL, SHERLOC y SuperCam;
- fotografías vinculadas a coordenadas;
- lugares de interés geológico o astrobiológico;
- muestras y descubrimientos reportados.

### 9.4 Operación

- posición actual;
- inicio, destinos y refugio final;
- ruta planeada y ruta recorrida;
- recursos restantes;
- alertas activas;
- estaciones MDA y estado de comunicación.

## 10. Datos y fuentes

### 10.1 Fuentes actuales y previstas

| Región/alcance | Fuente | Uso |
|---|---|---|
| Global/regional | NASA Mars Trek | DEM, imágenes, recorridos y capas de contexto |
| Global/regional | MRO MARCI/MCS | polvo y contexto meteorológico regional |
| Gale | Curiosity/REMS | temperatura, presión, humedad y UV local |
| Gale | Curiosity/RAD | radiación ionizante y dosis |
| Gale | Curiosity traverse | referencia de movilidad |
| Jezero | Perseverance/MEDA | viento, temperatura, presión, humedad, polvo y radiación óptica |
| Jezero | Rover PLACES | posición y recorrido del rover |
| Jezero | PIXL/SHERLOC/SuperCam | objetivos científicos y composición |
| Espectral | CRISM/OMEGA | minerales y cobertura espectral |
| Simulación | MDA hipotéticas | actualizaciones ambientales de la demo |

### 10.2 Recursos oficiales

- [NASA Mars Trek](https://trek.nasa.gov/mars/)
- [NASA Planetary Data System - Atmospheres](https://pds-atmospheres.nmsu.edu/)
- [NASA Planetary Data System - Geosciences](https://pds-geosciences.wustl.edu/)
- [Instrumentos de Perseverance](https://science.nasa.gov/mission/mars-2020-perseverance/science-instruments/)
- [Instrumentos de Curiosity](https://science.nasa.gov/mission/msl-curiosity/science-instruments/)
- [Instrumentos de Mars Reconnaissance Orbiter](https://science.nasa.gov/mission/mars-reconnaissance-orbiter/science-instruments/)
- [USGS Astrogeology - mapas de Marte](https://astrogeology-usgs.hub.arcgis.com/pages/interactive-maps-mars)
- [Imágenes crudas de Perseverance](https://mars.nasa.gov/mars2020/multimedia/raw-images/)

Las imágenes crudas se utilizarán como evidencia visual vinculada a coordenadas. La identificación de materiales deberá proceder de productos científicos estructurados, no sólo de fotografías.

## 11. Principios de seguridad y comunicación científica

1. Utilizar **ruta recomendada** y no **ruta garantizada como segura**.
2. Mostrar unidades, fecha, región, instrumento y procedencia.
3. No interpolar directamente condiciones entre Gale y Jezero.
4. No presentar UV como equivalente de dosis ionizante.
5. No presentar una MDA simulada como infraestructura desplegada.
6. No presentar una zona astrobiológica como prueba de vida.
7. Marcar los umbrales del MVP como demostrativos y no certificados.
8. Incluir incertidumbre o nivel de confianza cuando sea posible.

## 12. Planificador híbrido y explicable

### 12.1 Restricciones duras

Una ruta será inválida si ocurre al menos una condición crítica:

- pendiente por encima del límite del perfil de movilidad;
- terreno o celda bloqueada;
- oxígeno o energía insuficientes para llegar al siguiente refugio;
- duración EVA superior al máximo configurado;
- temperatura fuera del rango permitido;
- dosis de radiación superior al presupuesto;
- destino final que no sea un refugio válido;
- ausencia de reserva de emergencia.

Los valores iniciales serán configurables y estarán marcados como umbrales de demostración.

### 12.2 Costos blandos

Entre las rutas válidas se evaluará un costo compuesto:

```text
costo = distancia
      + riesgo de terreno
      + consumo energético
      + exposición térmica
      + dosis de radiación
      + exposición a polvo/viento
      - recompensa por interés científico
```

Los pesos cambian según el perfil:

| Perfil | Prioridad |
|---|---|
| Segura | menor riesgo y mayor reserva |
| Rápida | menor tiempo y distancia dentro de límites |
| Científica | mayor valor de objetivos sin romper límites |

### 12.3 Múltiples objetivos

- **Orden manual:** el astronauta define la secuencia.
- **Orden automático:** el sistema propone el orden considerando distancia, riesgo, recursos, prioridad científica y refugio final.
- El orden “más cercano a más lejano” será una heurística, no una garantía de optimalidad.

### 12.4 Rol del aprendizaje automático

El ML podrá estimar transitabilidad, riesgo relativo, anomalías o condiciones faltantes. No podrá anular una restricción dura. Toda predicción deberá indicar confianza, variables usadas y región de entrenamiento.

## 13. Simulación temporal

El MVP combinará:

1. **Replay histórico:** reproducción acelerada de datos NASA almacenados localmente.
2. **Eventos MDA simulados:** cambios de viento, temperatura, radiación, polvo o disponibilidad de una estación.
3. **Replanificación:** recálculo cuando una condición invalide o degrade la ruta.

La interfaz mostrará el sol, hora marciana, velocidad de reproducción y origen de cada dato.

## 14. Alertas

### 14.1 Niveles

- `INFO`: cambio relevante sin riesgo inmediato.
- `PRECAUCIÓN`: condición cercana al umbral.
- `CRÍTICA`: ruta o recurso inválido.

### 14.2 Contenido

La notificación muestra:

- título y mensaje corto;
- nivel y variable activadora;
- tramo o coordenadas afectadas;
- valor observado y umbral;
- origen y antigüedad del dato;
- acción recomendada;
- alternativa o botón para replanificar.

## 15. Aplicación web

### 15.1 Tecnología recomendada

- **Núcleo científico:** Python y el paquete `marsroute` existente.
- **Interfaz web:** HTML5, CSS3, JavaScript (Vanilla / WebGL Three.js) y servidor Python ligero.
- **Mapa MVP:** raster y relieve interactivo embebidos; evolución posterior a MapLibre con recursos locales.
- **Persistencia:** SQLite.
- **Intercambio:** JSON, GeoJSON y paquetes ZIP con manifiesto.
- **Configuración:** YAML por región y perfil de ruta.
- **Pruebas:** pytest.

### 15.2 Vistas principales

1. **Exploración:** mapa, capas, retícula y objetivos.
2. **Planificación:** inicio, destinos, refugio y perfiles de ruta.
3. **Simulación:** reloj marciano, MDA, recursos y posición.
4. **Alertas:** resumen y detalle.
5. **Reportes:** descubrimientos, coordenadas y adjuntos.
6. **Datos:** procedencia, instrumentos, fecha e incertidumbre.
7. **Configuración:** idioma, región, unidades y umbrales.

### 15.3 Offline-first

- Todas las funciones P0 operan sin internet.
- Los datos del escenario se empaquetan con la aplicación.
- Las acciones se guardan primero en SQLite.
- Los mensajes pendientes se almacenan en una cola local.
- La sincronización futura podrá enviar y recibir paquetes cuando regrese la conexión.

## 16. Modelo mínimo de datos

| Entidad | Campos principales |
|---|---|
| `Region` | id, nombre, bbox, CRS, resolución efectiva |
| `GridCell` | región, fila, columna, geometría, capas |
| `MDAStation` | id, celda, posición, estado, variables |
| `Observation` | variable, valor, unidad, tiempo, origen, calidad |
| `ScientificTarget` | tipo, material, coordenada, prioridad, fuente |
| `Shelter` | posición, capacidad, recursos, estado |
| `ResourceState` | oxígeno, energía, tiempo, dosis, reserva |
| `RouteRequest` | región, inicio, objetivos, refugio, perfil |
| `RouteAlternative` | geometría, métricas, alertas, explicación |
| `Alert` | nivel, variable, umbral, tramo, acción |
| `Report` | autor, tipo, coordenada, texto, adjuntos, estado de sincronización |

## 17. Arquitectura lógica

```text
Datos NASA observados ─┐
                       ├─> Catálogo y normalización ─> Capas regionales ─┐
MDA simuladas ─────────┘                                                 │
                                                                         ├─> Planificador híbrido
Estado del astronauta ─> Recursos y límites ─────────────────────────────┘
                                                                                  │
                                                                                  v
Aplicación web <─ Alertas / explicación / rutas <─ Resultados y métricas
          │
          └─> SQLite local ─> cola de sincronización / exportación de paquetes
```

## 18. Organización propuesta del repositorio

```text
web/                          interfaz web cliente y visor 3D
config/regions/               Gale y Jezero
config/route_profiles.yaml    segura, rápida y científica
data/regions/                 paquetes regionales
data/simulated/               escenarios y mensajes MDA
src/marsroute/                núcleo actual preservado y ampliado
src/marsroute/domain.py       contratos de dominio
src/marsroute/environment.py  estado ambiental y replay
src/marsroute/resources.py    consumo y reservas
src/marsroute/multicriteria.py planificación híbrida
src/marsroute/alerts.py       reglas y explicación
src/marsroute/storage.py      SQLite y bitácora
tests/                        pruebas unitarias e integración
```

La estructura definitiva se implementará sin eliminar el baseline actual hasta validar equivalencia.

## 19. Criterios de aceptación del MVP

El MVP será aceptable para la demostración si:

1. inicia sin internet en Windows y Linux;
2. permite cambiar entre Gale y Jezero;
3. muestra retícula, capas, objetivos, refugios y estaciones MDA;
4. permite seleccionar inicio, múltiples objetivos y refugio final;
5. admite orden manual y automático de objetivos;
6. genera alternativas segura, rápida y científica;
7. rechaza una misión que incumpla una restricción dura;
8. muestra oxígeno, energía, tiempo y radiación estimados;
9. reproduce un escenario ambiental y genera al menos una replanificación;
10. explica cada alerta y diferencia datos observados, derivados y simulados;
11. conserva reportes después de cerrar la aplicación;
12. permite alternar español e inglés;
13. conserva la ruta actual de Gale como baseline de comparación.

## 20. Alcance excluido del MVP

- certificación operacional o médica;
- comunicación real Tierra-Marte;
- datos verdaderamente en vivo desde Marte;
- red MDA física desplegada;
- cobertura ambiental de alta resolución para todo Marte;
- predicción climática global validada;
- detección o confirmación de vida microbiana;
- autenticación avanzada o sincronización multiusuario en producción;
- garantía matemática de la mejor ruta global bajo todas las variables.

## 21. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Plazo inferior a dos días | vertical mínimo, trabajo paralelo y congelación temprana |
| Jezero sin pipeline completo | paquete reducido y contratos multirregión |
| Confundir simulación con observación | etiquetas obligatorias de procedencia |
| Umbrales humanos no certificados | configuración demostrativa y advertencia visible |
| Rendimiento de A* | recorte regional, caché y resolución adaptativa |
| Dependencias de red | datasets empaquetados y modo offline |
| Integración tardía | contrato de datos estable y pruebas de humo continuas |

## 22. Decisión de producto

Para la entrega inmediata, GaleX priorizará una historia demostrable de principio a fin:

> El astronauta abre GaleX sin conexión, selecciona Gale o Jezero, elige objetivos y un refugio, compara tres rutas, inicia un replay ambiental, recibe una alerta de una MDA simulada, observa el consumo de recursos, replantea la ruta y registra un descubrimiento que queda guardado localmente.

La ejecución concreta se detalla en [Planificacion_por_Fases.md](Planificacion_por_Fases.md).
