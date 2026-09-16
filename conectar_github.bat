@echo off
title Conectar GitHub - SOMAC
color 0B
echo ================================================================
echo           CONEXION DE SOMAC CON TU CUENTA DE GITHUB
echo ================================================================
echo.
echo Se abrira una ventana en tu navegador para autorizar a GitHub.
echo Solo tienes que dar clic en "Authorize" o iniciar sesion.
echo.
set "PATH=%LOCALAPPDATA%\Programs\Git\cmd;%PATH%"
cd /d "c:\Users\U454118\.gemini\somac"
git push origin main
echo.
if %ERRORLEVEL% EQU 0 (
    color 0A
    echo ================================================================
    echo  LISTO! Tus credenciales se han guardado con exito.
    echo  A partir de ahora todos los cambios se subiran automaticamente.
    echo ================================================================
) else (
    color 0C
    echo ================================================================
    echo  Hubo un inconveniente al conectar.
    echo ================================================================
)
echo.
pause
