# Planificación por fases del prototipo GaleX

## 1. Restricciones del proyecto

- **Fecha límite:** domingo 15 de noviembre de 2026, 11:59 p. m.
- **Zona horaria:** America/Bogota.
- **Equipo disponible:** 6 personas.
- **Producto:** MVP web interactivo para navegadores modernos.
- **Operación:** offline-first.
- **Regiones:** Gale completo y Jezero demostrativo.
- **Baseline:** conservar el prototipo actual y sus resultados.

Esta planificación es un plan de entrega de emergencia. El objetivo no es completar la visión operacional, sino demostrar un recorrido integral y científicamente honesto.

## 2. Resultado esperado

Al finalizar, el equipo debe poder demostrar en menos de cinco minutos:

1. apertura offline de la aplicación;
2. selección de Gale o Jezero;
3. activación de capas y retícula;
4. selección de inicio, objetivos y refugio;
5. comparación de rutas segura, rápida y científica;
6. visualización de recursos y explicaciones;
7. ejecución de un replay ambiental;
8. alerta MDA simulada y replanificación;
9. creación de un reporte persistente;
10. cambio de idioma español/inglés.

## 3. Prioridades

### P0 - Obligatorio para la entrega

- aplicación web ejecutable offline;
- Gale y selector de Jezero;
- mapa con retícula, capas, inicio, objetivos y refugio;
- tres perfiles de ruta;
- restricciones duras demostrativas;
- recursos del astronauta;
- replay y evento MDA simulado;
- alertas explicables;
- persistencia SQLite;
- español e inglés básico;
- guion de demo y paquete offline.

### P1 - Importante si P0 está estable

- orden automático de múltiples objetivos;
- vista topográfica 2.5D interactiva;
- datos MEDA/PIXL/SHERLOC estructurados para Jezero;
- exportación/importación de bitácora;
- comparación detallada entre alternativas;
- incertidumbre y antigüedad de observaciones.

### P2 - Posterior a la entrega

- sincronización por red;
- actualización automática de archivos PDS;
- modelo climático regional;
- optimización avanzada multiobjetivo;
- autenticación y control de acceso;
- paquetes cartográficos globales;
- integración con hardware MDA real.

## 4. Distribución sugerida del equipo

| Participante | Frente principal | Responsabilidad secundaria |
|---|---|---|
| 1. Integración | arquitectura, contratos, merge y empaquetado | soporte a bloqueos |
| 2. Rutas | restricciones, costos, alternativas y recursos | métricas y pruebas |
| 3. Datos | Gale, Jezero, catálogo y procedencia | objetivos científicos |
| 4. Ambiente | replay, MDA, alertas y escenarios | datos REMS/MEDA/RAD |
| 5. Frontend Web | interfaz cliente web, navegación y mapa | optimización offline web |
| 6. UX/QA | paneles, i18n, bitácora, pruebas y demo | documentación |

Cada frente debe trabajar sobre contratos acordados en la Fase 1. Los números identifican responsables por rol; se pueden asociar nombres más adelante. El Participante 1 de integración decide cambios incompatibles en los contratos durante el plazo de entrega.

## 5. Estrategia de ramas e integración

Antes de desarrollar:

1. documentar el estado sucio existente sin sobrescribirlo;
2. crear un punto de referencia del baseline cuando el equipo autorice el commit;
3. usar ramas cortas por frente;
4. integrar cambios pequeños varias veces durante el día;
5. evitar una única integración al final;
6. no regenerar datos o modelos pesados durante el empaquetado de la demo.

Ramas sugeridas:

```text
feature/domain-routing
feature/data-regions
feature/environment-mda
feature/web-ui
feature/reports-i18n
```

## 6. Fase 0 - Congelación del alcance y baseline

**Duración máxima:** 60 minutos.

**Estado:** cerrada. El baseline, tablero y guion están documentados en [Fase_0_Baseline_y_Alcance.md](Fase_0_Baseline_y_Alcance.md). Los responsables se identifican por rol como Participante 1 a 6.

### Tareas

- aprobar el alcance P0/P1/P2;
- asignar responsables por rol como Participante 1 a 6;
- respaldar el estado actual;
- verificar que el pipeline y la ruta Gale existentes siguen funcionando;
- registrar hashes o versiones de los artefactos de demo;
- definir el guion de cinco minutos antes de escribir código.

### Entregables

- baseline identificable;
- tablero de tareas con responsables;
- guion preliminar;
- lista cerrada de funciones P0.

### Puerta de salida

Nadie comienza una función P1 mientras exista una tarea P0 sin responsable.

## 7. Fase 1 - Contratos, configuración y esqueleto

**Duración máxima:** 2 horas.

### Tareas

- crear contratos mínimos para región, observación, MDA, objetivo, refugio, recursos, solicitud de ruta, alternativa, alerta y reporte;
- crear configuraciones separadas para Gale y Jezero;
- crear perfiles segura, rápida y científica;
- definir el esquema SQLite;
- integrar shell web con navegación local;
- preparar un escenario MDA JSON reproducible;
- añadir pruebas de humo.

### Archivos objetivo

```text
config/regions/gale.yaml
config/regions/jezero.yaml
config/route_profiles.yaml
src/marsroute/domain.py
src/marsroute/storage.py
web/index.html
data/simulated/demo_scenario.json
tests/test_smoke.py
```

### Puerta de salida

- la aplicación abre;
- ambas regiones cargan configuración;
- SQLite puede guardar y leer un reporte;
- todos los frentes pueden consumir los mismos contratos.

## 8. Fase 2 - Datos regionales y catálogo

**Duración máxima:** 4 horas, en paralelo con la Fase 3.

### Gale

- reutilizar capas y resultados existentes;
- añadir catálogo de procedencia;
- añadir refugios y estaciones MDA simulados;
- vincular REMS y RAD disponibles;
- conservar la ruta actual como baseline.

### Jezero

- preparar un paquete mínimo con bbox, imagen/relieve, recorrido y puntos de interés;
- añadir MEDA como fuente ambiental local;
- incluir algunos objetivos científicos con coordenadas y fuente;
- añadir refugios y MDA simulados;
- si falta una capa, usar un placeholder visible como `NO DISPONIBLE`, no inventar observaciones.

### Entregables

- selector Gale/Jezero;
- manifiesto de capas por región;
- catálogo `OBSERVADA/DERIVADA/SIMULADA`;
- objetivos y refugios cargables.

### Puerta de salida

El mapa puede cambiar de región sin modificar código y siempre muestra la procedencia de las capas.

## 9. Fase 3 - Planificador híbrido y recursos

**Duración máxima:** 5 horas, en paralelo con la Fase 2.

### Tareas

- separar restricciones duras de costos blandos;
- añadir perfiles de movilidad astronauta y rover;
- incorporar oxígeno, energía, tiempo y dosis;
- exigir un refugio final;
- calcular reserva al próximo refugio;
- generar tres alternativas mediante pesos diferentes;
- implementar orden manual de objetivos;
- implementar orden automático simple como P1;
- producir una explicación estructurada por alternativa;
- impedir que el ML anule restricciones duras.

### Pruebas mínimas

- inicio o destino bloqueado;
- oxígeno insuficiente;
- temperatura crítica;
- dosis excedida;
- destino sin refugio;
- ruta válida con reserva;
- diferencias verificables entre los tres perfiles.

### Puerta de salida

Una solicitud de ruta devuelve alternativas, métricas, recursos, alertas y explicación sin depender de la interfaz.

## 10. Fase 4 - Aplicación web y mapa

**Duración máxima:** 5 horas.

### Tareas P0

- integrar frontend web y visor 3D;
- navegación entre exploración, planificación, simulación, alertas y reportes;
- mapa con capas y retícula;
- controles de inicio, objetivos y refugio;
- panel comparativo de alternativas;
- panel de recursos;
- badges de procedencia;
- detalle desplegable de alertas.

### Tareas P1

- relieve 2.5D manipulable;
- animación de posición;
- filtros por material e interés científico;
- edición visual del orden de objetivos.

### Puerta de salida

El guion completo puede ejecutarse con clics y sin utilizar la terminal.

## 11. Fase 5 - Replay, MDA, reportes e idioma

**Duración máxima:** 4 horas.

### Replay y MDA

- cargar una secuencia histórica local;
- ejecutar reloj acelerado;
- emitir al menos un evento MDA simulado;
- cambiar el estado ambiental;
- generar una alerta y ofrecer replanificación.

### Reportes

- registrar tipo, texto, coordenadas, autor y fecha;
- guardar en SQLite;
- listar reportes tras reiniciar;
- marcar estado de sincronización;
- exportar un paquete si queda tiempo.

### Idioma

- español por defecto;
- selector a inglés sin reiniciar;
- traducir navegación, botones, alertas y métricas principales;
- no bloquear la entrega por traducciones secundarias.

### Puerta de salida

La aplicación conserva un reporte, cambia de idioma y muestra una replanificación causada por un evento simulado.

## 12. Fase 6 - Integración, QA y congelación

**Inicio recomendado:** no más tarde de las 7:00 p. m. del 15 de noviembre.

### Lista de verificación

- ejecutar pruebas automatizadas;
- ejecutar el guion completo en Windows y Linux;
- probar inicio sin internet;
- verificar rutas relativas y archivos empaquetados;
- revisar que no aparezcan secretos ni rutas personales;
- comprobar etiquetas de procedencia;
- comprobar unidades y advertencias;
- validar que Gale y Jezero abren;
- reiniciar y verificar persistencia;
- revisar legibilidad de español e inglés;
- registrar fallos conocidos.

### Regla de congelación

Después de la congelación sólo se corrigen fallos que impidan:

- iniciar;
- cargar una región;
- calcular una ruta;
- ejecutar el replay;
- guardar un reporte;
- completar la demo.

## 13. Fase 7 - Empaquetado y presentación

**Ventana recomendada:** 9:00 p. m.–11:00 p. m. del 15 de noviembre.

### Entregables

- ejecutable o comando único para Windows;
- paquete o comando único para Linux;
- datasets offline incluidos;
- README de instalación rápida;
- video de respaldo o capturas;
- guion de demo;
- arquitectura en una diapositiva;
- limitaciones y trabajo futuro;
- créditos y fuentes NASA.

### Buffer

Reservar de 11:00 p. m. a 11:59 p. m. exclusivamente para carga, verificación y contingencias. No desarrollar nuevas funciones durante ese período.

## 14. Guion de demostración

1. Abrir GaleX sin conexión.
2. Mostrar que español es el idioma predeterminado y cambiar brevemente a inglés.
3. Seleccionar Gale y activar relieve, radiación y retícula MDA.
4. Definir inicio, dos objetivos científicos y un refugio.
5. Comparar rutas segura, rápida y científica.
6. Mostrar por qué una alternativa fue penalizada o rechazada.
7. Iniciar el replay.
8. Recibir una alerta crítica de una MDA simulada.
9. Replanificar y mostrar el cambio de recursos.
10. Registrar un descubrimiento.
11. Cambiar a Jezero y mostrar datos de Perseverance/MEDA y objetivos científicos.
12. Cerrar y abrir para comprobar que el reporte sigue disponible.

## 15. Matriz de trazabilidad

| Requisito | Fase | Evidencia |
|---|---|---|
| Aplicación Web Offline | 4 y 7 | ejecución en navegadores modernos |
| Offline-first | 4 y 6 | demo sin red |
| Gale y Jezero | 2 | selector regional |
| Retícula y MDA | 2 y 5 | estaciones y evento simulado |
| Múltiples objetivos | 3 y 4 | orden manual/automático |
| Tres rutas | 3 | comparación de alternativas |
| Recursos y refugio | 3 | métricas y rechazo de misión |
| Alertas explicables | 3, 4 y 5 | resumen y detalle |
| Replay ambiental | 5 | reloj y secuencia |
| Reportes persistentes | 1 y 5 | SQLite tras reinicio |
| Español/inglés | 5 | selector de idioma |
| Procedencia científica | 2 y 4 | badges observada/derivada/simulada |

## 16. Criterios de recorte si el tiempo falla

Recortar en este orden:

1. sincronización por red;
2. exportación de paquetes;
3. orden automático avanzado;
4. animación 2.5D compleja;
5. filtros científicos secundarios;
6. traducciones no esenciales;
7. capas Jezero adicionales.

No recortar:

- funcionamiento offline;
- ruta explicable;
- restricciones duras;
- refugio final;
- procedencia de datos;
- replay y alerta MDA;
- persistencia básica;
- guion de demo.

## 17. Definición de terminado

Una tarea está terminada cuando:

- está integrada en la rama de entrega;
- tiene al menos una prueba o procedimiento reproducible;
- funciona sin rutas absolutas del desarrollador;
- maneja el caso de error principal;
- muestra procedencia y unidades cuando usa datos;
- puede ser demostrada por otra persona del equipo;
- no rompe el guion principal.

## 18. Trabajo posterior

Después de Space Apps:

1. validar CRS, resolución y calibración de todas las capas;
2. ampliar Jezero al mismo nivel que Gale;
3. incorporar RAD, MARCI/MCS y productos científicos PDS completos;
4. sustituir umbrales demostrativos por modelos revisados por expertos;
5. optimizar planificación y orden multiobjetivo;
6. implementar sincronización segura;
7. crear paquetes regionales adicionales;
8. evaluar hardware y protocolo de una MDA física;
9. validar con especialistas en geología, clima, EVA y medicina espacial.
