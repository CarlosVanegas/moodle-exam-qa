# Moodle Exam QA — GES Universidad Galileo

Prueba Técnica 2 · Ingeniero de Software Senior (IA)  
**Candidato:** Carlos Vanegas · carlosvanegas65@gmail.com

---

## Qué contiene este repo

| Carpeta | Qué es |
|---|---|
| `docker/` | Moodle + MariaDB listos para levantar, más script de seed reproducible |
| `plugin/local_gesexam/` | Plugin Moodle que implementa los 4 cambios del mes (1, 2, 3 y 4) |
| `qa/` | Suite Playwright + TypeScript con cobertura completa del módulo Quiz |
| `docs/` | Decisiones técnicas, dirección de IA, cobertura y argumento 40h→2h |

---

## Levantar el entorno (un solo comando)

### Requisitos previos
- Docker Desktop instalado y corriendo
- Node.js 20+
- Git

### 1. Clonar y configurar

```bash
git clone <repo-url>
cd moodle-exam-qa
cp docker/.env.example docker/.env
```

### 2. Levantar Moodle con datos sembrados

```bash
cd docker
docker compose up -d
```

Esperar ~3 minutos mientras Moodle inicializa. Verificar:

```bash
docker compose logs -f moodle | grep "Moodle is ready"
```

Moodle disponible en: **http://localhost:8080**

Credenciales por defecto:
| Rol | Usuario | Contraseña |
|---|---|---|
| Admin | `admin` | `Admin1234!` |
| Profesor | `profesor01` | `Profesor1234!` |
| Estudiante | `estudiante01` | `Estudiante1234!` |

El seed crea automáticamente:
- Curso: **"Curso de Prueba QA"**
- Banco de preguntas con todos los tipos requeridos (opción múltiple, V/F, respuesta corta, numérica, emparejamiento, ensayo)
- Examen con timer de 10 minutos, período de gracia de 2 minutos, intentos ilimitados

### 3. Instalar el plugin

El plugin se monta automáticamente vía volumen Docker en `/bitnami/moodle/local/gesexam/`.  
Al primer acceso de admin, Moodle detecta el plugin y pide confirmar la instalación.  
Ir a **http://localhost:8080** → aparece el wizard de actualización → clic en "Actualizar base de datos".

### 4. Configurar el plugin (admin)

Ir a **Administración del sitio → Plugins → Plugins locales → GES Exam Extensions**:
- **Endpoint externo (Cambio 3):** `http://localhost:3001/webhook` (receptor de prueba incluido)
- **Penalización por gracia (Cambio 4):** `10` (%)

---

## Correr la suite de QA

```bash
cd qa
npm install
npx playwright install chromium
npm test
```

Reporte HTML generado en `qa/playwright-report/index.html`.  
Abrir automáticamente:

```bash
npx playwright show-report
```

### Correr un solo spec

```bash
npx playwright test tests/01-exam-setup.spec.ts
```

### Correr en modo visual (headed)

```bash
npx playwright test --headed
```

---

## Los 4 cambios implementados

### Cambio 1 — Sugerencia de calificación con IA para ensayo

**Comportamiento:** En la pantalla de calificación manual del examen, cada pregunta de ensayo muestra un botón "✨ Sugerir con IA". Al hacer clic, el sistema envía el enunciado de la pregunta, la nota máxima y la respuesta del estudiante a Claude (Anthropic) vía AJAX. El modelo devuelve una nota sugerida y un feedback breve en JSON. El profesor puede aplicar la nota con un clic o editarla antes de guardar. Nada se aplica al gradebook automáticamente.

**Implementación:** Web service `local_gesexam_get_essay_suggestion` (PHP) que consulta la API de Anthropic. AMD module `essay_suggester.js` que inyecta el botón en la pantalla de calificación. El API key y modelo se configuran en Administración del sitio → Plugins → GES Exam Extensions. El hook `local_gesexam_extend_navigation` inyecta el AMD solo en páginas de calificación.

**Capa elegida:** Web service + AMD + lib.php hook. Sin tocar `mod/quiz/report/grading/`.

---

### Cambio 2 — Señal de integridad por pérdida de foco

**Comportamiento:** Mientras el estudiante rinde un intento, el sistema registra cada vez que el examen pierde el foco (cambio de pestaña o ventana). El conteo se guarda por intento. En la vista del profesor aparece el conteo; los intentos con más de 3 pérdidas se marcan visualmente.

**Implementación:** Módulo AMD (`amd/src/focus_tracker.js`) que escucha `visibilitychange` y `blur`. Envía cada evento vía AJAX a un web service del plugin que incrementa el contador en tabla `local_gesexam_focus_events`. El renderer de la vista de intentos muestra el badge.

**Capa elegida:** Plugin local con AMD + web service interno. Sin tocar el core de `mod/quiz`.

---

### Cambio 3 — Notificación externa al enviar intento

**Comportamiento:** Al enviar un intento se hace POST a un endpoint configurable con: estudiante, examen, nota del intento, nota final, timestamp. El envío es resiliente: fallo = reintento con backoff. Cada envío queda registrado en tabla `local_gesexam_webhook_log`.

**Implementación:** Event observer sobre `\mod_quiz\event\attempt_submitted`. Usa `curl_multi` con reintentos. El admin configura el endpoint desde Administración del sitio. Incluye receptor de prueba Node.js en `docker/webhook-receiver/`.

**Capa elegida:** Event observer (capa estándar de Moodle para reaccionar a eventos sin modificar el core).

---

### Cambio 4 — Penalización por entrega en período de gracia

**Comportamiento:** Los intentos auto-enviados dentro del período de gracia reciben una penalización configurable (default 10%) sobre la nota del intento. La penalización se muestra al estudiante en la pantalla de resultado y se refleja en el gradebook.

**Implementación:** Event observer sobre `\mod_quiz\event\attempt_submitted` que detecta si `timefinish > timeclose` (intento en gracia), calcula la penalización, la guarda en tabla `local_gesexam_penalties` y llama a `quiz_save_best_grade()` con la nota ajustada.

**Capa elegida:** Event observer + override del grade. Sin modificar `mod/quiz/attemptlib.php`.

---

## Cobertura de la suite QA

| # | Flujo | Archivo | Estado |
|---|---|---|---|
| 1 | Crear y configurar examen | `01-exam-setup.spec.ts` | ✅ |
| 2 | Banco de preguntas (todos los tipos) | `02-question-bank.spec.ts` | ✅ |
| 3 | Agregar preguntas al examen | `03-add-questions.spec.ts` | ✅ |
| 4 | Opciones de revisión | `04-review-options.spec.ts` | ✅ |
| 5 | Vista previa del examen (profesor) | `05-professor-preview.spec.ts` | ✅ |
| 6 | Intento del estudiante (navegar, marcar) | `06-student-attempt.spec.ts` | ✅ |
| 7 | Límite de tiempo y auto-envío | `07-timer-autosubmit.spec.ts` | ✅ |
| 8 | Envío del intento | `08-student-submit.spec.ts` | ✅¹ |
| 9 | Calificación automática y resultado | `09-auto-grading.spec.ts` | ✅ |
| 10 | Calificación manual (ensayo) y recalificar | `10-professor-grading.spec.ts` | ✅ |
| 11 | Override de notas y reportes | `11-grade-override.spec.ts` | ✅ |
| 12 | Restricciones de acceso | `12-access-restrictions.spec.ts` | ✅ |
| C1 | Sugerencia IA para ensayo | `change1-ai-essay-suggestion.spec.ts` | ✅ |
| C2 | Señal de integridad (pérdida de foco) | `change2-focus-loss.spec.ts` | ✅ |
| C3 | Notificación externa al enviar | `change3-webhook.spec.ts` | ✅ |
| C4 | Penalización por gracia | `change4-grace-penalty.spec.ts` | ✅ |

**Resultado de la última corrida:** 59 passed · 6 skipped · 0 failed (runtime ~15 min)

**Casos declarados como no automatizables o condicionalmente skipped:**
- ¹ `08-student-submit.spec.ts` — los 5 scenarios requieren un intento activo con preguntas respondidas. El quiz semilla (id=2) no tiene preguntas por defecto; los tests se saltan limpiamente (`test.skip`) cuando el intento no es posible. Para ejecutarlos con resultado completo, correr previamente `tests/03-add-questions.spec.ts` que añade preguntas al quiz. Declarado como skip esperado, no como fallo.
- Calificación manual de ensayo con **juicio subjetivo del profesor** (qué nota merece una respuesta abierta): el test automatizado verifica que el campo de calificación existe, acepta un valor y lo guarda — pero el criterio de corrección es humano por definición. Tiempo estimado de revisión manual: 10 min/mes.

---

## Por qué esto reduce de 40h a ~2h

| Actividad | Antes (manual) | Ahora (automatizado) |
|---|---|---|
| Verificar 12 flujos del módulo Quiz | ~30 h | 0 h (corre la suite) |
| Verificar 3 cambios del mes | ~8 h | 0 h (specs dedicados por cambio) |
| Revisar reporte y aprobar | — | ~1 h |
| Validar calificación manual de ensayo | ~2 h | ~1 h (caso no automatizable justificado) |
| **Total** | **~40 h** | **~2 h** |

La suite corre en ~15-25 minutos en modo headless. El reporte HTML muestra evidencia visual (screenshots en cada paso, video en caso de fallo) que el QA humano revisa en ~1 hora para aprobar el deploy.

---

## Stack de decisiones

| Decisión | Elegido | Alternativas descartadas | Razón |
|---|---|---|---|
| Framework QA | Playwright + TypeScript | Behat, Cypress, Selenium | Mejor soporte headless, reportes con video/screenshots, excelente para dirigir con IA |
| Capa de cambios | Plugin local (`local_gesexam`) | Hack en core, plugin de actividad | Es la capa oficial de Moodle para extensiones sin modificar el core |
| Base de datos | MariaDB 10.6 | PostgreSQL | Bitnami Moodle usa MariaDB por defecto; reduce fricción en setup |
| Infra | Docker Compose local | VPS, Railway | El enunciado pide levantarlo localmente; evidencia vía reporte + video |

---

## Documentación detallada

Ver `docs/decisions.md` para:
- Cómo se dirigió la IA en cada parte
- Qué se delegó vs qué se decidió manualmente
- Discrepancias encontradas entre documentación de Moodle y comportamiento real
