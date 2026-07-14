<?php
defined('MOODLE_INTERNAL') || die();

if ($hassiteconfig) {
    $settings = new admin_settingpage('local_gesexam', get_string('pluginname', 'local_gesexam'));
    $ADMIN->add('localplugins', $settings);

    // ── Cambio 1: sugerencia IA para ensayo ──────────────────────────────────
    $settings->add(new admin_setting_heading(
        'local_gesexam/heading_ai',
        get_string('heading_ai', 'local_gesexam'),
        ''
    ));

    $settings->add(new admin_setting_configpasswordunmask(
        'local_gesexam/claude_apikey',
        get_string('claude_apikey', 'local_gesexam'),
        get_string('claude_apikey_desc', 'local_gesexam'),
        ''
    ));

    $settings->add(new admin_setting_configtext(
        'local_gesexam/claude_model',
        get_string('claude_model', 'local_gesexam'),
        get_string('claude_model_desc', 'local_gesexam'),
        'claude-haiku-4-5-20251001',
        PARAM_TEXT
    ));

    // ── Cambio 3: endpoint externo ────────────────────────────────────────────
    $settings->add(new admin_setting_heading(
        'local_gesexam/heading_webhook',
        get_string('heading_webhook', 'local_gesexam'),
        ''
    ));

    $settings->add(new admin_setting_configtext(
        'local_gesexam/webhook_url',
        get_string('webhook_url', 'local_gesexam'),
        get_string('webhook_url_desc', 'local_gesexam'),
        'http://localhost:3001/webhook',
        PARAM_URL
    ));

    // ── Cambio 4: penalización por gracia ─────────────────────────────────────
    $settings->add(new admin_setting_heading(
        'local_gesexam/heading_grace',
        get_string('heading_grace', 'local_gesexam'),
        ''
    ));

    $settings->add(new admin_setting_configtext(
        'local_gesexam/grace_penalty',
        get_string('grace_penalty', 'local_gesexam'),
        get_string('grace_penalty_desc', 'local_gesexam'),
        '10',
        PARAM_INT
    ));
}
