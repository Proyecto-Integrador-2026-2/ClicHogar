---

### 🤝 `CONTRIBUTING.md`

```markdown
# Guía de Contribución - Clic Hogar 🚀

¡Bienvenido al equipo de desarrollo de Clic Hogar! Como un micro-equipo ágil, es indispensable mantener un estándar alto de calidad y comunicación. Por favor, lee estas directrices antes de comenzar a programar.

## Metodología de Desarrollo

La gestión de este proyecto se realiza bajo la metodología **Scrumban** (Scrum + Kanban), priorizando Sprints cortos y limitando el Trabajo en Progreso (WIP) para evitar cuellos de botella[cite: 5]. El tablero y el backlog viven en **Azure DevOps**[cite: 4, 5].

A nivel de control de versiones en GitHub, aplicamos **Trunk-Based Development**:

- Está estrictamente prohibido realizar commits directos a la rama principal (`main`).
- Crea ramas pequeñas, rápidas y descriptivas para cada tarea (ej. `feature/US-01-registro-usuario` o `fix/login-error`)[cite: 3].
- Sube tu código frecuentemente y solicita un Pull Request (PR) hacia `main`.

## Estándares de Calidad y Definition of Done (DoD)

Para que una Historia de Usuario se considere "Terminada" (Done) y el código pueda fusionarse, debe cumplir con:

1.  **Formato Uniforme:** Utilizamos `Prettier`. Asegúrate de formatear tus archivos (`.prettierrc`) antes de confirmar los cambios[cite: 4, 5].
2.  **Linting Estricto:** `ESLint` verificará la calidad del código TypeScript. No dejes variables sin usar, errores lógicos, ni console.logs olvidados (`.eslintrc.json`)[cite: 4, 5].
3.  **Análisis de Seguridad y Calidad:** Todo código enviado a `main` será analizado automáticamente por **SonarCloud**. No se aceptarán ramas que introduzcan "code smells", duplicidad o vulnerabilidades de seguridad[cite: 4, 5].
4.  **Pruebas Unitarias:** La lógica crítica del backend (Node.js) debe contar con pruebas utilizando **Jest** y **Supertest** para garantizar la resiliencia de los endpoints (ej. registro, inicio de sesión)[cite: 4, 5].

## Flujo Automatizado de Integración Continua (CI/CD)

Contamos con un robot de **GitHub Actions** (`ci.yml`) que automatiza las revisiones[cite: 3, 4].
Al crear un Pull Request, el pipeline se disparará y ejecutará:

1. Instalación del entorno (Bun).
2. Verificación de formato (Prettier) y lógica (ESLint).
3. Inspección profunda de seguridad (SonarCloud)[cite: 4, 5].

Si el robot marca algún paso en rojo, el autor del Pull Request debe corregir los errores en su rama antes de solicitar la aprobación de un compañero de equipo.
```
