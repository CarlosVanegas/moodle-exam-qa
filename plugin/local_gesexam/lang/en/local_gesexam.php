<?php
defined('MOODLE_INTERNAL') || die();

$string['pluginname']       = 'GES Exam Extensions';

// Cambio 1 — IA para ensayo
$string['heading_ai']         = 'Cambio 1 — Sugerencia de calificación con IA';
$string['claude_apikey']      = 'API Key de Claude (Anthropic)';
$string['claude_apikey_desc'] = 'Clave de API de Anthropic para generar sugerencias de calificación en preguntas de ensayo.';
$string['claude_model']       = 'Modelo de Claude';
$string['claude_model_desc']  = 'Identificador del modelo a usar. Ejemplo: claude-haiku-4-5-20251001 (económico) o claude-sonnet-4-6.';
$string['ai_suggest_btn']     = 'Sugerir con IA';
$string['ai_suggesting']      = 'Consultando IA...';
$string['ai_suggestion_title']= 'Sugerencia de IA';
$string['ai_apply_grade']     = 'Aplicar nota';

// Cambio 3 — Webhook
$string['heading_webhook']      = 'Cambio 3 — Notificación externa al enviar';
$string['webhook_url']          = 'Endpoint externo (Cambio 3)';
$string['webhook_url_desc']     = 'URL a la que se enviará el resultado cuando un estudiante envíe un intento.';

// Cambio 4 — Penalización por gracia
$string['heading_grace']        = 'Cambio 4 — Penalización por período de gracia';
$string['grace_penalty']        = 'Penalización por gracia (%)';
$string['grace_penalty_desc']   = 'Porcentaje de penalización aplicado a intentos enviados durante el período de gracia. Ejemplo: 10 = 10%.';

// Cambio 2 — Foco
$string['focus_losses']   = 'Pérdidas de foco';
$string['focus_warning']  = 'Más de 3 pérdidas de foco';
