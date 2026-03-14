#!/bin/bash
# ============================================================
# Azure Infrastructure Setup - PROD Environment
# Run: bash infra/setup-prod.sh
# ============================================================

set -e  # Stop on any error

ENV="prod"
LOCATION="australiaeast"
RG="charles-finance-prod"
SQL_SERVER="charles-finance-sql-prod"
SQL_DB="EnvelopeBudget"
SQL_ADMIN="sqladmin"
APP_SERVICE_PLAN="charles-finance-plan-prod"
APP_SERVICE="charles-finance-api-prod"
SWA="charles-finance-web-prod"
APP_INSIGHTS="charles-finance-insights-prod"
LOG_WORKSPACE="charles-finance-logs-prod"
STORAGE_ACCOUNT="charlesfinanceprod"

echo "============================================"
echo "  Setting up PROD environment"
echo "  Resource Group: $RG"
echo "  Location: $LOCATION"
echo "============================================"

# --- Step 1: Resource Group ---
echo ""
echo ">>> Step 1: Creating Resource Group..."
echo "    A resource group is a container that holds all your Azure resources."
echo "    Think of it as a folder - you can delete the whole folder to remove everything."
az group create --name $RG --location $LOCATION --output table

# --- Step 2: SQL Server + Database ---
echo ""
echo ">>> Step 2: Creating SQL Server..."
echo "    This is the database server that will host your app's data."
read -sp "Choose a SQL admin password (min 8 chars, needs uppercase+number+symbol): " SQL_PASSWORD
echo ""

az sql server create   --name $SQL_SERVER   --resource-group $RG   --location $LOCATION   --admin-user $SQL_ADMIN   --admin-password "$SQL_PASSWORD"   --output table

echo ">>> Allowing Azure services to access SQL..."
echo "    This firewall rule lets your App Service connect to the database."
az sql server firewall-rule create   --resource-group $RG   --server $SQL_SERVER   --name AllowAzureServices   --start-ip-address 0.0.0.0   --end-ip-address 0.0.0.0   --output table

echo ">>> Creating SQL Database (Basic tier ~$7/mo)..."
az sql db create   --resource-group $RG   --server $SQL_SERVER   --name $SQL_DB   --edition Basic   --capacity 5   --output table

# --- Step 3: App Service (Backend API) ---
echo ""
echo ">>> Step 3: Creating App Service Plan (B1 ~$18/mo)..."
echo "    The plan defines the VM size. B1 = 1 core, 1.75GB RAM, always on."
az appservice plan create   --name $APP_SERVICE_PLAN   --resource-group $RG   --location $LOCATION   --sku B1   --is-linux   --output table

echo ">>> Creating Web App..."
echo "    This is where your .NET backend API will run."
az webapp create   --name $APP_SERVICE   --resource-group $RG   --plan $APP_SERVICE_PLAN   --runtime "DOTNETCORE:10.0"   --output table

# --- Step 4: Storage Account (Blob Storage for attachments) ---
echo ""
echo ">>> Step 4: Creating Storage Account..."
echo "    Blob Storage holds your file attachments (receipts, documents)."
echo "    Cost: ~$0.02 per GB per month."
az storage account create   --name $STORAGE_ACCOUNT   --resource-group $RG   --location $LOCATION   --sku Standard_LRS   --output table

STORAGE_CONN=$(az storage account show-connection-string   --name $STORAGE_ACCOUNT   --resource-group $RG   --query connectionString -o tsv)

# --- Step 5: Log Analytics Workspace + Application Insights ---
echo ""
echo ">>> Step 5: Creating Log Analytics Workspace..."
echo "    This stores the logs that Application Insights collects."
echo "    By creating it ourselves, everything stays in our resource group."
az monitor log-analytics workspace create   --workspace-name $LOG_WORKSPACE   --resource-group $RG   --location $LOCATION   --output table

LOG_WORKSPACE_ID=$(az monitor log-analytics workspace show   --workspace-name $LOG_WORKSPACE   --resource-group $RG   --query id -o tsv)

echo ">>> Creating Application Insights (linked to our workspace)..."
echo "    This collects request traces, errors, and performance metrics."
echo "    Free up to 5GB/month of data."
MSYS_NO_PATHCONV=1 az monitor app-insights component create   --app $APP_INSIGHTS   --location $LOCATION   --resource-group $RG   --kind web   --workspace "$LOG_WORKSPACE_ID"   --output table

AI_CONN=$(az monitor app-insights component show   --app $APP_INSIGHTS   --resource-group $RG   --query connectionString -o tsv)

# --- Step 6: Static Web App (Frontend) ---
echo ""
echo ">>> Step 6: Creating Static Web App (Free tier)..."
echo "    This hosts your Angular frontend (HTML/CSS/JS) on a global CDN."
az staticwebapp create   --name $SWA   --resource-group $RG   --location eastasia   --output table

SWA_HOSTNAME=$(az staticwebapp show   --name $SWA   --resource-group $RG   --query defaultHostname -o tsv)

# --- Step 7: Configure App Service settings ---
echo ""
echo ">>> Step 7: Configuring App Service with secrets and settings..."
echo "    These are stored as App Service Configuration (encrypted at rest)."
echo "    Only people with access to this App Service can view them."

SQL_CONN="Server=tcp:${SQL_SERVER}.database.windows.net,1433;Database=${SQL_DB};User ID=${SQL_ADMIN};Password=${SQL_PASSWORD};Encrypt=True;TrustServerCertificate=False;"

az webapp config appsettings set   --name $APP_SERVICE   --resource-group $RG   --settings     "ConnectionStrings__DefaultConnection=$SQL_CONN"     "Jwt__Key=EnvelopeBudget-SuperSecret-JWT-Key-2026-Must-Be-256-Bits!"     "Jwt__Issuer=EnvelopeBudget"     "Jwt__ExpiresHours=168"     "MasterKey=EB-Master-2026-xK9!pL7@wQ2#nJ5"     "ApplicationInsights__ConnectionString=$AI_CONN"     "BlobStorage__ConnectionString=$STORAGE_CONN"     "BlobStorage__ContainerName=attachments"     "Cors__AllowedOrigins__0=https://$SWA_HOSTNAME"   --output table

echo ""
echo "============================================"
echo "  PROD environment setup complete!"
echo "============================================"
echo ""
echo "  Resource Group:  $RG"
echo "  SQL Server:      ${SQL_SERVER}.database.windows.net"
echo "  App Service:     https://${APP_SERVICE}.azurewebsites.net"
echo "  Static Web App:  https://${SWA_HOSTNAME}"
echo "  Blob Storage:    $STORAGE_ACCOUNT"
echo "  App Insights:    $APP_INSIGHTS"
echo ""
echo "  Secrets are stored in App Service Configuration (encrypted at rest)."
echo "  To view: az webapp config appsettings list --name $APP_SERVICE --resource-group $RG --output table"
echo ""
echo "  Next steps:"
echo "  1. Deploy backend:  bash infra/deploy-backend.sh prod"
echo "  2. Deploy frontend: bash infra/deploy-frontend.sh prod"
echo "============================================"
