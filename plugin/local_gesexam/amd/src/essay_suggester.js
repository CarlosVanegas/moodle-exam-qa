// AMD module — Cambio 1: sugerencia de calificación con IA para preguntas de ensayo.
// Se inyecta en la página de calificación manual del quiz (mod/quiz/report/grading/).
define(['core/ajax', 'core/log', 'core/notification'], function(Ajax, Log, Notification) {

    /**
     * Parsea el nombre del campo de nota (e.g. "q123:s2_-mark") y retorna {attemptid, slot}.
     */
    function parseMarkField(name) {
        var m = name.match(/^q(\d+):s(\d+)_-mark$/);
        if (!m) return null;
        return { attemptid: parseInt(m[1], 10), slot: parseInt(m[2], 10) };
    }

    /**
     * Muestra el resultado de la sugerencia IA bajo el campo de nota.
     */
    function renderSuggestion(container, result, markInput) {
        var existing = container.querySelector('.ges-ai-suggestion');
        if (existing) existing.remove();

        var div = document.createElement('div');
        div.className = 'ges-ai-suggestion alert ' + (result.error ? 'alert-warning' : 'alert-info');
        div.style.marginTop = '8px';

        if (result.error) {
            div.innerHTML = '<strong>✨ Sugerencia IA</strong> &mdash; ' + escapeHtml(result.feedback);
        } else {
            div.innerHTML =
                '<strong>✨ Sugerencia de IA</strong><br>' +
                '<strong>Nota sugerida:</strong> ' + result.grade + '<br>' +
                '<strong>Retroalimentación:</strong> ' + escapeHtml(result.feedback) + '<br>' +
                '<button type="button" class="btn btn-primary btn-sm ges-apply-grade" ' +
                'style="margin-top:6px" data-grade="' + result.grade + '">Aplicar nota</button>';

            div.querySelector('.ges-apply-grade').addEventListener('click', function() {
                markInput.value = result.grade;
                markInput.dispatchEvent(new Event('change', { bubbles: true }));
            });
        }

        markInput.closest('td, div, .fitem') && markInput.closest('td, div, .fitem').appendChild(div)
            || markInput.parentNode.appendChild(div);
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * Agrega el botón "Sugerir con IA" junto al campo de nota de cada pregunta de ensayo.
     */
    function injectButtons() {
        // Los campos de nota tienen el patrón: q<attemptid>:s<slot>_-mark
        var markInputs = document.querySelectorAll('input[name*="-mark"][name^="q"]');

        markInputs.forEach(function(markInput) {
            if (markInput.dataset.gesInjected) return;
            markInput.dataset.gesInjected = '1';

            var parsed = parseMarkField(markInput.name);
            if (!parsed) return;

            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-info btn-sm ges-ai-suggest-btn';
            btn.style.cssText = 'margin: 4px 0 4px 8px; white-space: nowrap;';
            btn.textContent = '✨ Sugerir con IA';

            btn.addEventListener('click', function() {
                btn.disabled = true;
                btn.textContent = 'Consultando IA…';

                Ajax.call([{
                    methodname: 'local_gesexam_get_essay_suggestion',
                    args: { attemptid: parsed.attemptid, slot: parsed.slot },
                    done: function(result) {
                        btn.disabled = false;
                        btn.textContent = '✨ Sugerir con IA';
                        renderSuggestion(markInput.parentNode, result, markInput);
                        Log.debug('GES EssaySuggester: sugerencia recibida', result);
                    },
                    fail: function(err) {
                        btn.disabled = false;
                        btn.textContent = '✨ Sugerir con IA';
                        Log.warn('GES EssaySuggester: error', err);
                        Notification.alert('Error', err.message || 'No se pudo obtener la sugerencia de IA.');
                    }
                }]);
            });

            markInput.insertAdjacentElement('afterend', btn);
        });
    }

    return {
        init: function() {
            // Ejecutar al cargar la página
            injectButtons();

            // Re-ejecutar si hay paginación AJAX (el botón "Siguiente" en la vista de calificación)
            document.addEventListener('click', function(e) {
                if (e.target && (
                    e.target.matches('[data-action="page-link"]') ||
                    e.target.closest('.gradingform_rubric') ||
                    e.target.matches('a[href*="grading"]')
                )) {
                    setTimeout(injectButtons, 800);
                }
            });

            Log.debug('GES EssaySuggester: iniciado en ' + document.body.id);
        }
    };
});
