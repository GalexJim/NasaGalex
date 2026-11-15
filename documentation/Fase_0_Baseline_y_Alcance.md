# Fase 0 — baseline y alcance de entrega

**Registro:** 14 de noviembre de 2026, hora de Bogotá.

**Fecha límite del MVP:** 15 de noviembre de 2026, 11:59 p. m., hora de Bogotá.

**Estado:** Fase 0 cerrada; responsables definidos por rol como Participante 1 a 6.

## 1. Alcance congelado para el MVP

El alcance P0 aprobado para iniciar esta fase es el de [Planificacion_por_Fases.md](Planificacion_por_Fases.md#3-prioridades): aplicación web moderna que funcione offline; escenarios Gale y Jezero; capas y retícula con MDA simuladas; rutas segura, rápida y científica con restricciones demostrativas, recursos y refugio final; replay ambiental, alertas explicables, reportes persistentes y selector español/inglés.

**Orden de ejecución:** primero un flujo completo de Gale; después habilitar Jezero con datos verificables y el mismo contrato regional. Jezero debe poder seleccionarse y demostrar una ruta. Si faltan capas NASA, se señalan como `NO DISPONIBLE`, sin presentarlas como observaciones.

El alcance P1 queda condicionado a que P0 esté integrado y funcionando. P2 queda fuera de la entrega. Una MDA por celda es el diseño conceptual; la demo sólo instanciará una muestra representativa y rotulada como simulada.

## 2. Referencia reproducible

- **Rama:** `feature/trek.nasa.gov/mars/API`.
- **Commit de partida:** `1ac9e63e4fd0ed3d8b48546c2ba5345511a1fb06`.
- **Python verificado:** 3.14.7 en la `.venv` local.
- **Respaldo de cambios locales preexistentes:** [phase0_snapshot_2026-11-14.tar.gz](phase0_snapshot_2026-11-14.tar.gz).
- **SHA-256 del respaldo:** `cf2e69dcb596d245aed2fd195dd79f5d104f4bd972604bdf1c3fdb578f343ae4`.

El commit conserva el código y datos ya versionados; el archivo de respaldo conserva el modelo binario modificado, los documentos PDF y Markdown sin seguimiento y las cuatro imágenes de referencia. No representa una versión ejecutable separada del repositorio. Antes de crear un commit de baseline, el equipo debe revisar qué documentos y binarios desea versionar.

### Artefactos principales y hashes SHA-256

| Archivo | SHA-256 |
|---|---|
| `config/mission.yaml` | `72717dfde493dabd86e01920211adf0b3329264291da57f5a7ad9f3efa35f139` |
| `data/processed/layers_meta.json` | `387d08461a285fe5c2af073c7a8bf6c10f23ad8bdc90c8fe9eccf366acbcc657` |
| `data/processed/layers.npz` | `8aee2a2a2bc619867cb09c27a82652ad46023bf893b47b37155043d219b24e34` |
| `data/raw/gale_dem.tif` | `fa4763b1fdbe4f80ce710cbe72d65be06331dac994eb7445c739485b7a338ae7` |
| `models/terrain_model.joblib` | `dc70310a058688fa062d81160e0808a9c8ab17372948c5657819012945b2c422` |
| `models/metrics.json` | `395ddfab6af92346831a8d4651263fa6de150755e370f7c13d19df918bd91423` |
| `outputs/route.json` | `a8acfe1a4da1060e901be8ab321dbced924190e840969fad3313fcc1cdaf62f6` |
| `outputs/route_baseline.json` | `661e796ba1f4a27dd613f32bab884016dcc39ef49a51f2c69d91059c9e9b567c` |
| `outputs/traversability.npy` | `8d0b5f7afc8681670eb48d34d9b67ce8dfe8365807884184097a46bc09b7a93b` |
| `outputs/cost.npy` | `df4c39f3ab926eb065f917ffdf6daa33731b070f8cd09582f25f129e46988971` |
| `outputs/blocked.npy` | `6f67e1a8ea129c7cd8a296d6ded8bef2cc6b4f8a1a232b69aa542f30e8a97468` |

## 3. Resultado de la verificación de Gale

La comprobación fue **de sólo lectura** sobre datos y código existentes:

| Comprobación | Resultado |
|---|---|
| Grilla y configuración | 1200 × 1200, bbox y tamaño coinciden |
| Capas cargadas | 12, máscara de validez con cobertura del 100 % |
| Predicción vs. `traversability.npy` | coincidencia exacta |
| Superficie de costo vs. `cost.npy` | coincidencia exacta |
| Bloqueos vs. `blocked.npy` | coincidencia exacta |
| Nueva ejecución A* vs. `route.json` | 1.390 celdas idénticas, mismo costo |
| Celdas bloqueadas atravesadas | 0 |
| Longitud registrada | 71,957 km |
| CSV REMS de sols 100 y 4500 | disponibles |
| TAB originales REMS | no disponibles localmente |

La generación completa desde cero requiere conexión para descargar los TAB REMS y el mosaico THEMIS que el repositorio excluye. El flujo operativo desde los artefactos procesados sí puede comprobarse offline. Esta ruta es una **referencia técnica**, no una misión EVA validada.

## 4. Tablero P0 y responsables

Los responsables se identifican por rol como Participante 1 a 6; sus nombres no son necesarios para iniciar. El Participante 1 mantiene el contrato compartido y resuelve conflictos de interfaz.

| ID | Entrega P0 | Responsable | Estado | Evidencia de terminado |
|---|---|---|---|---|
| P0-01 | Contratos, configuración regional e integración | Participante 1 — integración | pendiente | Gale y Jezero cargan el mismo contrato |
| P0-02 | Rutas segura/rápida/científica, restricciones y recursos | Participante 2 — rutas | pendiente | ruta válida y rechazo reproducible |
| P0-03 | Catálogo Gale/Jezero, objetivos, refugios y procedencia | Participante 3 — datos | pendiente | ambas regiones seleccionables |
| P0-04 | Replay ambiental, MDA simulada y alertas | Participante 4 — ambiente | pendiente | evento causa alerta y replanificación |
| P0-05 | Aplicación web, mapa, capas y retícula | Participante 5 — interfaz web | pendiente | flujo completo sin terminal |
| P0-06 | Bitácora SQLite, idioma, QA y demo | Participante 6 — UX/QA | pendiente | reporte persiste; guion funciona en ambos sistemas |
| P0-07 | Empaquetado y ejecución offline web | Participantes 1 y 5 | pendiente | servidor y cliente web offline probados |

**Regla de coordinación:** cada entrega P0 tiene un responsable por rol. El equipo puede asociar nombres o redistribuir personas más adelante sin cambiar los contratos ni bloquear el inicio.

## 5. Guion preliminar — máximo cinco minutos

| Tiempo | Acción | Evidencia visible |
|---|---|---|
| 0:00–0:30 | Abrir la aplicación sin red; mostrar idioma español | inicio offline y selector de idioma |
| 0:30–1:10 | Seleccionar Gale, capas, retícula y MDA | terreno, datos y etiquetas de procedencia |
| 1:10–2:00 | Elegir inicio, objetivos y refugio; comparar tres rutas | métricas, recursos y explicación |
| 2:00–2:45 | Reproducir un sol y activar evento MDA simulado | reloj, alerta detallada y nueva ruta |
| 2:45–3:30 | Registrar un descubrimiento y comprobar bitácora | coordenada y persistencia |
| 3:30–4:15 | Seleccionar Jezero y mostrar Perseverance/MEDA | segunda región y procedencia |
| 4:15–5:00 | Resumir fuentes, límites y utilidad | trazabilidad y advertencia de prototipo |

Si una parte falla, usar capturas o vídeo de respaldo identificados como demostración grabada.

## 6. Puerta para iniciar la Fase 1

- [x] Alcance P0/P1/P2 registrado.
- [x] Estado previo documentado y respaldado.
- [x] Gale verificado sin alterar sus artefactos.
- [x] Hashes y commit registrados.
- [x] Guion preliminar disponible.
- [x] Seis responsables identificados por rol como Participante 1 a 6.
- [x] Participante 1 designado como responsable de integración para esta planificación.

**Fase 1 habilitada.** La asociación a nombres reales y un eventual commit del baseline son decisiones opcionales de coordinación; el respaldo y los hashes ya permiten identificar el estado de partida.
