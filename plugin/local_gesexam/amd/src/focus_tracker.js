// AMD module — Cambio 2: rastreo de pérdida de foco durante intento de examen
define(['core/ajax', 'core/log'], function(Ajax, Log) {

    let attemptId = null;

    function recordFocusLoss() {
        if (!attemptId) return;

        Ajax.call([{
            methodname: 'local_gesexam_record_focus_loss',
            args: { attemptid: attemptId },
            done: function() {
                Log.debug('GES FocusTracker: pérdida de foco registrada para intento ' + attemptId);
            },
            fail: function(err) {
                Log.warn('GES FocusTracker: error registrando foco', err);
            }
        }]);
    }

    return {
        init: function(aid) {
            attemptId = aid;

            // Cambio de pestaña / visibilidad
            document.addEventListener('visibilitychange', function() {
                if (document.hidden) {
                    recordFocusLoss();
                }
            });

            // Cambio a otra ventana (blur en el objeto window)
            window.addEventListener('blur', function() {
                recordFocusLoss();
            });

            Log.debug('GES FocusTracker: iniciado para intento ' + attemptId);
        }
    };
});
