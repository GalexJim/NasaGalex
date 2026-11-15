# Limitaciones del modelo de transitabilidad

Qué se puede y qué no se puede concluir del modelo de bosque aleatorio que usa el recorrido de Curiosity como etiqueta de «terreno transitable». Cada punto indica su origen: **FUENTE** (un documento citado), **DATO** (algo medido en este repo) o **SUPUESTO** (razonamiento propio, sin respaldo en las fuentes).

Fase 2. Fuentes: Bennett et al. 2023, *The Curiosity Rover's Exploration of Glen Torridon* (JGR Planets, 10.1029/2022JE007185; licencia CC BY-NC-ND, solo se parafrasea); `README.md`; `models/uncertainty_summary.json`.

## 1. Qué aprendió el modelo, en una frase

Aprendió a distinguir «se parece al terreno por donde pasó Curiosity» de «es empinado o rugoso y está lejos del recorrido». **No aprendió qué terreno puede cruzar un astronauta con traje.**

## 2. Rover frente a astronauta con traje

| # | Limitación | Origen |
|---|---|---|
| 1 | **El recorrido lo definió la ciencia, no la facilidad de paso.** El equipo científico fijó waypoints según sus preguntas geológicas («identified by the science team in response to the overarching science questions»). La forma del recorrido refleja dónde estaba el interés geológico, no el camino más fácil. | FUENTE (Bennett, §4.1) |
| 2 | **Que el rover pasara por un sitio no hace transitable lo demás.** Los ejemplos positivos son las celdas a ≤ 60 m del recorrido. Los negativos se toman a más de 200 m y solo si son empinados o rugosos. El modelo ordena riesgo relativo; no certifica que un terreno sea seguro. | DATO (README) |
| 3 | **Algunos tramos los impuso el terreno, no la elección.** La entrada a Glen Torridon es un acantilado «for the most part not traversable by a rover»; el único descenso seguro fijó el inicio del tramo. La ruta hacia la unidad de sulfatos tuvo que rodear los Sands of Forvie. | FUENTE (Bennett, §4.1) |
| 4 | **El rover soportó inclinaciones que nuestro veto excluye.** Llegó a una inclinación récord de 32,0° subiendo el escarpe del pedimento Greenheugh. Nuestro planificador veta pendientes > 20°. No son comparables directamente: la del rover es la inclinación del vehículo en un punto; la nuestra es la pendiente media de celdas de 44 m. El veto de 20° es una decisión de diseño, no un límite medido. | FUENTE (Bennett, §4.2.4) + DATO (`config/mission.yaml`) |
| 5 | **Evitó la arena, así que el modelo no sabe de arena.** Rodeó un campo de rizaduras en lugar de cruzarlo. Con pocos ejemplos sobre arena y sin una variable que la describa, el modelo no distingue «roca firme» de «arena suelta». Los proyectos JPL de clasificación de terreno (SPOC) tratan la arena como el principal riesgo de movilidad de un rover. | FUENTE (Bennett) + afirmación del sitio SPOC, no verificada aquí |
| 6 | **Un rover con ruedas no es una persona con traje.** Las pendientes, las rocas sueltas, la arena, las caídas y la fatiga afectan distinto a uno y a otro. | SUPUESTO |
| 7 | **El rover tiene necesidades propias.** Por ejemplo, para perforar necesita una superficie plana de al menos 10 cm; esas paradas pesan en la forma del recorrido y no tienen equivalente para un astronauta. | FUENTE (Bennett) |

Bennett no habla de trajes, marcha humana ni EVA. Los puntos 6 y siguientes sobre astronautas son razonamiento propio y no deben atribuirse a esa fuente.

## 3. Cobertura y alcance de los datos

| # | Limitación | Origen |
|---|---|---|
| 8 | **Un solo corredor de 19 km** cerca del aterrizaje; la cima está a ~47 km. El 7 % del área tiene alguna variable fuera del rango que el modelo vio al entrenar (pendiente 1,97 %, rugosidad 2,65 %, textura 1,67 %, gradiente 0,09 %, térmico 3,36 %). | DATO (README, `uncertainty_summary.json`) |
| 9 | **Resolución:** celdas de 44 m en el modelo y de 177 m en el navegador. No se ven rocas ni dunas sueltas. | DATO |
| 10 | **No ve** polvo, visibilidad, energía del traje ni fatiga. El costo es estático. | DATO (README) |
| 11 | **Métricas moderadas:** ROC AUC 0,91 (ordena bien pares fácil/difícil) pero F1 0,50. Sirve para ordenar rutas, no como detector de «sí/no». | DATO (`models/metrics.json`) |

## 4. Confianza del modelo (incertidumbre entre árboles)

**Método.** Se pregunta a cada uno de los 300 árboles por la probabilidad de cada celda de 44 m y se mide la desviación estándar entre árboles. `confianza = 1 − desviación / 0,5` (0,5 es el máximo posible). Se promedia a 300 × 300 para el navegador. `scripts/export_uncertainty.py` lo reproduce y comprueba que la media de los árboles coincide con `predict_proba` del bosque.

**Resultados** (todo el área de 53 × 53 km):

| Medida | Valor |
|---|---|
| Desviación media entre árboles | 0,166 (mediana 0,062; p90 0,453) |
| Celdas con confianza baja (< 0,5) | 34 % |
| Confianza media en la ruta del modelo a la cima | 0,56 |
| Confianza media en la ruta corta (referencia solo pendiente) | 0,42 |
| Confianza media en la ruta a la huella CRISM | 0,71 |
| Confianza media en la ruta «seguir la huella de Curiosity» | 0,85 |

**Por distancia al recorrido de Curiosity:**

| Distancia | % del área | Confianza media | Fuera del rango de entrenamiento |
|---|---|---|---|
| ≤ 1 km | 1,0 % | 0,75 | 2,4 % |
| 1 – 10 km | 13,7 % | 0,64 | 12,4 % |
| > 10 km | 85,3 % | 0,67 | 6,4 % |

**Cómo leerlo.**
- La ruta que el modelo recomienda tiene más confianza que la ruta corta (0,56 frente a 0,42), coherente con que el modelo la prefiere.
- **Pero el desacuerdo entre árboles casi no cambia al alejarse del recorrido** (0,75 cerca, 0,67 lejos), aunque lejos el modelo extrapola. Es decir, la confianza **no avisa** cuando el modelo está fuera de su zona de entrenamiento: los árboles pueden coincidir y equivocarse juntos. Por eso la interfaz muestra aparte el porcentaje del área con valores fuera de rango y la advertencia en la tarjeta «Confianza del modelo».
- La confianza no incluye el sesgo de las etiquetas (secciones 2 y 3): un modelo puede estar muy seguro de algo que mide mal.

## 5. Qué sería necesario para mejorar (pendiente)

- Etiquetas de transitabilidad pensadas para un astronauta (por ejemplo, tiempos o esfuerzo de marcha medidos), en lugar del recorrido de un rover. No hay datos en el repo para esto.
- Una variable de arena o suelo blando. No hay datos en el repo; un clasificador de terreno tipo SPOC necesitaría imágenes y licencia (los zips revisados no traen licencia).
- Medir incertidumbre por extrapolación con un método distinto (por ejemplo, distancia en el espacio de variables al conjunto de entrenamiento), además del acuerdo entre árboles.

## 6. Dónde se ve en la aplicación

- Capas → **Confianza del modelo** (mapa 2D y 3D).
- Condiciones → **Modelo predictivo**: tarjeta de confianza y sección «Limitaciones y supuestos».
- Condiciones → **Terreno y rutas**: fila «Confianza del modelo (media)» en la comparación de rutas.
- Solo Gale: Jezero no tiene este modelo.

## 7. Reproducir

```powershell
python scripts\build_layers.py        # regenera data/processed/layers.npz (ignorado por git)
python scripts\export_uncertainty.py  # models/uncertainty_summary.json y web/data/uncertainty_data.js
```
