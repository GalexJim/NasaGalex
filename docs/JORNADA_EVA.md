# Jornada EVA y velocidad de caminata

Revisión de cómo la simulación y el briefing calculan cuánto tarda el recorrido a pie, qué supuestos hay detrás y cómo se cambian. Fase 3. Cada punto indica su origen: **FUENTE**, **DATO** (medido en este repo) o **SUPUESTO**.

## 1. Qué dicen las fuentes (y qué no)

Nelson (NASA, 14-oct-2021, *Beyond Artemis III – EVA Gap Update & Overview*) **no contiene** duración de EVA, ritmo de caminata, pausas ni reservas. Lo que sí dice es que más de 100 brechas afectan la EVA (~88 en Marte) y que muchas son **brechas de conocimiento**: parámetros de misión desconocidos que fijarán los requisitos. Por eso en esta app:

- la jornada, las pausas y la reserva **no se presentan como datos**, sino como **supuestos configurables** (Ruta → Jornada EVA) rotulados «SUPUESTO»;
- no se puede justificar con ese documento que sean 9 h, 8 h o 6 h. La única analogía citable es la lunar (hasta cuatro caminatas más una quinta de reserva por contingencia en 6,5 días), y es lunar, no marciana.

## 2. La velocidad de caminata

`v = 6 · e^(−3.5·|pendiente + 0.05|) km/h` (función de Tobler, 1993; es la referencia que cita el documento del proyecto, `docs/Ruta_segura_Mount_Sharp_APA.docx`), multiplicada por:

| Factor | Valor | Origen |
|---|---|---|
| Traje presurizado | × 0,55 | SUPUESTO del prototipo, sin fuente |
| Facilidad de paso baja | hasta × 0,65 (`1 − 0,35·(1 − p)`) | SUPUESTO del prototipo |
| Tramo empinado (sobre el umbral crítico) | × 0,6 | SUPUESTO del prototipo |
| Pausas | `(60 − minutos)/60` | SUPUESTO configurable (por defecto 0) |
| Mínimo | 0,4 km/h | SUPUESTO del prototipo |

Resultado: **2,77 km/h en plano** (coincide con el «unos 2,8 km/h» del documento del proyecto). El pico de la fórmula de Tobler está en una bajada suave (pendiente −5 %).

Limitaciones de la fórmula:
- Tobler describe caminatas terrestres; el documento del proyecto ya lo advierte: «habría que calibrarla con pruebas en análogos marcianos».
- La pendiente sale de la ruta sobre celdas de 177 m del navegador (44 m en Python): suaviza pendientes locales, así que la velocidad estimada es algo optimista en tramos escarpados.

## 3. Lo que se corrigió

Antes de esta fase, tres cosas no eran coherentes entre sí:

1. **El briefing calculaba las horas con el ritmo de rover** (12 km/h como máximo) aunque decía «de caminata», y la movilidad por defecto era «Rover presurizado». El recorrido de 72 km salía en ≈ 7 h. **Ahora la movilidad por defecto es «a pie»**, que es la premisa del proyecto.
2. **La estimación ignoraba el × 0,6 en tramos empinados que sí aplicaba la simulación.** Ahora ambas usan la misma función (`MR.speedAt`), y una prueba comprueba que los soles simulados coinciden con los estimados.
3. **La jornada 08:00–17:00 estaba fija en el código.** Ahora es configurable y guardada en el navegador.

También se hizo coherente el consumo del traje: el O₂ y la batería a pie se miden **por jornada** (SUPUESTO: el traje se recarga cada noche), no sumados sobre las 44 h. Con la jornada por defecto de 9 h el panel marca que se supera la autonomía de 8 h del traje (supuesto del prototipo, 72 L/h y 576 L): **la jornada de 9 h y el traje de 8 h son incompatibles entre sí**, y el umbral de reserva del 20 % exige ≤ 6,4 h. Se muestra tal cual en lugar de cambiar el valor por defecto sin base.

## 4. Cuántos soles toma el recorrido

Ruta del modelo a la cima (72 km, +5 333 m), a pie, con los valores por defecto (08:00–17:00, sin pausas ni reserva):

| Medida | Valor |
|---|---|
| Horas de marcha | ≈ 43,5 h |
| Ritmo medio | ≈ 1,7 km/h |
| Soles | 4,8 → **5 soles** |
| En rover presurizado (12 km/h máx., supuesto) | ≈ 7 h (1 sol) |

**Por qué no 3 soles.** El flujo base planteaba 3 soles (cifra que no pude comprobar: el PDF «Flujo de interacciones base» no está en el repo). Con este modelo, hacerlo en 3 soles exigiría **jornadas de ≈ 14,5 h** (más que cualquier jornada configurable) o un **ritmo medio de ≈ 2,7 km/h**, un 61 % más rápido que el estimado y casi igual a la velocidad máxima en plano (2,77 km/h), que es imposible de mantener en un recorrido con 5,3 km de subida. Lo que cambia entre «3» y «4–5» no es un error de cálculo: es que 3 soles necesitan supuestos más optimistas que los de este modelo.

Sensibilidad (misma ruta, a pie):

| Configuración | Horas | Soles |
|---|---|---|
| Por defecto (9 h, sin pausas ni reserva) | 43,5 | 5 |
| Jornada de 12 h | 43,5 | 4 |
| Pausa de 15 min por hora | 58,0 | 7 |
| Reserva de 60 min (8 h de marcha por sol) | 43,5 | 6 |
| Jornada de 8 h, pausa de 10 min/h y reserva de 60 min (7 h de marcha por sol; es la prueba completa) | 52,2 | 8 |

## 5. Dónde cambiarlo

- **Ruta → Jornada EVA:** hora de inicio, duración (4–12 h), pausas (0–30 min por hora de marcha) y reserva de seguridad al final (0–120 min: se deja de caminar antes para poder volver). Se guarda en el navegador; «Restaurar valores por defecto» vuelve al comportamiento original.
- El briefing y las tarjetas de ruta muestran los soles con esos valores.

## 6. Pendiente y simplificaciones

- Las pausas se promedian en el ritmo; no hay paradas discretas.
- La simulación usa sols de 24 h exactas; un sol marciano dura 24 h 39 min. No cambia las horas de marcha, solo el reloj nocturno.
- No hay dónde dormir: el modelo no dice si el astronauta pasa la noche en un refugio, un rover o al aire libre. Eso condiciona el O₂, la batería y la dosis de radiación (que hoy no se suma en el refugio).
- Ninguna cifra de EVA tiene respaldo oficial (Nelson 2021 las lista como brechas); calibrar con pruebas en análogos o con datos de agencia queda pendiente.
