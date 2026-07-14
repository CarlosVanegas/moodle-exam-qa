<?php
/**
 * Seed reproducible: crea usuarios, curso, banco de preguntas (6 tipos) y examen con timer.
 * Se ejecuta una sola vez después del primer boot de Moodle.
 */
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->libdir . '/clilib.php');

// Suprimir envío de email en CLI (sendmail no disponible en contenedor)
$CFG->noemailever = true;

cli_heading('GES Exam QA — Seed de datos');

// Necesario para que question_bank y quiz_grade_item_update funcionen en CLI
$USER = get_admin();

// ── 1. Usuarios ──────────────────────────────────────────────────────────────

function ges_create_user(string $username, string $password, string $firstname, string $lastname, string $email): int {
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

$teacher_id = ges_create_user('profesor01',   'Profesor1234!',   'Profesor',   'GES', 'profesor@galileo.edu');
$student_id = ges_create_user('estudiante01', 'Estudiante1234!', 'Estudiante', 'GES', 'estudiante@galileo.edu');

// ── 2. Curso ──────────────────────────────────────────────────────────────────

require_once($CFG->dirroot . '/course/lib.php');

$course_shortname = 'QA-GES-001';
if ($DB->record_exists('course', ['shortname' => $course_shortname])) {
    $course = $DB->get_record('course', ['shortname' => $course_shortname]);
    cli_writeln("Curso ya existe: $course_shortname");
} else {
    $coursedata            = new stdClass();
    $coursedata->fullname  = 'Curso de Prueba QA';
    $coursedata->shortname = $course_shortname;
    $coursedata->category  = 1;
    $coursedata->visible   = 1;
    $course = create_course($coursedata);
    cli_writeln("Curso creado: id={$course->id}");
}

$context = context_course::instance($course->id);

function ges_enrol_user(int $userid, stdClass $course, string $rolename): void {
    global $DB;
    $role     = $DB->get_record('role', ['shortname' => $rolename], '*', MUST_EXIST);
    $enrol    = enrol_get_plugin('manual');
    $instance = $DB->get_record('enrol', ['courseid' => $course->id, 'enrol' => 'manual']);
    if (!$instance) {
        cli_writeln("No hay instancia manual de enrol en curso {$course->id}");
        return;
    }
    $enrol->enrol_user($instance, $userid, $role->id);
    cli_writeln("Usuario $userid inscrito como $rolename en curso {$course->id}");
}

ges_enrol_user($teacher_id, $course, 'editingteacher');
ges_enrol_user($student_id, $course, 'student');

// ── 3. Banco de preguntas ─────────────────────────────────────────────────────

require_once($CFG->dirroot . '/question/engine/lib.php');
require_once($CFG->libdir . '/questionlib.php');

// Obtener o crear categoría por defecto para el curso
$qcategory = $DB->get_record('question_categories', ['contextid' => $context->id, 'parent' => 0]);
if (!$qcategory) {
    $qcategory = new stdClass();
    $qcategory->name        = 'Default for ' . $course->shortname;
    $qcategory->contextid   = $context->id;
    $qcategory->info        = '';
    $qcategory->infoformat  = FORMAT_HTML;
    $qcategory->parent      = 0;
    $qcategory->sortorder   = 999;
    $qcategory->stamp       = make_unique_id_code();
    $qcategory->id          = $DB->insert_record('question_categories', $qcategory);
    cli_writeln("Categoría de preguntas creada: id={$qcategory->id}");
} else {
    cli_writeln("Categoría de preguntas ya existe: id={$qcategory->id}");
}

// ── Helpers para insertar preguntas directamente en Moodle 4.x ───────────────
// En Moodle 4.x la tabla question ya NO tiene columna category; está en
// question_bank_entries. Insertamos directamente para evitar problemas con
// save_question() que espera datos de formulario web.

function ges_question_exists(string $name, int $categoryid): bool {
    global $DB;
    return $DB->record_exists_sql(
        "SELECT 1
           FROM {question} q
           JOIN {question_versions} qv     ON qv.questionid = q.id
           JOIN {question_bank_entries} qbe ON qbe.id = qv.questionbankentryid
          WHERE q.name = :name AND qbe.questioncategoryid = :catid",
        ['name' => $name, 'catid' => $categoryid]
    );
}

function ges_insert_question(string $name, string $qtype, string $text,
                              int $categoryid, float $defaultmark = 1.0,
                              float $penalty = 0): stdClass {
    global $DB, $USER;

    $qbe = new stdClass();
    $qbe->questioncategoryid = $categoryid;
    $qbe->idnumber           = null;
    $qbe->ownerid            = $USER->id;
    $qbe->id = $DB->insert_record('question_bank_entries', $qbe);

    $q = new stdClass();
    $q->parent               = 0;
    $q->name                 = $name;
    $q->questiontext         = $text;
    $q->questiontextformat   = FORMAT_HTML;
    $q->generalfeedback      = '';
    $q->generalfeedbackformat = FORMAT_HTML;
    $q->defaultmark          = $defaultmark;
    $q->penalty              = $penalty;
    $q->qtype                = $qtype;
    $q->length               = 1;
    $q->stamp                = make_unique_id_code();
    $q->timecreated          = time();
    $q->timemodified         = time();
    $q->createdby            = $USER->id;
    $q->modifiedby           = $USER->id;
    $q->id = $DB->insert_record('question', $q);

    $qv = new stdClass();
    $qv->questionbankentryid = $qbe->id;
    $qv->version             = 1;
    $qv->questionid          = $q->id;
    $qv->status              = 'ready';
    $DB->insert_record('question_versions', $qv);

    $q->questionbankentryid = $qbe->id;
    return $q;
}

function ges_insert_answer(int $questionid, string $text, float $fraction): int {
    global $DB;
    $a = new stdClass();
    $a->question      = $questionid;
    $a->answer        = $text;
    $a->answerformat  = FORMAT_HTML;
    $a->fraction      = $fraction;
    $a->feedback      = '';
    $a->feedbackformat = FORMAT_HTML;
    return (int) $DB->insert_record('question_answers', $a);
}

// P01 — Opción múltiple
if (!ges_question_exists('P01 - Opción múltiple', $qcategory->id)) {
    $q = ges_insert_question('P01 - Opción múltiple', 'multichoice',
        '¿Cuál es el resultado de 2 + 2?', $qcategory->id);
    ges_insert_answer($q->id, '4',  1.0);
    ges_insert_answer($q->id, '3',  0.0);
    ges_insert_answer($q->id, '22', 0.0);
    $opts = new stdClass();
    $opts->questionid = $q->id;
    $opts->single = 1; $opts->shuffleanswers = 1; $opts->answernumbering = 'abc';
    $opts->showstandardinstruction = 0; $opts->shownumcorrect = 0;
    $opts->correctfeedback = ''; $opts->correctfeedbackformat = FORMAT_HTML;
    $opts->partiallycorrectfeedback = ''; $opts->partiallycorrectfeedbackformat = FORMAT_HTML;
    $opts->incorrectfeedback = ''; $opts->incorrectfeedbackformat = FORMAT_HTML;
    $DB->insert_record('qtype_multichoice_options', $opts);
    cli_writeln("Pregunta creada: P01 multichoice");
}

// P02 — Verdadero / Falso
if (!ges_question_exists('P02 - Verdadero o Falso', $qcategory->id)) {
    $q = ges_insert_question('P02 - Verdadero o Falso', 'truefalse',
        'La Tierra orbita alrededor del Sol.', $qcategory->id, 1.0, 1.0);
    $trueid  = ges_insert_answer($q->id, 'True',  1.0);
    $falseid = ges_insert_answer($q->id, 'False', 0.0);
    $opts = new stdClass();
    $opts->question    = $q->id;
    $opts->trueanswer  = $trueid;
    $opts->falseanswer = $falseid;
    $DB->insert_record('question_truefalse', $opts);
    cli_writeln("Pregunta creada: P02 truefalse");
}

// P03 — Respuesta corta
if (!ges_question_exists('P03 - Respuesta corta', $qcategory->id)) {
    $q = ges_insert_question('P03 - Respuesta corta', 'shortanswer',
        'Escribe el nombre de la universidad: G_____o', $qcategory->id);
    ges_insert_answer($q->id, 'Galileo', 1.0);
    $opts = new stdClass();
    $opts->questionid = $q->id;
    $opts->usecase = 0;
    $DB->insert_record('qtype_shortanswer_options', $opts);
    cli_writeln("Pregunta creada: P03 shortanswer");
}

// P04 — Ensayo (calificación manual, necesario para Cambio 1)
if (!ges_question_exists('P04 - Ensayo', $qcategory->id)) {
    $q = ges_insert_question('P04 - Ensayo', 'essay',
        'Explica brevemente qué es la inteligencia artificial y menciona dos aplicaciones prácticas.',
        $qcategory->id, 5.0);
    $opts = new stdClass();
    $opts->questionid = $q->id;
    $opts->responseformat = 'editor'; $opts->responserequired = 1;
    $opts->responsefieldlines = 10; $opts->minwordlimit = null; $opts->maxwordlimit = null;
    $opts->attachments = 0; $opts->attachmentsrequired = 0; $opts->filetypeslist = null;
    $opts->graderinfo = ''; $opts->graderinfoformat = FORMAT_HTML;
    $opts->responsetemplate = ''; $opts->responsetemplateformat = FORMAT_HTML;
    $DB->insert_record('qtype_essay_options', $opts);
    cli_writeln("Pregunta creada: P04 essay");
}

// P05 — Numérica
if (!ges_question_exists('P05 - Numérica', $qcategory->id)) {
    $q = ges_insert_question('P05 - Numérica', 'numerical',
        '¿Cuántos días tiene una semana?', $qcategory->id);
    $ansid = ges_insert_answer($q->id, '7', 1.0);
    $num = new stdClass();
    $num->question  = $q->id; $num->answer = $ansid; $num->tolerance = 0;
    $DB->insert_record('question_numerical', $num);
    $opts = new stdClass();
    $opts->question = $q->id; $opts->showunits = 3;
    $opts->unitsleft = 0; $opts->unitgradingtype = 0; $opts->unitpenalty = 0.1;
    $DB->insert_record('question_numerical_options', $opts);
    cli_writeln("Pregunta creada: P05 numerical");
}

// P06 — Emparejamiento (Matching)
if (!ges_question_exists('P06 - Emparejamiento', $qcategory->id)) {
    $q = ges_insert_question('P06 - Emparejamiento', 'match',
        'Empareja cada país con su capital.', $qcategory->id);
    $opts = new stdClass();
    $opts->questionid = $q->id; $opts->shuffleanswers = 1; $opts->shownumcorrect = 0;
    $opts->correctfeedback = ''; $opts->correctfeedbackformat = FORMAT_HTML;
    $opts->partiallycorrectfeedback = ''; $opts->partiallycorrectfeedbackformat = FORMAT_HTML;
    $opts->incorrectfeedback = ''; $opts->incorrectfeedbackformat = FORMAT_HTML;
    $DB->insert_record('qtype_match_options', $opts);
    foreach ([['Francia','París'],['España','Madrid'],['Italia','Roma'],['','Lisboa']] as [$stem,$ans]) {
        $sub = new stdClass();
        $sub->questionid = $q->id;
        $sub->questiontext = $stem; $sub->questiontextformat = FORMAT_HTML;
        $sub->answertext = $ans;
        $DB->insert_record('qtype_match_subquestions', $sub);
    }
    cli_writeln("Pregunta creada: P06 match");
}

// ── 4. Examen (Quiz) con timer ────────────────────────────────────────────────

require_once($CFG->dirroot . '/mod/quiz/lib.php');
require_once($CFG->dirroot . '/mod/quiz/locallib.php');
require_once($CFG->libdir  . '/gradelib.php');

if ($DB->record_exists('quiz', ['course' => $course->id, 'name' => 'Examen QA'])) {
    cli_writeln("Quiz 'Examen QA' ya existe.");
    $quizdata = $DB->get_record('quiz', ['course' => $course->id, 'name' => 'Examen QA'], '*', MUST_EXIST);
    $module_id = $DB->get_field('modules', 'id', ['name' => 'quiz'], MUST_EXIST);
    $cm_rec = $DB->get_record('course_modules',
        ['course' => $course->id, 'module' => $module_id, 'instance' => $quizdata->id], '*', MUST_EXIST);
} else {
    $quizdata = new stdClass();
    $quizdata->course          = $course->id;
    $quizdata->name            = 'Examen QA';
    $quizdata->intro           = '<p>Examen de prueba QA automatizado — GES Universidad Galileo.</p>';
    $quizdata->introformat     = FORMAT_HTML;
    $quizdata->timeopen        = 0;
    $quizdata->timeclose       = 0;
    $quizdata->timelimit       = 600;          // 10 minutos
    $quizdata->overduehandling = 'graceperiod';
    $quizdata->graceperiod     = 120;          // 2 minutos de gracia (Cambio 4)
    $quizdata->preferredbehaviour = 'deferredfeedback';
    $quizdata->canredoquestions = 0;
    $quizdata->attempts        = 0;            // ilimitados
    $quizdata->attemptonlast   = 0;
    $quizdata->grademethod     = QUIZ_GRADEHIGHEST;
    $quizdata->decimalpoints   = 2;
    $quizdata->questiondecimalpoints = -1;
    // Opciones de revisión: mostrar todo en revisión post-intento
    $quizdata->reviewattempt          = 69904;
    $quizdata->reviewcorrectness      = 4368;
    $quizdata->reviewmarks            = 4368;
    $quizdata->reviewspecificfeedback = 4368;
    $quizdata->reviewgeneralfeedback  = 4368;
    $quizdata->reviewrightanswer      = 4368;
    $quizdata->reviewoverallfeedback  = 4368;
    $quizdata->questionsperpage = 0;           // todas en una sola página
    $quizdata->navmethod       = 'free';
    $quizdata->shuffleanswers  = 1;
    $quizdata->sumgrades       = 0;
    $quizdata->grade           = 10;
    $quizdata->timecreated     = time();
    $quizdata->timemodified    = time();
    $quizdata->password        = '';
    $quizdata->subnet          = '';
    $quizdata->browsersecurity = '-';
    $quizdata->delay1          = 0;
    $quizdata->delay2          = 0;
    $quizdata->showuserpicture = 0;
    $quizdata->showblocks      = 0;
    $quizdata->completionattemptsexhausted = 0;
    $quizdata->completionminattempts = 0;

    // Insertar quiz directamente (sin el formulario, válido en CLI)
    $quizdata->id = $DB->insert_record('quiz', $quizdata);

    // Crear registro course_modules
    // section en course_modules es el ID de la fila en course_sections, no el número de sección
    $section = $DB->get_record('course_sections', ['course' => $course->id, 'section' => 0], '*', MUST_EXIST);
    $module_id = $DB->get_field('modules', 'id', ['name' => 'quiz'], MUST_EXIST);
    $cm_rec = new stdClass();
    $cm_rec->course   = $course->id;
    $cm_rec->module   = $module_id;
    $cm_rec->instance = $quizdata->id;
    $cm_rec->section  = $section->id;  // ID de la fila, no número de sección
    $cm_rec->visible  = 1;
    $cm_rec->added    = time();
    $cm_rec->id       = $DB->insert_record('course_modules', $cm_rec);

    // Vincular coursemodule en quiz
    $DB->set_field('quiz', 'coursemodule', $cm_rec->id, ['id' => $quizdata->id]);
    $quizdata->coursemodule = $cm_rec->id;
    $quizdata->cmid         = $cm_rec->id;

    // Añadir cm a la sección 0 del curso
    $seq = trim((string)$section->sequence);
    $section->sequence = $seq !== '' ? $seq . ',' . $cm_rec->id : (string)$cm_rec->id;
    $DB->update_record('course_sections', $section);

    // Crear grade item del quiz
    quiz_grade_item_update($quizdata);

    // Limpiar caché del curso
    rebuild_course_cache($course->id, true);

    cli_writeln("Quiz creado: 'Examen QA' (quiz_id={$quizdata->id}, cmid={$cm_rec->id})");
}

// ── Agregar preguntas al quiz si aún no tiene slots ──────────────────────────

if ($DB->count_records('quiz_slots', ['quizid' => $quizdata->id]) === 0) {
    $question_names = [
        'P01 - Opción múltiple',
        'P02 - Verdadero o Falso',
        'P03 - Respuesta corta',
        'P04 - Ensayo',
        'P05 - Numérica',
        'P06 - Emparejamiento',
    ];

    // Verificar si existe question_versions (Moodle 4.x)
    $has_qversions = $DB->get_manager()->table_exists('question_versions');

    $slot_num = 1;
    foreach ($question_names as $qname) {
        $question = $DB->get_record_sql(
            "SELECT q.*
               FROM {question} q
               JOIN {question_versions} qv     ON qv.questionid = q.id
               JOIN {question_bank_entries} qbe ON qbe.id = qv.questionbankentryid
              WHERE q.name = :name AND qbe.questioncategoryid = :catid",
            ['name' => $qname, 'catid' => $qcategory->id]
        );
        if (!$question) {
            cli_writeln("WARN: pregunta '$qname' no encontrada — se omite");
            continue;
        }

        // Crear slot
        $slot = new stdClass();
        $slot->quizid          = $quizdata->id;
        $slot->slot            = $slot_num;
        $slot->page            = 1;
        $slot->requireprevious = 0;
        $slot->maxmark         = (float)$question->defaultmark;

        // displaynumber existe desde Moodle 4.2
        if ($DB->get_manager()->field_exists('quiz_slots', 'displaynumber')) {
            $slot->displaynumber = null;
        }

        $slot->id = $DB->insert_record('quiz_slots', $slot);

        if ($has_qversions) {
            // Moodle 4.x: vincular vía question_references
            $qversion = $DB->get_record('question_versions', ['questionid' => $question->id]);
            if (!$qversion) {
                cli_writeln("WARN: sin question_versions para '$qname'");
                $slot_num++;
                continue;
            }

            $ctx = context_module::instance($cm_rec->id);
            $qref = new stdClass();
            $qref->usingcontextid      = $ctx->id;
            $qref->component           = 'mod_quiz';
            $qref->questionarea        = 'slot';
            $qref->itemid              = $slot->id;
            $qref->questionbankentryid = $qversion->questionbankentryid;
            $qref->version             = null; // siempre la última versión
            $DB->insert_record('question_references', $qref);
        } else {
            // Moodle 3.x fallback: questionid directo en slot
            $DB->set_field('quiz_slots', 'questionid', $question->id, ['id' => $slot->id]);
        }

        cli_writeln("Pregunta '$qname' agregada al quiz (slot $slot_num)");
        $slot_num++;
    }

} else {
    cli_writeln("Slots del quiz ya existen (" .
        $DB->count_records('quiz_slots', ['quizid' => $quizdata->id]) . " slots).");
}

// Siempre sincronizar sumgrades con la suma real de los slots
$sumgrades = (float)($DB->get_field_sql(
    'SELECT SUM(maxmark) FROM {quiz_slots} WHERE quizid = ?', [$quizdata->id]) ?: 0);
$DB->set_field('quiz', 'sumgrades', $sumgrades, ['id' => $quizdata->id]);
cli_writeln("Quiz sumgrades = $sumgrades");

// ── 5. Configuración del plugin GES (valores por defecto) ────────────────────

set_config('webhook_url',   'http://webhook-receiver:3001/webhook', 'local_gesexam');
set_config('grace_penalty', '10',                                   'local_gesexam');
cli_writeln("Config del plugin local_gesexam establecida.");

// Moodle fuerza cookiesecure=1 en producción, pero el entorno QA corre en HTTP.
// Sin esto, el navegador descarta las cookies de sesión y el login siempre falla.
set_config('cookiesecure', '0');
cli_writeln("cookiesecure=0 (HTTP QA env).");

// Deshabilitar tours de usuario para QA headless (no bloquean interacciones)
$DB->execute("UPDATE {tool_usertours_tours} SET enabled = 0");
$DB->execute("DELETE FROM {user_preferences} WHERE name LIKE 'tool_usertours%'");
cli_writeln("User tours deshabilitados.");

cli_writeln('');
cli_writeln('=== Seed completado exitosamente ===');
cli_writeln('  Curso: Curso de Prueba QA  (shortname: QA-GES-001)');
cli_writeln('  Preguntas: P01-P06 en banco de preguntas');
cli_writeln('  Examen: "Examen QA" — timer 10 min, gracia 2 min, intentos ilimitados');
cli_writeln('  Usuarios: profesor01 / estudiante01');
