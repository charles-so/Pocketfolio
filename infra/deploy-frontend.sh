#!/bin/bash
# ============================================================
# Deploy Frontend to Azure Static Web Apps
# Usage: bash infra/deploy-frontend.sh [test|prod]
# ============================================================

set -e

ENV="${1:-test}"

if [ "$ENV" = "prod" ]; then
  SWA="charles-finance-web-prod"
  RG="charles-finance-prod"
  API_URL="https://charles-finance-api-prod.azurewebsites.net"
elif [ "$ENV" = "test" ]; then
  SWA="charles-finance-web-test"
  RG="charles-finance-test"
  API_URL="https://charles-finance-api-test.azurewebsites.net"
else
  echo "Usage: bash infra/deploy-frontend.sh [test|prod]"
  exit 1
fi

echo "============================================"
echo "  Deploying frontend to: $ENV"
echo "  Static Web App: $SWA"
echo "  API URL: $API_URL"
echo "============================================"

# Update environment.prod.ts with the correct API URL
echo ">>> Setting API URL to $API_URL..."
cat > frontend/src/environments/environment.prod.ts << EOF
export const environment = {
  production: true,
  apiUrl: '$API_URL',
};
EOF

echo ">>> Building Angular app..."
cd frontend
npm install --legacy-peer-deps
npx ng build --configuration production

echo ">>> Getting SWA deployment token..."
SWA_TOKEN=$(az staticwebapp secrets list   --name $SWA   --resource-group $RG   --query "properties.apiKey" -o tsv)

echo ">>> Deploying to Azure Static Web Apps..."
npx @azure/static-web-apps-cli deploy dist/ui/browser   --deployment-token $SWA_TOKEN

SWA_HOSTNAME=$(az staticwebapp show   --name $SWA   --resource-group $RG   --query defaultHostname -o tsv)

echo ""
echo ">>> Frontend deployed to: https://$SWA_HOSTNAME"
