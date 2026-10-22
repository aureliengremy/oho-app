#!/usr/bin/env bash
# Tests d'accès de la base OhO sur un Postgres 16 jetable.
#
#   scripts/db-test.sh            (ou npm run test:db)
#
# Crée un cluster temporaire (socket Unix dans un dossier privé, aucun port TCP
# ouvert), charge le stub Supabase, les migrations dans l'ordre, le seed deux
# fois (il doit être rejouable), puis les tests. S'arrête au premier échec.
# Variables : PG_BIN (dossier des binaires Postgres), KEEP_DB=1 (garder le
# cluster pour l'inspecter, chemin affiché à la fin).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUPA="$ROOT/supabase"

PG_BIN="${PG_BIN:-}"
if [[ -z "$PG_BIN" ]]; then
  if [[ -x /usr/lib/postgresql/16/bin/initdb ]]; then
    PG_BIN=/usr/lib/postgresql/16/bin
  elif command -v pg_config >/dev/null 2>&1; then
    PG_BIN="$(pg_config --bindir)"
  else
    echo "initdb introuvable : installez Postgres 16 ou définissez PG_BIN" >&2
    exit 2
  fi
fi

TMP="$(mktemp -d "${TMPDIR:-/tmp}/oho-db-test.XXXXXX")"
DATA="$TMP/data"
# Le socket vit dans $TMP, propre à ce lancement : le port n'a qu'à ne pas
# entrer en conflit avec lui-même. On en tire un au hasard pour la lisibilité.
PORT="${PGTEST_PORT:-$(( 54000 + RANDOM % 1000 ))}"

# initdb et postgres refusent de tourner en root : on passe par l'utilisateur postgres.
as_db_owner() {
  if [[ "$(id -u)" -eq 0 ]]; then
    runuser -u "${PG_OS_USER:-postgres}" -- "$@"
  else
    "$@"
  fi
}
if [[ "$(id -u)" -eq 0 ]]; then
  chown "${PG_OS_USER:-postgres}" "$TMP"
fi

cleanup() {
  as_db_owner "$PG_BIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  if [[ "${KEEP_DB:-0}" != "1" ]]; then rm -rf "$TMP"; else echo "cluster conservé : $TMP"; fi
}
trap cleanup EXIT

LOCALE=C.UTF-8
locale -a 2>/dev/null | grep -qi '^c\.utf-\?8$' || LOCALE=C

as_db_owner "$PG_BIN/initdb" -D "$DATA" -U postgres --auth=trust -E UTF8 --locale="$LOCALE" >"$TMP/initdb.log" 2>&1 \
  || { cat "$TMP/initdb.log" >&2; exit 1; }
as_db_owner "$PG_BIN/pg_ctl" -D "$DATA" -w -l "$TMP/postgres.log" \
  -o "-c listen_addresses='' -c unix_socket_directories='$TMP' -p $PORT -c fsync=off -c wal_level=logical" start >/dev/null \
  || { cat "$TMP/postgres.log" >&2; exit 1; }

PSQL=("$PG_BIN/psql" -X -q -v ON_ERROR_STOP=1 -h "$TMP" -p "$PORT" -U postgres -d postgres)

run() {
  local label="$1" file="$2"
  echo "== $label"
  # Les NOTICE « ok - ... » des tests passent sur stdout, sans le préfixe psql.
  if ! PGOPTIONS='-c client_min_messages=notice' "${PSQL[@]}" -f "$file" 2>&1 \
      | sed -E 's/^psql:[^ ]+ NOTICE:  //; s/^NOTICE:  //'; then
    echo "ÉCHEC : $file" >&2
    exit 1
  fi
}
set -o pipefail

run "stub Supabase" "$SUPA/tests/supabase-stub.sql"
for f in "$SUPA"/migrations/*.sql; do
  run "migration $(basename "$f")" "$f"
done
run "seed" "$SUPA/seed.sql"
run "seed (rejoué)" "$SUPA/seed.sql"
run "outils de test" "$SUPA/tests/helpers.sql"
for f in "$SUPA"/tests/*.test.sql; do
  run "tests $(basename "$f")" "$f"
done

echo "== tous les tests passent"
