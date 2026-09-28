---
name: azure-devops-viewer
description: Permite inspeccionar proyectos, repositorios, pull requests y work items en Azure DevOps usando la CLI o la API.
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: azure-devops
---

## What I do

- Listar proyectos de la organización de Azure DevOps configurada.
- Inspeccionar la estructura de repositorios, ramas y estado de pipelines.
- Ver detalles de Work Items (tareas, bugs, historias de usuario) asignados o específicos.
- Monitorear y listar Pull Requests (PRs) activos.

## When to use me

Utilízame cuando el usuario pida "ver el proyecto de Azure DevOps", revisar el estado de un tablero, listar tareas pendientes o auditar repositorios vinculados a la organización.

## How to do it

1. Asegúrate de tener instalada la CLI de Azure (`az`) junto con la extensión `azure-devops`.
2. Valida que las variables de entorno `AZURE_DEVOPS_EXT_PAT` (Personal Access Token) y la organización por defecto estén configuradas, o pídelas discretamente si no existen.
3. Ejecuta los comandos correspondientes según la solicitud del usuario:
   - **Listar proyectos:** `az devops project list --output table`
   - **Listar repositorios:** `az repos list --project <nombre_proyecto> --output table`
   - **Listar Work Items:** `az boards work-item query --wiql "SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.TeamProject] = '<proyecto>' AND [System.State] = 'Active'"`
4. Sintetiza la información en un formato limpio, estructurado y legible en la terminal.
