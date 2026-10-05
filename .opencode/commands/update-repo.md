---
description: Sube los cambios de la última especificación (spec) al repositorio en GitHub
agent: build
---
Analiza los cambios realizados según la última especificación (spec) en la que trabajamos. Luego, utiliza las herramientas del MCP de GitHub para realizar lo siguiente:

1. Agrega todos los archivos modificados o nuevos (incluyendo el .gitignore en caso de tener cambios).
2. Genera un mensaje de commit descriptivo y conciso que explique exactamente qué se implementó o resolvió basado en esa última spec.
3. Haz el commit con el mensaje generado.
4. Haz push de los cambios a la rama actual.