#!/bin/bash
# ============================================================
# Deploy Backend to Azure App Service
# Usage: bash infra/deploy-backend.sh [test|prod]
# ============================================================

set -e

ENV="${1:-test}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "$ENV" = "prod" ]; then
  APP_SERVICE="charles-finance-api-prod"
  RG="charles-finance-prod"
elif [ "$ENV" = "test" ]; then
  APP_SERVICE="charles-finance-api-test"
  RG="charles-finance-test"
else
  echo "Usage: bash infra/deploy-backend.sh [test|prod]"
  exit 1
fi

echo "============================================"
echo "  Deploying backend to: $ENV"
echo "  App Service: $APP_SERVICE"
echo "============================================"

echo ">>> Cleaning previous build..."
rm -rf backend/publish backend/deploy.zip

echo ">>> Publishing .NET app..."
cd backend
dotnet publish -c Release -o ./publish

echo ">>> Creating zip package (Linux-compatible)..."
powershell.exe -ExecutionPolicy Bypass -File "$SCRIPT_DIR/create-zip.ps1" -publishPath "./publish" -zipPath "./deploy.zip"

echo ">>> Deploying to Azure..."
az webapp deploy   --name $APP_SERVICE   --resource-group $RG   --src-path deploy.zip   --type zip   --async false

echo ">>> Cleaning up..."
rm -rf publish deploy.zip

echo ""
echo ">>> Backend deployed to: https://$APP_SERVICE.azurewebsites.net"
