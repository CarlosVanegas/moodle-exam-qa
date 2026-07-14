#!/bin/bash
set -e

MOODLE_DIR="/bitnami/moodle"
PHP="php"

echo "=== GES Seed: iniciando ==="

# Esperar a que Moodle esté completamente listo
until $PHP $MOODLE_DIR/admin/cli/check_database_schema.php --quiet 2>/dev/null; do
  echo "Esperando que Moodle esté listo..."
  sleep 10
done

echo "=== Moodle listo. Ejecutando seed ==="
$PHP /seed/seed.php

echo "=== Seed completado ==="
