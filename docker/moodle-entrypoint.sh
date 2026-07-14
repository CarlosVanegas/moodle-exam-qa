#!/bin/bash
set -e

MOODLE_ROOT="/var/www/html"
MOODLE_DATA="/var/moodledata"

# ── Paso 1: copiar el código de Moodle al volumen compartido (solo primera vez)
if [ ! -f "${MOODLE_ROOT}/version.php" ]; then
    echo "=== Copiando código Moodle al volumen... ==="
    cp -rn /moodle-src/. "${MOODLE_ROOT}/"
    chown -R www-data:www-data "${MOODLE_ROOT}" 2>/dev/null || true
    echo "=== Código copiado ==="
fi

# ── Paso 2: esperar a que el puerto 3306 de MariaDB esté aceptando conexiones
# (depends_on service_healthy ya garantiza que MariaDB está lista, pero
#  esperamos unos segundos por si acaso hay latencia de red en el bridge)
HOST="${MOODLE_DATABASE_HOST:-mariadb}"
echo "=== Verificando conectividad con MariaDB ($HOST:3306)... ==="
for i in $(seq 1 30); do
    if (echo > /dev/tcp/"$HOST"/3306) 2>/dev/null; then
        echo "=== MariaDB accesible ==="
        break
    fi
    echo "  Intento $i/30 — esperando 5s..."
    sleep 5
done

# ── Paso 3: instalar Moodle si no está configurado
if [ ! -f "${MOODLE_ROOT}/config.php" ]; then
    echo "=== Instalando Moodle (primera vez, tarda ~5 min)... ==="

    php "${MOODLE_ROOT}/admin/cli/install.php" \
        --chmod=2777 \
        --lang=en \
        --wwwroot="${MOODLE_WWWROOT:-http://localhost:8080}" \
        --dataroot="${MOODLE_DATA}" \
        --dbtype=mariadb \
        --dbhost="${MOODLE_DATABASE_HOST:-mariadb}" \
        --dbname="${MOODLE_DATABASE_NAME:-moodle}" \
        --dbuser="${MOODLE_DATABASE_USER:-moodleuser}" \
        --dbpass="${MOODLE_DATABASE_PASSWORD}" \
        --dbport=3306 \
        --fullname="${MOODLE_SITE_NAME:-GES Exam QA}" \
        --shortname=GES \
        --adminuser="${MOODLE_USERNAME:-admin}" \
        --adminpass="${MOODLE_PASSWORD}" \
        --adminemail="${MOODLE_EMAIL:-admin@galileo.edu}" \
        --non-interactive \
        --agree-license

    chown www-data:www-data "${MOODLE_ROOT}/config.php"
    echo "=== Moodle instalado exitosamente ==="
fi

echo "=== Moodle is ready ==="
exec "$@"
