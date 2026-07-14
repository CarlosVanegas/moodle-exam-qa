<?php
namespace local_gesexam;

defined('MOODLE_INTERNAL') || die();

require_once($CFG->libdir . '/externallib.php');

/**
 * Web services del plugin GES Exam Extensions.
 *
 * Cambio 1: get_essay_suggestion  — sugerencia IA para calificación de ensayo
 * Cambio 2: record_focus_loss     — registrar pérdida de foco durante intento
 */
class external extends \external_api {

    // ── Cambio 2: pérdida de foco ─────────────────────────────────────────────

    public static function record_focus_loss_parameters(): \external_function_parameters {
        return new \external_function_parameters([
            'attemptid' => new \external_value(PARAM_INT, 'ID del intento'),
        ]);
    }

    public static function record_focus_loss(int $attemptid): array {
        global $DB, $USER;

        $params = self::validate_parameters(
            self::record_focus_loss_parameters(),
            ['attemptid' => $attemptid]
        );

        $now    = time();
        $record = $DB->get_record('local_gesexam_focus', ['attemptid' => $params['attemptid']]);

        if ($record) {
            $record->focuslosses++;
            $record->timemodified = $now;
            $DB->update_record('local_gesexam_focus', $record);
        } else {
            $record = new \stdClass();
            $record->attemptid    = $params['attemptid'];
            $record->userid       = $USER->id;
            $record->focuslosses  = 1;
            $record->timecreated  = $now;
            $record->timemodified = $now;
            $DB->insert_record('local_gesexam_focus', $record);
        }

        return ['focuslosses' => (int)($record->focuslosses ?? 1)];
    }

    public static function record_focus_loss_returns(): \external_single_structure {
        return new \external_single_structure([
            'focuslosses' => new \external_value(PARAM_INT, 'Total de pérdidas de foco'),
        ]);
    }

    // ── Cambio 1: sugerencia IA para ensayo ──────────────────────────────────

    public static function get_essay_suggestion_parameters(): \external_function_parameters {
        return new \external_function_parameters([
            'attemptid' => new \external_value(PARAM_INT, 'ID del intento de quiz'),
            'slot'      => new \external_value(PARAM_INT, 'Número de slot de la pregunta'),
        ]);
    }

    public static function get_essay_suggestion(int $attemptid, int $slot): array {
        global $DB, $CFG;

        $params = self::validate_parameters(
            self::get_essay_suggestion_parameters(),
            ['attemptid' => $attemptid, 'slot' => $slot]
        );

        // Cargar intento y quiz
        $attempt = $DB->get_record('quiz_attempts', ['id' => $params['attemptid']], '*', MUST_EXIST);
        $quiz    = $DB->get_record('quiz', ['id' => $attempt->quiz], '*', MUST_EXIST);
        $cm      = get_coursemodule_from_instance('quiz', $quiz->id, $quiz->course, false, MUST_EXIST);

        // Verificar capacidad de calificación
        $context = \context_module::instance($cm->id);
        self::validate_context($context);
        require_capability('mod/quiz:grade', $context);

        // Obtener el question_attempt para este slot
        $qa = $DB->get_record_sql(
            "SELECT qa.id, qa.questionid, qa.slot, q.questiontext, q.defaultmark
               FROM {question_attempts} qa
               JOIN {question} q ON q.id = qa.questionid
              WHERE qa.questionusageid = :qubaid
                AND qa.slot = :slot",
            ['qubaid' => $attempt->uniqueid, 'slot' => $params['slot']]
        );

        if (!$qa) {
            return ['grade' => 0.0, 'feedback' => 'No se encontró la pregunta en este intento.', 'error' => true];
        }

        // Obtener la respuesta del estudiante (último paso del intento)
        $step = $DB->get_record_sql(
            "SELECT qas.id
               FROM {question_attempt_steps} qas
              WHERE qas.questionattemptid = :qaid
              ORDER BY qas.sequencenumber DESC
              LIMIT 1",
            ['qaid' => $qa->id]
        );

        $student_response = '';
        if ($step) {
            $stepdata = $DB->get_records_menu(
                'question_attempt_step_data',
                ['attemptstepid' => $step->id],
                '',
                'name, value'
            );
            // La respuesta de ensayo se guarda con la clave 'answer'
            $student_response = $stepdata['answer'] ?? '';
            // Limpiar HTML si llegó con editor
            $student_response = strip_tags($student_response);
        }

        if (trim($student_response) === '') {
            return ['grade' => 0.0, 'feedback' => 'El estudiante no escribió una respuesta.', 'error' => false];
        }

        // Consultar API de Claude
        $apikey = get_config('local_gesexam', 'claude_apikey');
        $model  = get_config('local_gesexam', 'claude_model') ?: 'claude-haiku-4-5-20251001';

        if (empty($apikey)) {
            return ['grade' => 0.0, 'feedback' => 'API key de Claude no configurada en Administración del sitio → Plugins → GES Exam Extensions.', 'error' => true];
        }

        $question_text = strip_tags($qa->questiontext);
        $max_mark      = (float)$qa->defaultmark;

        $prompt = "Eres un evaluador académico imparcial. Califica la siguiente respuesta de ensayo de forma objetiva.\n\n"
            . "Enunciado de la pregunta:\n{$question_text}\n\n"
            . "Nota máxima posible: {$max_mark}\n\n"
            . "Respuesta del estudiante:\n{$student_response}\n\n"
            . "Instrucciones: Evalúa la calidad, precisión y completitud de la respuesta. "
            . "Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional antes ni después:\n"
            . "{\"grade\": <número entre 0 y {$max_mark}>, \"feedback\": \"<retroalimentación constructiva en 1-2 oraciones>\"}";

        $payload = json_encode([
            'model'      => $model,
            'max_tokens' => 400,
            'messages'   => [['role' => 'user', 'content' => $prompt]],
        ]);

        $ch = curl_init('https://api.anthropic.com/v1/messages');
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_HTTPHEADER     => [
                'x-api-key: ' . $apikey,
                'anthropic-version: 2023-06-01',
                'Content-Type: application/json',
            ],
        ]);
        $response = curl_exec($ch);
        $httpcode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpcode !== 200) {
            return [
                'grade'    => 0.0,
                'feedback' => "Error al consultar la IA (HTTP {$httpcode}). Verifica la API key.",
                'error'    => true,
            ];
        }

        $data    = json_decode($response, true);
        $content = $data['content'][0]['text'] ?? '{}';

        // Extraer JSON de la respuesta (Claude puede incluir texto adicional)
        if (preg_match('/\{[^{}]+\}/s', $content, $m)) {
            $suggestion = json_decode($m[0], true);
        } else {
            $suggestion = json_decode($content, true);
        }

        if (!is_array($suggestion) || !array_key_exists('grade', $suggestion)) {
            return [
                'grade'    => 0.0,
                'feedback' => 'La IA no devolvió una respuesta válida. Intenta de nuevo.',
                'error'    => true,
            ];
        }

        $grade    = min($max_mark, max(0.0, (float)$suggestion['grade']));
        $feedback = (string)($suggestion['feedback'] ?? '');

        return ['grade' => $grade, 'feedback' => $feedback, 'error' => false];
    }

    public static function get_essay_suggestion_returns(): \external_single_structure {
        return new \external_single_structure([
            'grade'    => new \external_value(PARAM_FLOAT, 'Nota sugerida por la IA'),
            'feedback' => new \external_value(PARAM_TEXT,  'Retroalimentación generada por la IA'),
            'error'    => new \external_value(PARAM_BOOL,  'true si hubo un error al consultar la IA'),
        ]);
    }
}
