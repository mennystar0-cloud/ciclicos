@echo off
cd /d "%~dp0"

echo.
echo ==========================================
echo   CONTEO CICLICO PRO - DEPLOY A RAILWAY
echo ==========================================
echo.

set /p mensaje="Descripcion del cambio (Enter para usar 'update'): "
if "%mensaje%"=="" set mensaje=update

echo.
echo Subiendo cambios...
git add .
git commit -m "%mensaje%"
git push

echo.
echo ==========================================
if %errorlevel%==0 (
    echo   LISTO! Railway actualizara en 2-3 min
) else (
    echo   ERROR - Revisa la conexion o los archivos
)
echo ==========================================
echo.
pause
