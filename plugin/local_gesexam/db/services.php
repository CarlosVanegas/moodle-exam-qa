<?php
defined('MOODLE_INTERNAL') || die();

$functions = [
    'local_gesexam_record_focus_loss' => [
        'classname'     => '\local_gesexam\external',
        'methodname'    => 'record_focus_loss',
        'description'   => 'Registra una pérdida de foco durante un intento de examen.',
        'type'          => 'write',
        'ajax'          => true,
        'loginrequired' => true,
    ],
];
