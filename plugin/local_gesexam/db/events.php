<?php
defined('MOODLE_INTERNAL') || die();

$observers = [
    [
        'eventname'   => '\mod_quiz\event\attempt_submitted',
        'callback'    => '\local_gesexam\observer::attempt_submitted',
        'includefile' => null,
        'internal'    => false,
        'priority'    => 200,
    ],
];
