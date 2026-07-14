# Decisiones técnicas y dirección de IA

Candidato: Carlos Vanegas · Prueba Técnica 2 · Universidad Galileo GES

---

## Qué construí y por qué

### Arquitectura general — 4 cambios

Un solo plugin Moodle (`local_gesexam`) implementa los 3 cambios del mes en la capa correcta: sin tocar el core de `mod/quiz`. Los cambios coexisten en el mismo plugin porque comparten tablas de configuración y son del mismo contexto funcional (exámenes). Si en el futuro un cambio requiere desactivarse individualmente, cada uno tiene su propia tabla y su propia lógica desacoplada.

La suite de QA usa Playwright + TypeScript por tres razones: la IA la conoce en profundidad (lo que hace que la generación sea precisa), produce evidencia visual automática (screenshots + video en fallos), y corre en headless sin dependencias adicionales.

---

## Cambio 1 — Sugerencia de calificación con IA para ensayo

**Decisión:** Web service PHP + AMD module JavaScript + API de Anthropic (Claude).

El web service `local_gesexam_get_essay_suggestion` verifica que el usuario tenga `mod/quiz:grade`, extrae el texto de la pregunta y la respuesta del estudiante desde las tablas `question_attempts` / `question_attempt_steps`, y llama a la API `POST /v1/messages` de Anthropic. El prompt instruye al modelo a responder exclusivamente con JSON `{grade, feedback}`. El AMD module `essay_suggester.js` detecta los campos de nota en el formulario de calificación (patrón `q<id>:s<slot>_-mark`) e inyecta el botón sin tocar ningún archivo de `mod/quiz`.

**Qué delegué a la IA:** boilerplate del web service, estructura del AMD module, prompt inicial para Claude.

**Qué decidí yo:** extraer el enunciado y respuesta en servidor (no exponer datos a JS), regex para extraer JSON incluso si Claude añade texto envolvente, `min(max_mark, max(0, grade))` para blindar notas fuera de rango, y mostrar el botón solo si hay campos de nota en la página (no en la vista de resumen).

**Decisión de modelo:** Claude Haiku por defecto (economía, velocidad); configurable desde la administración para usar Sonnet u Opus en evaluaciones que requieran más razonamiento.

**Discrepancia encontrada:** `local_gesexam_extend_navigation` en `lib.php` no siempre se llama en páginas AJAX-driven de Moodle. Como mitigación, el AMD module re-escanea el DOM en eventos de paginación. La activación definitiva ocurre en el primer render de la página de calificación.

---

## Cambio 2 — Pérdida de foco

**Decisión:** AMD module en JavaScript + web service AJAX + tabla propia.

El AMD module es la forma oficial de Moodle para inyectar JavaScript en una actividad sin modificar el core. El evento `visibilitychange` cubre cambios de pestaña; `blur` en `window` cubre cambios de ventana. Ambos son necesarios porque el comportamiento varía por OS y navegador.

**Qué delegué a la IA:** estructura del AMD module, sintaxis del `require()` de Moodle, boilerplate de `external_api`.

**Qué decidí yo:** qué eventos escuchar (y por qué dos eventos en vez de uno), que el contador sea acumulativo por intento y no por sesión, y que no afecte la nota (solo es señal).

**Discrepancia encontrada:** La documentación de Moodle indica que `visibilitychange` se dispara al cambiar de pestaña, pero en Chrome con algunas versiones también se dispara al abrir DevTools. Documentado como comportamiento conocido; la señal sigue siendo útil para el profesor.

---

## Cambio 3 — Notificación externa

**Decisión:** Event observer sobre `attempt_submitted` + HTTP POST con reintentos + tabla de log.

Event observers son la capa estándar de Moodle para reaccionar a eventos del sistema sin modificar el código fuente de ninguna actividad. El backoff exponencial (2s, 4s) es suficiente para el volumen esperado. El log en base de datos permite al admin verificar qué se envió y cuándo, sin necesitar acceso a logs del servidor.

**Qué delegué a la IA:** estructura del observer, sintaxis de registro en `db/events.php`, llamada curl.

**Qué decidí yo:** qué campos incluir en el payload (incluyendo la penalización por gracia si aplica, para que el sistema externo reciba la nota final correcta), el número de reintentos (3 es suficiente sin saturar el servidor externo), y registrar el resultado aunque sea exitoso (para auditoría).

---

## Cambio 4 — Penalización por gracia

**Decisión:** Observer sobre el mismo evento `attempt_submitted`, detectando si `timefinish > timeclose`.

Moodle calcula `timeclose = timestart + timelimit`. Si `timefinish` está entre `timeclose` y `timeclose + graceperiod`, el intento está en gracia. La penalización se aplica sobre `sumgrades` y se propaga al gradebook con `quiz_save_best_grade()`, que es la función oficial de Moodle para actualizar calificaciones del quiz.

**Qué delegué a la IA:** sintaxis de `quiz_save_best_grade()`, estructura de la tabla de penalizaciones.

**Qué decidí yo:** aplicar la penalización sobre `sumgrades` (la nota del intento) y no sobre la nota final del curso — porque es más justo y alineado con el comportamiento descrito. También decidí que `max(0, ...)` protege contra notas negativas si la penalización supera la nota original.

**Discrepancia encontrada:** `quiz_save_best_grade()` recalcula la mejor nota entre todos los intentos del estudiante. Esto significa que si el estudiante tiene un intento anterior sin penalización con nota mayor, la penalización puede no reflejarse en el gradebook si esa nota es mejor. Este comportamiento es correcto desde la perspectiva del gradebook de Moodle (siempre guarda la mejor nota) y está documentado como limitación conocida en el reporte de cobertura.

---

## Cómo dirigí la IA (Claude Code)

1. **Especificación primero.** Antes de generar código, escribí el spec completo del plugin: qué tablas necesita, qué eventos escucha, qué hace con cada evento. La IA generó el boilerplate inicial (version.php, install.xml, estructura de carpetas).

2. **Generación por componente.** Cada archivo fue generado por separado con contexto específico: "genera el observer.php que implementa estas dos responsabilidades". Nunca "genera el plugin completo".

3. **Validación línea a línea.** Revisé cada archivo generado buscando: uso de APIs deprecadas de Moodle, datos expuestos, lógica de negocio incorrecta (especialmente en el cálculo de gracia y la propagación al gradebook).

4. **Correcciones manuales:** La lógica de detección del período de gracia fue reescrita manualmente — la IA calculó `timeclose` como un campo directo de la tabla `quiz`, cuando en realidad debe calcularse como `timestart + timelimit` del intento.

---

## Por qué 40h → 2h es creíble

| Actividad | Antes | Ahora |
|---|---|---|
| Verificar 12 flujos del módulo Quiz | ~30h | ~0h (suite corre en ~20 min) |
| Verificar 3 cambios del mes | ~8h | ~0h (specs dedicados) |
| Revisar reporte + aprobar | — | ~1h |
| Validar calificación manual de ensayo | ~2h | ~1h (caso no automatizable) |
| **Total** | **~40h** | **~2h** |

El número de 2 horas humanas es conservador — incluye tiempo para leer el reporte HTML, ver los videos de los tests que fallaron, y tomar la decisión de deploy. En la práctica, si la suite está verde, el tiempo humano puede bajar a 30 minutos.
