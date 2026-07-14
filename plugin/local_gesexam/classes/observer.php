<?php
namespace local_gesexam;

defined('MOODLE_INTERNAL') || die();

class observer {

    /**
     * Maneja el evento attempt_submitted.
     * Aplica Cambio 3 (webhook) y Cambio 4 (penalización por gracia).
     */
    public static function attempt_submitted(\mod_quiz\event\attempt_submitted $event): void {
        global $DB;

        $attemptid = $event->objectid;
        $attempt   = $DB->get_record('quiz_attempts', ['id' => $attemptid], '*', MUST_EXIST);
        $quiz      = $DB->get_record('quiz', ['id' => $attempt->quiz], '*', MUST_EXIST);

        // ── Cambio 4: penalización por gracia ────────────────────────────────
        self::apply_grace_penalty($attempt, $quiz);

        // ── Cambio 3: notificación externa ───────────────────────────────────
        self::send_webhook($attempt, $quiz, $event->userid);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CAMBIO 4: Penalización por período de gracia
    // ─────────────────────────────────────────────────────────────────────────

    private static function apply_grace_penalty(\stdClass $attempt, \stdClass $quiz): void {
        global $DB, $CFG;

        // Solo si el examen tiene límite de tiempo y período de gracia configurados
        if (empty($quiz->timelimit) || empty($quiz->graceperiod)) {
            return;
        }

        // Detectar si el intento se envió durante el período de gracia:
        // timeclose = timestart + timelimit
        // gracia: timeclose < timefinish <= timeclose + graceperiod
        $timeclose = $attempt->timestart + $quiz->timelimit;
        $inGrace   = ($attempt->timefinish > $timeclose)
                  && ($attempt->timefinish <= $timeclose + $quiz->graceperiod);

        if (!$inGrace) {
            return;
        }

        // Ya procesado
        if ($DB->record_exists('local_gesexam_penalties', ['attemptid' => $attempt->id])) {
            return;
        }

        $penaltypct   = (int) get_config('local_gesexam', 'grace_penalty') ?: 10;
        $originalgrade = (float) $attempt->sumgrades;
        $penaltyamt   = $originalgrade * ($penaltypct / 100);
        $finalgrade   = max(0, $originalgrade - $penaltyamt);

        // Guardar penalización
        $record = new \stdClass();
        $record->attemptid     = $attempt->id;
        $record->userid        = $attempt->userid;
        $record->originalgrade = $originalgrade;
        $record->penaltypct    = $penaltypct;
        $record->penaltyamt    = $penaltyamt;
        $record->finalgrade    = $finalgrade;
        $record->timecreated   = time();
        $DB->insert_record('local_gesexam_penalties', $record);

        // Actualizar sumgrades del intento
        $DB->set_field('quiz_attempts', 'sumgrades', $finalgrade, ['id' => $attempt->id]);

        // Reflejar en el gradebook
        require_once($CFG->dirroot . '/mod/quiz/lib.php');
        quiz_save_best_grade($quiz, $attempt->userid);

        \core\notification::info(
            "Penalización por período de gracia aplicada: -{$penaltypct}% ({$penaltyamt} puntos)"
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CAMBIO 3: Webhook externo con reintentos
    // ─────────────────────────────────────────────────────────────────────────

    private static function send_webhook(\stdClass $attempt, \stdClass $quiz, int $userid): void {
        global $DB;

        $url = get_config('local_gesexam', 'webhook_url');
        if (empty($url)) {
            return;
        }

        $user     = $DB->get_record('user', ['id' => $userid]);
        $penalty  = $DB->get_record('local_gesexam_penalties', ['attemptid' => $attempt->id]);

        $payload = json_encode([
            'student'       => fullname($user),
            'student_email' => $user->email,
            'quiz'          => $quiz->name,
            'attempt_grade' => (float) $attempt->sumgrades,
            'final_grade'   => $penalty ? (float) $penalty->finalgrade : (float) $attempt->sumgrades,
            'grace_penalty' => $penalty ? $penalty->penaltypct . '%' : null,
            'timestamp'     => date('c', $attempt->timefinish),
        ]);

        $maxAttempts = 3;
        $success     = false;
        $httpcode    = null;
        $response    = null;

        for ($i = 1; $i <= $maxAttempts; $i++) {
            [$httpcode, $response] = self::http_post($url, $payload);
            if ($httpcode >= 200 && $httpcode < 300) {
                $success = true;
                break;
            }
            // Backoff exponencial: 2s, 4s
            if ($i < $maxAttempts) {
                sleep(pow(2, $i));
            }
        }

        // Registrar resultado
        $log = new \stdClass();
        $log->attemptid   = $attempt->id;
        $log->url         = $url;
        $log->payload     = $payload;
        $log->httpcode    = $httpcode;
        $log->response    = $response;
        $log->attempts    = $maxAttempts - ($success ? ($maxAttempts - array_search($httpcode, array_fill(0, $maxAttempts, $httpcode))) : 0);
        $log->success     = (int) $success;
        $log->timecreated = time();
        $DB->insert_record('local_gesexam_webhook_log', $log);
    }

    private static function http_post(string $url, string $payload): array {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        ]);
        $response = curl_exec($ch);
        $httpcode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return [$httpcode, $response ?: ''];
    }
}
