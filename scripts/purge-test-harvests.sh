#!/usr/bin/env bash
set -euo pipefail

##
# Purga QUIRÚRGICA de cosechas de prueba en el WMS de producción.
#
# Solo borra registros HARVEST cuyo `harvester` empieza con el prefijo de prueba
# (default: E2E-LIVE-). Cualquier otro registro se deja intacto.
# No existe endpoint DELETE de harvests en el contrato admin, por eso se borra
# directo en DynamoDB (tabla armache-wms, PK HARVEST#<id> SK META + agregados
# HARVESTLOTS#<id> si existieran).
#
# Fail-closed:
#   - Sin --execute solo hace DRY-RUN (lista lo que borraría, no borra nada).
#   - El prefijo DEBE empezar con E2E-LIVE- (se rechaza cualquier otro).
#   - Cada item se re-verifica por PK/SK exactos antes del delete.
#
# Uso:
#   export AWS_PROFILE=481084557193_AdministratorAccess AWS_REGION=us-east-1
#   bash scripts/purge-test-harvests.sh                          # dry-run
#   bash scripts/purge-test-harvests.sh --execute                 # borra
#   TABLE=otra-tabla PREFIX=E2E-LIVE- bash scripts/purge-test-harvests.sh --execute
#
# Requiere: aws cli con dynamodb:Scan/Query/DeleteItem en la tabla WMS.
##

TABLE="${TABLE:-armache-wms}"
PREFIX="${PREFIX:-E2E-LIVE-}"
EXECUTE=0

for arg in "$@"; do
  case "$arg" in
    --execute) EXECUTE=1 ;;
    --help|-h)
      sed -n '3,28p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "❌ Flag desconocido: $arg (solo --execute)" >&2
      exit 1
      ;;
  esac
done

# Fail-closed: solo prefijos de prueba.
case "$PREFIX" in
  E2E-LIVE-*) ;;
  *)
    echo "❌ Prefijo rechazado: '$PREFIX'. Debe empezar con E2E-LIVE-." >&2
    exit 1
    ;;
esac

if [ "$EXECUTE" -eq 1 ]; then MODE="EXECUTE"; else MODE="DRY-RUN"; fi
echo "▶️  Tabla: $TABLE | Prefijo: '$PREFIX' | Modo: $MODE"

# JSON de ExpressionAttributeValues construido con printf (sin quotes anidados).
eav_harvest() {
  printf '{"%s":{"S":"HARVEST"},"%s":{"S":"%s"}}' ':t' ':p' "$PREFIX"
}

# 1. Scan de cosechas de prueba (paginado por el CLI).
ITEMS_JSON="$(aws dynamodb scan \
  --table-name "$TABLE" \
  --filter-expression 'entityType = :t AND begins_with(harvester, :p)' \
  --expression-attribute-values "$(eav_harvest)" \
  --projection-expression 'PK, SK, harvestId, harvestReferenceId, farmId, harvester' \
  --output json)" || { echo "❌ Falló el scan (¿SSO expirado? source scripts/aws-login.sh)" >&2; exit 1; }

COUNT="$(echo "$ITEMS_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['Count'])")"
echo "   Encontradas: $COUNT cosecha(s) de prueba."

if [ "$COUNT" -eq 0 ]; then
  echo "   ✅ Nada que purgar."
  exit 0
fi

echo "$ITEMS_JSON" | python3 -c "
import json, sys
for it in json.load(sys.stdin)['Items']:
    g = lambda k: it.get(k, {}).get('S', '?')
    print('   - ' + g('harvestId') + ' | ref=' + g('harvestReferenceId') + ' | farm=' + g('farmId') + ' | harvester=' + g('harvester'))
"

if [ "$EXECUTE" -eq 0 ]; then
  echo "   🟡 DRY-RUN: no se borró nada. Re-ejecutá con --execute para purgar."
  exit 0
fi

# 2. Borrado quirúrgico: item principal + agregados huérfanos del mismo harvest.
DELETED=0
while read -r HID; do
  [ -n "$HID" ] || continue
  # 2a. Agregados HARVESTLOTS#<id> (origen lote←cosecha) si existieran.
  AGG_PK="HARVESTLOTS#$HID"
  AGG="$(aws dynamodb query \
    --table-name "$TABLE" \
    --key-condition-expression 'PK = :pk' \
    --expression-attribute-values "$(printf '{"%s":{"S":"%s"}}' ':pk' "$AGG_PK")" \
    --projection-expression 'PK, SK' \
    --output json)"
  AGG_COUNT="$(echo "$AGG" | python3 -c "import json,sys; print(json.load(sys.stdin)['Count'])")"
  if [ "$AGG_COUNT" -gt 0 ]; then
    echo "$AGG" | python3 -c "import json,sys; [print(it['PK']['S']+'\t'+it['SK']['S']) for it in json.load(sys.stdin)['Items']]" | \
    while IFS="$(printf '\t')" read -r APK ASK; do
      aws dynamodb delete-item --table-name "$TABLE" \
        --key "$(printf '{"PK":{"S":"%s"},"SK":{"S":"%s"}}' "$APK" "$ASK")" >/dev/null
      echo "   🗑️  agregado $APK $ASK"
    done
  fi
  # 2b. Item principal (PK/SK exactos: ya verificado por scan + prefijo).
  aws dynamodb delete-item --table-name "$TABLE" \
    --key "$(printf '{"PK":{"S":"HARVEST#%s"},"SK":{"S":"META"}}' "$HID")" >/dev/null
  echo "   🗑️  HARVEST#$HID META"
  DELETED=$((DELETED + 1))
done < <(echo "$ITEMS_JSON" | python3 -c "import json,sys; [print(it['harvestId']['S']) for it in json.load(sys.stdin)['Items']]")

# 3. Verificación: re-scan debe dar 0.
LEFT="$(aws dynamodb scan \
  --table-name "$TABLE" \
  --filter-expression 'entityType = :t AND begins_with(harvester, :p)' \
  --expression-attribute-values "$(eav_harvest)" \
  --select COUNT --output json | python3 -c "import json,sys; print(json.load(sys.stdin)['Count'])")"
echo "   Borradas: $DELETED | Restantes con prefijo: $LEFT"
if [ "$LEFT" -ne 0 ]; then
  echo "⚠️  Quedaron $LEFT registro(s): revisar agregados HARVESTSTEPS u otros." >&2
  exit 1
fi
echo "   ✅ Purga completa, 0 restantes."
