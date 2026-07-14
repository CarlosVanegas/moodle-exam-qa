<?php
defined('MOODLE_INTERNAL') || die();

if ($hassiteconfig) {
    $settings = new admin_settingpage('local_gesexam', get_string('pluginname', 'local_gesexam'));
    $ADMIN->add('localplugins', $settings);

    // Cambio 3: endpoint externo
    $settings->add(new admin_setting_configtext(
        'local_gesexam/webhook_url',
        get_string('webhook_url', 'local_gesexam'),
        get_string('webhook_url_desc', 'local_gesexam'),
        'http://localhost:3001/webhook',
        PARAM_URL
    ));

    // Cambio 4: porcentaje de penalización por gracia
    $settings->add(new admin_setting_configtext(
        'local_gesexam/grace_penalty',
        get_string('grace_penalty', 'local_gesexam'),
        get_string('grace_penalty_desc', 'local_gesexam'),
        '10',
        PARAM_INT
    ));
}
