<?php
defined('MOODLE_INTERNAL') || die();

$functions = [
    // Cambio 2: registrar pérdida de foco
    'local_gesexam_record_focus_loss' => [
        'classname'     => '\local_gesexam\external',
        'methodname'    => 'record_focus_loss',
        'description'   => 'Registra una pérdida de foco durante un intento de examen.',
        'type'          => 'write',
        'ajax'          => true,
        'loginrequired' => true,
    ],

    // Cambio 1: obtener sugerencia de calificación de IA para respuesta de ensayo
    'local_gesexam_get_essay_suggestion' => [
        'classname'     => '\local_gesexam\external',
        'methodname'    => 'get_essay_suggestion',
        'description'   => 'Devuelve nota sugerida y feedback generados por IA para una respuesta de ensayo.',
        'type'          => 'read',
        'ajax'          => true,
        'loginrequired' => true,
    ],
];
