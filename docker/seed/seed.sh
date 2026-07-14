#!/bin/bash
set -e

MOODLE_DIR="/var/www/html"
PHP="php"

echo "=== GES Seed: iniciando ==="

# Moodle ya está instalado (el seed container arranca solo cuando moodle está healthy)
# Verificar que config.php exista y que la DB esté lista
until $PHP "${MOODLE_DIR}/admin/cli/check_database_schema.php" --quiet 2>/dev/null; do
    echo "Esperando que el esquema de Moodle esté listo..."
    sleep 10
done

echo "=== Moodle listo. Ejecutando seed ==="
$PHP /seed/seed.php

echo "=== Seed completado ==="
