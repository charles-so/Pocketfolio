#!/bin/bash
# ============================================================
# Delete an entire environment (to save costs)
# Usage: bash infra/teardown.sh [test|prod]
# WARNING: This deletes EVERYTHING in the resource group!
# ============================================================

ENV="${1:-test}"

if [ "$ENV" = "prod" ]; then
  RG="charles-finance-prod"
elif [ "$ENV" = "test" ]; then
  RG="charles-finance-test"
else
  echo "Usage: bash infra/teardown.sh [test|prod]"
  exit 1
fi

echo "============================================"
echo "  WARNING: This will delete ALL resources in:"
echo "  Resource Group: $RG"
echo "============================================"
read -p "Are you sure? Type 'yes' to confirm: " CONFIRM

if [ "$CONFIRM" = "yes" ]; then
  echo ">>> Deleting resource group $RG..."
  az group delete --name $RG --yes --no-wait
  echo ">>> Deletion started. Resources will be removed in a few minutes."
else
  echo ">>> Cancelled."
fi
