<?php
namespace local_gesexam;

defined('MOODLE_INTERNAL') || die();

require_once($CFG->libdir . '/externallib.php');

/**
 * Web services del plugin — Cambio 2: registrar pérdida de foco vía AJAX.
 */
class external extends \external_api {

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

        $now = time();
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
}
