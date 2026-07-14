# Moodle Exam QA — GES Universidad Galileo

Prueba Técnica 2 · Ingeniero de Software Senior (IA)  
**Candidato:** Carlos Vanegas · carlosvanegas65@gmail.com  
**Repositorio:** https://github.com/CarlosVanegas/moodle-exam-qa

---

## Qué contiene este repo

| Carpeta | Qué es |
|---|---|
| `docker/` | Imagen personalizada de Moodle 4.4 + MariaDB + receptor webhook, listos para levantar con un solo comando |
| `plugin/local_gesexam/` | Plugin Moodle que implementa los 4 cambios del mes |
| `qa/` | Suite Playwright + TypeScript con cobertura completa del módulo Quiz |
| `docs/` | Decisiones técnicas, dirección de IA, cobertura y argumento 40h→2h |

---

## Levantar el entorno desde cero

### Requisitos previos

| Herramienta | Versión mínima | Cómo verificar |
|---|---|---|
| Docker Desktop (o Docker Engine + Compose v2) | 24.x | `docker --version` |
| Node.js | 20.x | `node --version` |
| npm | 10.x | `npm --version` |
| Git | cualquiera | `git --version` |
| curl | cualquiera | `curl --version` |

> **Windows:** usar Git Bash o WSL2. PowerShell no funciona con los scripts de seed.

---

### Paso 1 — Clonar el repositorio

```bash
git clone https://github.com/CarlosVanegas/moodle-exam-qa.git
cd moodle-exam-qa
```

---

### Paso 2 — Configurar variables de entorno

Copiar el archivo de ejemplo y **editarlo** si se necesitan valores distintos a los defaults:

```bash
cp docker/.env.example docker/.env
```

El archivo `docker/.env` es leído tanto por Docker Compose como por la suite de QA (vía `dotenv`). A continuación se describe cada variable:

#### Variables de administración de Moodle

| Variable | Default | Para qué sirve |
|---|---|---|
| `MOODLE_USERNAME` | `admin` | Usuario del administrador de Moodle |
| `MOODLE_PASSWORD` | `Admin1234!` | Contraseña del administrador. Debe cumplir la política de contraseñas de Moodle (mayúscula + número + símbolo, mínimo 8 chars) |
| `MOODLE_EMAIL` | `admin@galileo.edu` | Email del administrador |
| `MOODLE_SITE_NAME` | `GES Exam QA` | Nombre del sitio que aparece en la interfaz |

#### Variables de base de datos

| Variable | Default | Para qué sirve |
|---|---|---|
| `MOODLE_DATABASE_HOST` | `mariadb` | Hostname del servicio MariaDB dentro de la red Docker. **No cambiar** salvo que se use una BD externa |
| `MOODLE_DATABASE_NAME` | `moodle` | Nombre de la base de datos de Moodle |
| `MOODLE_DATABASE_USER` | `moodleuser` | Usuario de BD que usa Moodle |
| `MOODLE_DATABASE_PASSWORD` | `MoodlePass1234!` | Contraseña de ese usuario |
| `MARIADB_ROOT_PASSWORD` | `RootPass1234!` | Contraseña de root de MariaDB (solo para el contenedor) |
| `MARIADB_DATABASE` | `moodle` | Debe coincidir con `MOODLE_DATABASE_NAME` |
| `MARIADB_USER` | `moodleuser` | Debe coincidir con `MOODLE_DATABASE_USER` |
| `MARIADB_PASSWORD` | `MoodlePass1234!` | Debe coincidir con `MOODLE_DATABASE_PASSWORD` |

> Las variables `MARIADB_*` son las que usa la imagen oficial de MariaDB para crear el usuario y la BD en el primer arranque. Deben coincidir exactamente con las variables `MOODLE_DATABASE_*`.

#### Variable del receptor webhook (Cambio 3)

| Variable | Default | Para qué sirve |
|---|---|---|
| `WEBHOOK_PORT` | `3001` | Puerto en el host donde escucha el receptor de prueba Node.js para el webhook del Cambio 3 |

#### Variables de la suite de QA

| Variable | Default | Para qué sirve |
|---|---|---|
| `MOODLE_URL` | `http://localhost:8080` | URL base de Moodle. La suite de Playwright usa esta URL para todas las navegaciones |
| `TEACHER_USER` | `profesor01` | Usuario del profesor creado por el seed |
| `TEACHER_PASS` | `Profesor1234!` | Contraseña del profesor |
| `STUDENT_USER` | `estudiante01` | Usuario del estudiante creado por el seed |
| `STUDENT_PASS` | `Estudiante1234!` | Contraseña del estudiante |

> Para la entrega de evaluación **no es necesario cambiar ningún valor** del `.env.example`.

---

### Paso 3 — Levantar Moodle

```bash
cd docker
docker compose up -d
```

Este comando ejecuta tres etapas en orden:

1. **Build de la imagen** (`Dockerfile.moodle`) — descarga Moodle 4.4.1 de moodle.org y prepara la imagen PHP/Apache. Solo ocurre la primera vez; tarda ~3-5 minutos dependiendo de la conexión.

2. **Arranque del contenedor `moodle`** — en el primer boot corre el script de instalación CLI de Moodle (crea config.php, popula la BD, crea el usuario admin). Este paso tarda ~5 minutos y solo ocurre una vez. Los reinicios posteriores son inmediatos.

3. **Seed automático** — una vez que el healthcheck de Moodle pasa, el contenedor `ges_seed` ejecuta `seed.php` que crea el curso, usuarios, banco de preguntas y examen de prueba.

**Verificar que Moodle está listo:**

```bash
docker compose logs -f moodle | grep "Moodle is ready"
```

Cuando aparezca `=== Moodle is ready ===` el sitio está operativo.

**Verificar que el seed terminó:**

```bash
docker compose logs seed
```

Debe mostrar `=== Seed completado ===` al final.

**Moodle disponible en:** http://localhost:8080

#### Credenciales de acceso

| Rol | Usuario | Contraseña |
|---|---|---|
| Administrador | `admin` | `Admin1234!` |
| Profesor | `profesor01` | `Profesor1234!` |
| Estudiante | `estudiante01` | `Estudiante1234!` |

#### Qué crea el seed automáticamente

- Curso: **"Curso de Prueba QA"** (shortname: `QA-COURSE`, id=2)
- Usuario profesor `profesor01` matriculado como editingteacher
- Usuario estudiante `estudiante01` matriculado como student
- Banco de preguntas con todos los tipos requeridos: opción múltiple, Verdadero/Falso, respuesta corta, numérica, emparejamiento, ensayo
- Examen **"Examen QA"** con timer de 10 minutos, período de gracia de 2 minutos, intentos ilimitados

---

### Paso 4 — Instalar el plugin

El plugin `local_gesexam` se monta automáticamente vía volumen Docker en `/var/www/html/local/gesexam/` dentro del contenedor.

Al primer acceso de administrador, Moodle detecta el plugin pendiente de instalar:

1. Ir a **http://localhost:8080** con el usuario `admin`
2. Moodle muestra el wizard de "Actualización del servidor Moodle"
3. Hacer clic en **"Actualizar base de datos de Moodle"**
4. Esperar que cree las tablas del plugin (tarda ~10 segundos)
5. Hacer clic en **"Continuar"** al final

Si no aparece el wizard, forzar la detección manualmente:

```bash
docker exec -u www-data ges_moodle php /var/www/html/admin/cli/upgrade.php --non-interactive
```

---

### Paso 5 — Configurar el plugin (admin)

Ir a **Administración del sitio → Plugins → Plugins locales → GES Exam Extensions**:

| Parámetro | Valor para la entrega | Para qué sirve |
|---|---|---|
| Endpoint externo (Cambio 3) | `http://localhost:3001/webhook` | URL a la que se envía el webhook al enviar un intento |
| Penalización por gracia (Cambio 4) | `10` | Porcentaje que se descuenta de la nota si el intento se envía durante el período de gracia |
| API Key de Anthropic (Cambio 1) | (clave real de Anthropic) | Solo necesaria para probar la sugerencia de IA en calificación de ensayo. El test C1 verifica el flujo sin ejecutar la llamada real |
| Modelo de IA (Cambio 1) | `claude-haiku-4-5-20251001` | Modelo usado para sugerencias. Haiku por defecto (economía) |

> El receptor webhook (`ges_webhook`) ya está corriendo en el puerto 3001 como parte del `docker compose up`. No requiere configuración adicional.

---

### Paso 6 — Agregar preguntas al examen (opcional, para tests de envío)

El examen sembrado no tiene preguntas añadidas por defecto — los specs del banco de preguntas las agregan en el test 03. Para que los tests de `08-student-submit.spec.ts` corran con resultado completo (en vez de saltarse limpiamente), ejecutar primero:

```bash
cd qa
npx playwright test tests/03-add-questions.spec.ts --headed
```

---

## Correr la suite de QA

### Instalación

```bash
cd qa
npm install
npx playwright install chromium
```

### Ejecutar todos los tests

```bash
npm test
```

El comando ejecuta `npx playwright test`. La suite:
- Corre en modo headless (sin ventana)
- Usa 1 worker (Moodle no tolera sesiones paralelas en E2E)
- Hace 1 reintento automático en caso de fallo intermitente
- Tarda aproximadamente **15-25 minutos** en la primera ejecución (warmup de Moodle) y ~10-15 minutos en ejecuciones siguientes

**Resultado esperado:**

```
59 passed · 6 skipped · 0 failed
```

Los 6 skipped son tests de `08-student-submit.spec.ts` que se saltan limpiamente cuando el examen no tiene preguntas. Son skips esperados, no fallos.

### Ver el reporte HTML

```bash
npx playwright show-report
```

Abre el reporte en el navegador. Cada test muestra:
- Log de pasos ejecutados
- Anotaciones con estado intermedio (ej. "Timer t1=09:58 → t2=09:56")
- Screenshots de cada paso relevante
- Video del intento en caso de fallo

### Ejecutar un spec individual

```bash
npx playwright test tests/01-exam-setup.spec.ts
npx playwright test tests/change1-ai-essay-suggestion.spec.ts
```

### Ejecutar en modo visual (headed)

```bash
npm test -- --headed
```

O para un spec específico:

```bash
npx playwright test tests/06-student-attempt.spec.ts --headed
```

### Ejecutar solo los specs de los 4 cambios

```bash
npx playwright test tests/change1-ai-essay-suggestion.spec.ts tests/change2-focus-loss.spec.ts tests/change3-webhook.spec.ts tests/change4-grace-penalty.spec.ts
```

---

## Troubleshooting

### Docker compose up falla con "connection refused" en MariaDB

El contenedor `moodle` arranca antes de que MariaDB esté lista. El entrypoint tiene reintentos automáticos cada 5s por 30 intentos. Si sigue fallando:

```bash
docker compose down -v   # elimina volúmenes y empieza de cero
docker compose up -d
```

### Moodle tarda más de 10 minutos en arrancar

La primera descarga de Moodle 4.4 (~60 MB) y la instalación CLI de la BD pueden tardar según la conexión. Verificar progreso:

```bash
docker compose logs -f moodle
```

### "global-setup" de Playwright falla con timeout

El global-setup intenta un warmup curl para pre-compilar templates de Moodle. Si Moodle no responde en el timeout:

1. Verificar que Moodle está corriendo: `curl -I http://localhost:8080/login/index.php`
2. Verificar el estado de los contenedores: `docker compose ps`
3. Si el contenedor `moodle` está en estado "unhealthy", revisar logs: `docker compose logs moodle`

### Los tests fallan con "Examen QA not found"

El seed no se ejecutó o falló. Verificar:

```bash
docker compose logs seed
```

Si el seed no corrió, ejecutarlo manualmente:

```bash
docker exec ges_seed bash /seed/seed.sh
```

O ejecutar directamente el PHP de seed:

```bash
docker exec -u www-data ges_moodle php /seed/seed.php
```

### El plugin no aparece en la lista de plugins

Verificar que el volumen está montado:

```bash
docker exec ges_moodle ls /var/www/html/local/gesexam/
```

Debe mostrar los archivos del plugin. Si no, revisar que el path relativo en `docker-compose.yml` es correcto y que el directorio `plugin/local_gesexam/` existe en el repo.

### Limpiar todo y empezar de cero

```bash
cd docker
docker compose down -v   # elimina contenedores y volúmenes
docker compose up -d     # vuelve a levantar desde cero
```

---

## Los 4 cambios implementados

### Cambio 1 — Sugerencia de calificación con IA para ensayo

**Comportamiento:** En la pantalla de calificación manual del examen, cada pregunta de ensayo muestra un botón "Sugerir con IA". Al hacer clic, el sistema envía el enunciado de la pregunta, la nota máxima y la respuesta del estudiante a Claude (Anthropic) vía AJAX. El modelo devuelve una nota sugerida y un feedback breve en JSON. El profesor puede aplicar la nota con un clic o editarla antes de guardar. Nada se aplica al gradebook automáticamente.

**Implementación:** Web service `local_gesexam_get_essay_suggestion` (PHP) que consulta la API de Anthropic. AMD module `essay_suggester.js` que inyecta el botón en la pantalla de calificación. El API key y modelo se configuran en Administración del sitio → Plugins → GES Exam Extensions.

**Capa elegida:** Web service + AMD + lib.php hook. Sin tocar `mod/quiz/report/grading/`.

---

### Cambio 2 — Señal de integridad por pérdida de foco

**Comportamiento:** Mientras el estudiante rinde un intento, el sistema registra cada vez que el examen pierde el foco (cambio de pestaña o ventana). El conteo se guarda por intento. En la vista del profesor aparece el conteo; los intentos con más de 3 pérdidas se marcan visualmente.

**Implementación:** Módulo AMD (`amd/src/focus_tracker.js`) que escucha `visibilitychange` y `blur`. Envía cada evento vía AJAX a un web service del plugin que incrementa el contador en tabla `local_gesexam_focus_events`.

**Capa elegida:** Plugin local con AMD + web service interno. Sin tocar el core de `mod/quiz`.

---

### Cambio 3 — Notificación externa al enviar intento

**Comportamiento:** Al enviar un intento se hace POST a un endpoint configurable con: estudiante, examen, nota del intento, nota final, timestamp. El envío es resiliente: fallo = reintento con backoff exponencial (2s, 4s). Cada envío queda registrado en tabla `local_gesexam_webhook_log`.

**Implementación:** Event observer sobre `\mod_quiz\event\attempt_submitted`. Usa `curl_multi` con reintentos. El admin configura el endpoint desde Administración del sitio. Incluye receptor de prueba Node.js en `docker/webhook-receiver/`.

**Capa elegida:** Event observer — la capa estándar de Moodle para reaccionar a eventos sin modificar el core.

---

### Cambio 4 — Penalización por entrega en período de gracia

**Comportamiento:** Los intentos auto-enviados dentro del período de gracia reciben una penalización configurable (default 10%) sobre la nota del intento. La penalización se muestra al estudiante en la pantalla de resultado y se refleja en el gradebook.

**Implementación:** Event observer sobre `\mod_quiz\event\attempt_submitted` que detecta si `timefinish > timeclose`, calcula la penalización, la guarda en tabla `local_gesexam_penalties` y llama a `quiz_save_best_grade()` con la nota ajustada.

**Capa elegida:** Event observer + override del grade. Sin modificar `mod/quiz/attemptlib.php`.

---

## Cobertura de la suite QA

| # | Flujo | Archivo | Estado |
|---|---|---|---|
| 1 | Crear y configurar examen | `01-exam-setup.spec.ts` | Pasa |
| 2 | Banco de preguntas (todos los tipos) | `02-question-bank.spec.ts` | Pasa |
| 3 | Agregar preguntas al examen | `03-add-questions.spec.ts` | Pasa |
| 4 | Opciones de revisión | `04-review-options.spec.ts` | Pasa |
| 5 | Vista previa del examen (profesor) | `05-professor-preview.spec.ts` | Pasa |
| 6 | Intento del estudiante (navegar, marcar) | `06-student-attempt.spec.ts` | Pasa |
| 7 | Límite de tiempo y auto-envío | `07-timer-autosubmit.spec.ts` | Pasa |
| 8 | Envío del intento | `08-student-submit.spec.ts` | 6 skips esperados¹ |
| 9 | Calificación automática y resultado | `09-auto-grading.spec.ts` | Pasa |
| 10 | Calificación manual (ensayo) y recalificar | `10-professor-grading.spec.ts` | Pasa |
| 11 | Override de notas y reportes | `11-grade-override.spec.ts` | Pasa |
| 12 | Restricciones de acceso | `12-access-restrictions.spec.ts` | Pasa |
| C1 | Sugerencia IA para ensayo | `change1-ai-essay-suggestion.spec.ts` | Pasa |
| C2 | Señal de integridad (pérdida de foco) | `change2-focus-loss.spec.ts` | Pasa |
| C3 | Notificación externa al enviar | `change3-webhook.spec.ts` | Pasa |
| C4 | Penalización por gracia | `change4-grace-penalty.spec.ts` | Pasa |

**Resultado de la última corrida:** 59 passed · 6 skipped · 0 failed (runtime ~15 min)

**Notas:**

¹ `08-student-submit.spec.ts` — los 6 scenarios requieren un intento activo con preguntas respondidas. El examen sembrado no tiene preguntas añadidas por defecto; los tests detectan esta condición y se saltan limpiamente (`test.skip`) en vez de fallar. Para ejecutarlos con resultado completo, correr primero `tests/03-add-questions.spec.ts` (añade preguntas al examen). Los skips son declarados y esperados, no fallos.

² La calificación manual de ensayo con **criterio subjetivo del profesor** (qué nota merece una respuesta abierta) no es automatizable. El test `10-professor-grading.spec.ts` verifica que el campo de calificación existe, acepta un valor y lo guarda — pero el criterio de corrección es humano por definición. Tiempo estimado de revisión manual: 10 min/mes.

---

## Por qué esto reduce de 40h a ~2h

| Actividad | Antes (manual) | Ahora (automatizado) |
|---|---|---|
| Verificar 12 flujos del módulo Quiz | ~30 h | 0 h (corre la suite) |
| Verificar 4 cambios del mes | ~8 h | 0 h (specs dedicados por cambio) |
| Revisar reporte y aprobar | — | ~1 h |
| Validar calificación manual de ensayo | ~2 h | ~1 h (caso no automatizable justificado) |
| **Total** | **~40 h** | **~2 h** |

La suite corre en ~15-25 minutos en modo headless. El reporte HTML incluye evidencia visual (anotaciones de estado en cada paso, screenshots en fallos, video en caso de error) que el QA humano revisa en ~1 hora para aprobar el deploy.

---

## Estructura del proyecto

```
moodle-exam-qa/
├── docker/
│   ├── Dockerfile.moodle          # Imagen PHP 8.2 + Apache con Moodle 4.4.1
│   ├── moodle-entrypoint.sh       # Instala Moodle en primer boot
│   ├── docker-compose.yml         # Moodle + MariaDB + seed + webhook receiver
│   ├── .env.example               # Plantilla de variables de entorno
│   ├── seed/
│   │   ├── seed.php               # Crea curso, usuarios, banco, examen
│   │   └── seed.sh                # Espera a Moodle healthy, luego ejecuta seed.php
│   └── webhook-receiver/
│       └── server.js              # Receptor Node.js de prueba para el webhook del Cambio 3
├── plugin/
│   └── local_gesexam/             # Plugin Moodle con los 4 cambios
│       ├── amd/src/
│       │   ├── focus_tracker.js   # Cambio 2: rastrea pérdida de foco
│       │   └── essay_suggester.js # Cambio 1: inyecta botón de sugerencia IA
│       ├── classes/
│       │   ├── external.php       # Web services (Cambio 1 y 2)
│       │   └── observer.php       # Event observers (Cambio 3 y 4)
│       ├── db/
│       │   ├── events.php         # Registro de event observers
│       │   ├── install.xml        # Esquema de tablas del plugin
│       │   └── services.php       # Registro de web services
│       ├── lang/en/local_gesexam.php
│       ├── lib.php                # Hook para inyectar AMD en páginas de calificación
│       ├── settings.php           # Configuración en panel de administración
│       └── version.php
├── qa/
│   ├── global-setup.ts            # Pre-login y warmup de Moodle antes de los tests
│   ├── playwright.config.ts       # Configuración de Playwright (lee docker/.env)
│   ├── helpers/
│   │   ├── auth.ts                # Login helpers y constantes de usuarios
│   │   └── moodle.ts              # Helpers de navegación (gotoCourse, waitForMoodle)
│   └── tests/
│       ├── 01-exam-setup.spec.ts … 12-access-restrictions.spec.ts
│       ├── change1-ai-essay-suggestion.spec.ts
│       ├── change2-focus-loss.spec.ts
│       ├── change3-webhook.spec.ts
│       └── change4-grace-penalty.spec.ts
└── docs/
    └── decisions.md               # Decisiones técnicas y dirección de IA
```

---

## Stack de decisiones

| Decisión | Elegido | Alternativas descartadas | Razón |
|---|---|---|---|
| Framework QA | Playwright + TypeScript | Behat, Cypress, Selenium | Mejor soporte headless, reportes con video/screenshots, excelente para dirigir con IA |
| Capa de cambios | Plugin local (`local_gesexam`) | Hack en core, plugin de actividad | Es la capa oficial de Moodle para extensiones sin modificar el core |
| Base de datos | MariaDB 10.6 | PostgreSQL | Compatible con Moodle 4.4; imagen Docker oficial madura |
| Infra | Docker Compose local | VPS, Railway | El enunciado pide levantarlo localmente; evidencia vía reporte HTML + screenshots |
| Modelo IA | Claude Haiku (configurable) | GPT-4, Gemini | Economía + velocidad para sugerencias de calificación; configurable para casos que requieran más razonamiento |

---

## Documentación detallada

Ver `docs/decisions.md` para:
- Decisiones técnicas por cada cambio
- Qué se delegó a la IA vs qué se decidió manualmente
- Discrepancias encontradas entre documentación de Moodle y comportamiento real
- Argumento detallado 40h → 2h
