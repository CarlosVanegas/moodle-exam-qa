<?php
/**
 * Seed reproducible: crea usuarios, curso, banco de preguntas y examen.
 * Se ejecuta una sola vez después del primer boot de Moodle.
 */
define('CLI_SCRIPT', true);
require('/bitnami/moodle/config.php');
require_once($CFG->libdir . '/clilib.php');

cli_heading('GES Exam QA — Seed de datos');

// ── 1. Usuarios ──────────────────────────────────────────────────────────────

function ges_create_user(string $username, string $password, string $firstname, string $lastname, string $email, string $role): int {
    global $DB, $CFG;
    require_once($CFG->dirroot . '/user/lib.php');

    if ($DB->record_exists('user', ['username' => $username])) {
        cli_writeln("Usuario ya existe: $username");
        return (int) $DB->get_field('user', 'id', ['username' => $username]);
    }

    $user = new stdClass();
    $user->username   = $username;
    $user->password   = hash_internal_user_password($password);
    $user->firstname  = $firstname;
    $user->lastname   = $lastname;
    $user->email      = $email;
    $user->confirmed  = 1;
    $user->mnethostid = $CFG->mnet_localhost_id;
    $user->auth       = 'manual';

    $id = user_create_user($user, false, false);
    cli_writeln("Usuario creado: $username (id=$id)");
    return $id;
}

$teacher_id  = ges_create_user('profesor01',    'Profesor1234!',    'Profesor',    'GES', 'profesor@galileo.edu',    'editingteacher');
$student_id  = ges_create_user('estudiante01',  'Estudiante1234!',  'Estudiante',  'GES', 'estudiante@galileo.edu',  'student');

// ── 2. Curso ──────────────────────────────────────────────────────────────────

require_once($CFG->dirroot . '/course/lib.php');

$course_shortname = 'QA-GES-001';
if ($DB->record_exists('course', ['shortname' => $course_shortname])) {
    $course = $DB->get_record('course', ['shortname' => $course_shortname]);
    cli_writeln("Curso ya existe: $course_shortname");
} else {
    $coursedata = new stdClass();
    $coursedata->fullname  = 'Curso de Prueba QA';
    $coursedata->shortname = $course_shortname;
    $coursedata->category  = 1;
    $coursedata->visible   = 1;
    $course = create_course($coursedata);
    cli_writeln("Curso creado: id={$course->id}");
}

// Inscribir profesor y estudiante
$context = context_course::instance($course->id);

function ges_enrol_user(int $userid, stdClass $course, string $rolename): void {
    global $DB;
    $role = $DB->get_record('role', ['shortname' => $rolename], '*', MUST_EXIST);
    $enrol = enrol_get_plugin('manual');
    $instance = $DB->get_record('enrol', ['courseid' => $course->id, 'enrol' => 'manual']);
    if (!$instance) {
        cli_writeln("No hay instancia manual de enrol en el curso");
        return;
    }
    $enrol->enrol_user($instance, $userid, $role->id);
    cli_writeln("Usuario $userid inscrito como $rolename en curso {$course->id}");
}

ges_enrol_user($teacher_id,  $course, 'editingteacher');
ges_enrol_user($student_id,  $course, 'student');

// ── 3. Banco de preguntas ─────────────────────────────────────────────────────

require_once($CFG->dirroot . '/question/engine/lib.php');
require_once($CFG->dirroot . '/question/format.php');

$qcat_context = $context;
$qcategory = question_make_default_categories([$qcat_context]);

function ges_question_exists(string $name, int $categoryid): bool {
    global $DB;
    return $DB->record_exists('question', ['name' => $name, 'category' => $categoryid]);
}

// Opción múltiple
if (!ges_question_exists('P01 - Opción múltiple', $qcategory->id)) {
    $q = new stdClass();
    $q->category        = $qcategory->id;
    $q->qtype           = 'multichoice';
    $q->name            = 'P01 - Opción múltiple';
    $q->questiontext    = 'P01 - Opción múltiple';
    $q->questiontextformat = FORMAT_HTML;
    $q->generalfeedback = '';
    $q->generalfeedbackformat = FORMAT_HTML;
    $q->defaultmark     = 1;
    $q->penalty         = 0.3333333;
    $q->hidden          = 0;
    $q->idnumber        = null;
    $q->options         = new stdClass();
    $q->options->single = 1;
    $q->options->answers = [
        ['answer' => 'Correcta', 'fraction' => 1, 'feedback' => '', 'feedbackformat' => FORMAT_HTML],
        ['answer' => 'Incorrecta A', 'fraction' => 0, 'feedback' => '', 'feedbackformat' => FORMAT_HTML],
        ['answer' => 'Incorrecta B', 'fraction' => 0, 'feedback' => '', 'feedbackformat' => FORMAT_HTML],
    ];
    question_bank::get_qtype('multichoice')->save_question($q, $q);
    cli_writeln("Pregunta creada: P01 multichoice");
}

// Verdadero/Falso
if (!ges_question_exists('P02 - Verdadero o Falso', $qcategory->id)) {
    $q = new stdClass();
    $q->category        = $qcategory->id;
    $q->qtype           = 'truefalse';
    $q->name            = 'P02 - Verdadero o Falso';
    $q->questiontext    = 'P02 - Verdadero o Falso: La respuesta correcta es Verdadero.';
    $q->questiontextformat = FORMAT_HTML;
    $q->generalfeedback = '';
    $q->generalfeedbackformat = FORMAT_HTML;
    $q->defaultmark     = 1;
    $q->penalty         = 1;
    $q->hidden          = 0;
    $q->idnumber        = null;
    $q->options         = new stdClass();
    $q->options->answers = [
        ['answer' => 'True',  'fraction' => 1, 'feedback' => '', 'feedbackformat' => FORMAT_HTML],
        ['answer' => 'False', 'fraction' => 0, 'feedback' => '', 'feedbackformat' => FORMAT_HTML],
    ];
    question_bank::get_qtype('truefalse')->save_question($q, $q);
    cli_writeln("Pregunta creada: P02 truefalse");
}

// Respuesta corta
if (!ges_question_exists('P03 - Respuesta corta', $qcategory->id)) {
    $q = new stdClass();
    $q->category        = $qcategory->id;
    $q->qtype           = 'shortanswer';
    $q->name            = 'P03 - Respuesta corta';
    $q->questiontext    = 'P03 - Escribe "Galileo"';
    $q->questiontextformat = FORMAT_HTML;
    $q->generalfeedback = '';
    $q->generalfeedbackformat = FORMAT_HTML;
    $q->defaultmark     = 1;
    $q->penalty         = 0;
    $q->hidden          = 0;
    $q->idnumber        = null;
    $q->options         = new stdClass();
    $q->options->answers = [
        ['answer' => 'Galileo', 'fraction' => 1, 'feedback' => '', 'feedbackformat' => FORMAT_HTML],
    ];
    question_bank::get_qtype('shortanswer')->save_question($q, $q);
    cli_writeln("Pregunta creada: P03 shortanswer");
}

// Ensayo
if (!ges_question_exists('P04 - Ensayo', $qcategory->id)) {
    $q = new stdClass();
    $q->category        = $qcategory->id;
    $q->qtype           = 'essay';
    $q->name            = 'P04 - Ensayo';
    $q->questiontext    = 'P04 - Explica brevemente qué es la inteligencia artificial.';
    $q->questiontextformat = FORMAT_HTML;
    $q->generalfeedback = '';
    $q->generalfeedbackformat = FORMAT_HTML;
    $q->defaultmark     = 5;
    $q->penalty         = 0;
    $q->hidden          = 0;
    $q->idnumber        = null;
    $q->options         = new stdClass();
    $q->options->responseformat = 'editor';
    $q->options->responserequired = 1;
    $q->options->responsefieldlines = 10;
    question_bank::get_qtype('essay')->save_question($q, $q);
    cli_writeln("Pregunta creada: P04 essay");
}

cli_writeln('Seed completado exitosamente.');
