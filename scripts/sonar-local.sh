#!/usr/bin/env bash
# Levanta un SonarQube Server local, genera la cobertura LCOV y analiza el
# proyecto. Equivale al análisis de SonarCloud del CI, pero contra
# http://localhost:9000.
#
# Uso (desde cualquier carpeta, en Git Bash, Linux o macOS):
#   bash scripts/sonar-local.sh
#
# Variables opcionales:
#   SONAR_HOST_URL   URL del servidor (por defecto http://localhost:9000)
#   SONAR_TOKEN      token de análisis; si falta se intenta crear uno con
#                    SONAR_ADMIN_USER / SONAR_ADMIN_PASSWORD (admin/admin
#                    mientras no cambies la clave inicial en la web).
#   SONAR_PROJECT_KEY  clave del proyecto local (por defecto ClicHogar-local)
#   SONAR_SKIP_TESTS=1  reutiliza la cobertura ya generada
#
# Requisitos: Docker (con Compose), Bun y Node (para `npx @sonar/scan`).
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

HOST="${SONAR_HOST_URL:-http://localhost:9000}"
CLAVE="${SONAR_PROJECT_KEY:-ClicHogar-local}"
COMPOSE="docker compose -f docker-compose.sonarqube.yml"

for cmd in docker bun npx curl; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "Falta '$cmd' en el PATH." >&2
    exit 1
  }
done

echo "==> Levantando SonarQube (la primera vez descarga la imagen, ~1 GB)..."
$COMPOSE up -d

echo "==> Esperando a que el servidor esté listo en $HOST ..."
for _ in $(seq 1 90); do
  if curl -fsS "$HOST/api/system/status" 2>/dev/null | grep -q '"status":"UP"'; then
    LISTO=1
    break
  fi
  sleep 4
done
[ "${LISTO:-0}" = "1" ] || {
  echo "SonarQube no arrancó a tiempo. Revisa: $COMPOSE logs sonarqube" >&2
  exit 1
}

if [ -z "${SONAR_TOKEN:-}" ]; then
  echo "==> Creando un token de análisis..."
  USUARIO="${SONAR_ADMIN_USER:-admin}"
  CLAVE_ADMIN="${SONAR_ADMIN_PASSWORD:-admin}"
  RESPUESTA="$(curl -fsS -u "$USUARIO:$CLAVE_ADMIN" -X POST \
    "$HOST/api/user_tokens/generate" \
    -d "name=clichogar-local-$(date +%s)" 2>/dev/null || true)"
  SONAR_TOKEN="$(printf '%s' "$RESPUESTA" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"
  if [ -z "$SONAR_TOKEN" ]; then
    echo "No se pudo crear el token automáticamente." >&2
    echo "Entra a $HOST, cambia la clave inicial, genera un token en" >&2
    echo "My Account > Security y ejecuta:" >&2
    echo "  SONAR_TOKEN=<token> bash scripts/sonar-local.sh" >&2
    exit 1
  fi
fi

if [ "${SONAR_SKIP_TESTS:-0}" != "1" ]; then
  echo "==> Generando cobertura LCOV (frontend y backend)..."
  for paquete in frontend backend; do
    (cd "$paquete" && bun install --frozen-lockfile >/dev/null 2>&1 || bun install >/dev/null 2>&1)
    (cd "$paquete" && bun test --coverage --coverage-reporter=lcov)
    # Bun escribe `SF:` relativo al paquete; Sonar lo resuelve desde la raíz.
    sed -i.bak "s|^SF:|SF:$paquete/|" "$paquete/coverage/lcov.info"
    rm -f "$paquete/coverage/lcov.info.bak"
  done
fi

# `sonar.organization` solo existe en SonarCloud: se quita para el servidor local.
PROPIEDADES="$(mktemp)"
trap 'rm -f "$PROPIEDADES"' EXIT
grep -vE '^(sonar\.organization|sonar\.projectKey)=' sonar-project.properties >"$PROPIEDADES"

echo "==> Analizando con el scanner..."
npx --yes @sonar/scan \
  -Dproject.settings="$PROPIEDADES" \
  -Dsonar.projectKey="$CLAVE" \
  -Dsonar.host.url="$HOST" \
  -Dsonar.token="$SONAR_TOKEN"

echo
echo "Listo. Abre el panel: $HOST/dashboard?id=$CLAVE"
echo "Para detener el servidor:  $COMPOSE down   (añade -v para borrar los datos)"
