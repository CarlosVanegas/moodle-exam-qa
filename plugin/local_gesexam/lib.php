<?php
defined('MOODLE_INTERNAL') || die();

/**
 * Cambio 1 — Inyectar el módulo AMD de sugerencia IA en la pantalla de
 * calificación manual del quiz (mod/quiz/report/grading/).
 *
 * local_gesexam_extend_navigation es el hook estándar de Moodle para plugins
 * locales que necesitan ejecutar código en cada carga de página.
 */
function local_gesexam_extend_navigation(global_navigation $nav): void {
    global $PAGE;

    // Solo en páginas del módulo quiz
    if (!isset($PAGE->cm) || !$PAGE->cm || $PAGE->cm->modname !== 'quiz') {
        return;
    }

    // Solo en la pantalla de calificación manual
    if (strpos($PAGE->pagetype, 'mod-quiz-report-grading') === false) {
        return;
    }

    $PAGE->requires->js_call_amd('local_gesexam/essay_suggester', 'init');
}
