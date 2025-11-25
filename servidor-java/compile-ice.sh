#!/bin/bash
# Script para compilar archivos .ice a Java

echo "Compilando archivos Ice..."

# Verificar que slice2java esté disponible
if ! command -v slice2java &> /dev/null; then
    echo "ERROR: slice2java no encontrado en PATH"
    echo "Por favor, instala ZeroC Ice y agrega slice2java a tu PATH"
    echo "Descarga desde: https://zeroc.com/downloads/ice"
    exit 1
fi

# Directorios
SLICE_DIR="src/main/slice"
OUTPUT_DIR="src/main/generated"

# Crear directorio de salida si no existe
mkdir -p "$OUTPUT_DIR"

# Compilar cada archivo .ice
for ice_file in "$SLICE_DIR"/*.ice; do
    if [ -f "$ice_file" ]; then
        echo "Compilando: $ice_file"
        slice2java --output-dir "$OUTPUT_DIR" "$ice_file"
        if [ $? -eq 0 ]; then
            echo "✓ Compilado exitosamente: $ice_file"
        else
            echo "✗ Error compilando: $ice_file"
            exit 1
        fi
    fi
done

echo "Compilación de Ice completada!"
echo "Los archivos generados están en: $OUTPUT_DIR"

