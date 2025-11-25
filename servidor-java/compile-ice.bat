@echo off
REM Script para compilar archivos .ice a Java (Windows)

echo Compilando archivos Ice...

REM Verificar que slice2java esté disponible
where slice2java >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: slice2java no encontrado en PATH
    echo Por favor, instala ZeroC Ice y agrega slice2java a tu PATH
    echo Descarga desde: https://zeroc.com/downloads/ice
    exit /b 1
)

REM Directorios
set SLICE_DIR=src\main\slice
set OUTPUT_DIR=src\main\generated

REM Crear directorio de salida si no existe
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

REM Compilar cada archivo .ice
for %%f in ("%SLICE_DIR%\*.ice") do (
    if exist "%%f" (
        echo Compilando: %%f
        slice2java --output-dir "%OUTPUT_DIR%" "%%f"
        if %ERRORLEVEL% EQU 0 (
            echo Compilado exitosamente: %%f
        ) else (
            echo Error compilando: %%f
            exit /b 1
        )
    )
)

echo Compilacion de Ice completada!
echo Los archivos generados estan en: %OUTPUT_DIR%

