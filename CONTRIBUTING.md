# Contributing to Alesport

¡Gracias por tu interés en contribuir a este proyecto! Sigue estas pautas para asegurar un flujo de trabajo ordenado y colaborativo.

## Flujo de trabajo
1. Crea una rama desde `main` siguiendo el formato:
   - `feat/nueva-funcionalidad`
   - `fix/bug-descripción`
   - `chore/tarea-mantenimiento`
2. Haz commits atómicos y descriptivos.
3. Antes de abrir un Pull Request (PR):
   - Asegúrate de que los tests pasen (`pytest backend/tests/`).
   - Revisa que no haya archivos innecesarios o temporales.
   - Describe claramente el propósito del PR y enlaza issues si corresponde.
4. Abre el PR a `main` y espera revisión.
5. No borres ramas hasta que estén mergeadas y confirmadas.

## Convenciones de código
- Usa nombres descriptivos para variables, funciones y ramas.
- Sigue el estilo PEP8 para Python.
- Comenta el código donde sea necesario para claridad.
- No subas archivos de configuración local, datos sensibles ni dependencias generadas.

## Requisitos para Pull Requests
- Tests automáticos deben pasar.
- El código debe estar revisado y probado localmente.
- Explica cualquier cambio importante en la documentación si aplica.

## Guía rápida para nuevos colaboradores
```bash
# Clona el repositorio
git clone <url>
cd alesport

# Instala dependencias y prepara entorno
python -m pip install --upgrade pip
pip install -r backend/requirements.txt

# Crea y configura tu .env siguiendo .env.example

# Corre los tests
test backend/tests/
```

¡Gracias por ayudar a mejorar Alesport!