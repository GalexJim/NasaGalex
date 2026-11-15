# Colaboración entre astronautas: avisos compartidos

Fase 4. Un hallazgo o una alerta registrada por un astronauta llega como aviso a los otros dos. **Cada uno sigue con su viaje separado**: el aviso no cambia su ruta, su reloj ni su misión; solo se refleja como zona en el mapa y mensaje en la bitácora.

## Qué se comparte

| Origen | Tipo de aviso | Texto de ejemplo | Dónde se genera |
|---|---|---|---|
| Hallazgo registrado | `hallazgo` | «Mineral: olivino verde» | al guardar un hallazgo (`saveFinding`) |
| Alerta crítica de pendiente | `alerta_pendiente` | «pendiente de 15° en un tramo de 138 m (km 52,2)» | al abrirse la alerta (`criticalAlert`), una vez por tramo |
| Alerta crítica de radiación | `alerta_radiacion` | «dosis EVA de 5,2 mSv hoy (umbral 5,0 mSv)» | al superar el umbral (`checkRadiation`), una vez por nivel |

Quedan fuera por ahora: la alerta meteorológica de demostración (ya se dispara a cada explorador a las 11:30), los mensajes a la Tierra y las misiones.

Si el autor pulsa «Deshacer» tras guardar un hallazgo, el aviso se **retira** para los demás.

## Qué ve quien recibe

- **Mapa 2D:** un marcador con borde discontinuo del color del autor y una **zona** (círculo discontinuo). Al tocarlo se abre una ficha con el autor, las coordenadas, el texto y a cuántos km pasa su propia ruta. En el relieve 3D aparece el marcador; las zonas son solo del mapa 2D.
- **Bitácora:** un mensaje «EV1 · Hallazgo: … · tu ruta pasa a 13,9 km», con «Ver en el mapa». Aparece en el viaje de cada receptor aunque aún no haya empezado a caminar; si el receptor no es el explorador activo, queda como mensaje sin leer en su insignia.
- **Banner** si el receptor está activo en ese momento (de aviso si su ruta pasa a menos de «radio + 1 km» de la zona).
- **Panel de hallazgos:** sección «Hallazgos de otros exploradores».
- **Línea de tiempo del resumen:** «Aviso de EV1: hallazgo».

El autor no ve su propio aviso como zona ajena. El tamaño de la zona (0,5 / 0,8 / 1,5 km según el tipo) es una ayuda visual **supuesta**, no una distancia de seguridad medida.

## Dónde se guarda

| Situación | Qué pasa |
|---|---|
| **Sin servidor** (doble clic en `index.html`) | Los avisos viven en `localStorage` (`mr_shared`). Dos pestañas del mismo navegador se avisan al instante por el evento `storage`; una pestaña nueva carga los ya guardados, sin repetir banners. |
| **Con backend** (`python backend/server.py`) | Además: cada aviso va a **SQLite** (tabla `aviso`) y cada evento a **JSONL** (`backend/data/docstore/eventos.jsonl`). Otros navegadores los reciben consultando `/api/avisos` cada 4 s. |

- **SQLite (`aviso`):** el registro: id, autor, tipo, texto, coordenadas, radio, región, reloj del autor, estado (`activo`/`retirado`).
- **JSONL (`eventos`):** la bitácora de lo que pasó: `aviso_publicado`, `aviso_recibido` (con quién lo recibió) y `aviso_retirado`.
- **Reenvío idempotente:** el mismo id no se duplica ni repite el evento. Lo que se creó sin conexión se sube al reconectar.
- **Validación:** el servidor rechaza exploradores desconocidos, tipos inválidos, texto vacío y coordenadas fuera de rango.

## API

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/avisos[?region=gale]` | lista de avisos (incluye los retirados, para que los clientes los quiten) |
| POST | `/api/avisos` | publica un aviso |
| POST | `/api/avisos/retirar` | `{id, crew}`: solo el autor puede retirarlo |
| POST | `/api/avisos/recibido` | `{id, crew}`: deja el evento de recepción |
| GET | `/api/eventos[?tipo=…]` | eventos del almacén JSONL |

`MARS_DATA_DIR` permite usar una carpeta de datos distinta (las pruebas la usan para no tocar `backend/data`).

## Límites y pendiente

- **No hay identidad ni permisos:** cualquier cliente puede publicar como cualquier explorador. Es un prototipo de demostración.
- **Los viajes tienen relojes separados.** El aviso se entrega apenas se publica (tiempo real), no cuando el reloj del receptor llegue a esa hora; el texto muestra el reloj del autor en la ficha.
- **Sin retraso Marte–Tierra entre compañeros** (están en la misma zona de operaciones); los mensajes a la Tierra siguen con su retraso de 12 min.
- **No se comparte la foto** del hallazgo, solo el tipo y la nota.
- **Sincronización por consulta (4 s)**, no en tiempo real; sin WebSocket.
- Un aviso no modifica el viaje del receptor ni propone un desvío automático.

## Pruebas

- `python tests/web_fase4.py` (Playwright): sin servidor (dos pestañas, retiro, alertas de pendiente y radiación) y con backend (dos navegadores, SQLite, JSONL, idempotencia, validación).
- `python -m pytest tests/test_avisos.py`: backend de avisos con carpeta temporal.
