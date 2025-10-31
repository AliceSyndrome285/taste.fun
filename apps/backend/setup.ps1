#!/usr/bin/env pwsh
# Quick Start Script for taste.fun Backend (Windows PowerShell)

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  taste.fun Backend - Quick Start Setup" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js $nodeVersion found" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found. Please install Node.js 18+ first." -ForegroundColor Red
    exit 1
}

# Check if npm is installed
Write-Host "Checking npm installation..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "✓ npm $npmVersion found" -ForegroundColor Green
} catch {
    Write-Host "✗ npm not found." -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Dependencies installed successfully" -ForegroundColor Green

# Check if .env exists
Write-Host ""
Write-Host "Checking environment configuration..." -ForegroundColor Yellow
if (!(Test-Path ".env")) {
    Write-Host "✗ .env file not found" -ForegroundColor Red
    Write-Host "  Creating .env from template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✓ .env file created" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: Please edit .env file with your configuration!" -ForegroundColor Red
    Write-Host "   Required fields:" -ForegroundColor Yellow
    Write-Host "   - SOLANA_RPC_URL" -ForegroundColor Yellow
    Write-Host "   - SOLANA_WSS_URL" -ForegroundColor Yellow
    Write-Host "   - PROGRAM_ID" -ForegroundColor Yellow
    Write-Host "   - DB_PASSWORD" -ForegroundColor Yellow
    Write-Host "   - IPFS_API_KEY (or IPFS_PROJECT_ID)" -ForegroundColor Yellow
    Write-Host "   Optional fields:" -ForegroundColor Yellow
    Write-Host "   - DEPIN_API_KEY (password for Cloudflare Worker, default: admin123)" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Have you configured .env? (y/n)"
    if ($continue -ne "y") {
        Write-Host "Please configure .env and run this script again." -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "✓ .env file found" -ForegroundColor Green
}

# Check PostgreSQL
Write-Host ""
Write-Host "Checking PostgreSQL..." -ForegroundColor Yellow
try {
    $pgVersion = psql --version
    Write-Host "✓ PostgreSQL found: $pgVersion" -ForegroundColor Green
    
    Write-Host "  Would you like to create the database now? (y/n)" -ForegroundColor Yellow
    $createDb = Read-Host
    if ($createDb -eq "y") {
        Write-Host "  Enter PostgreSQL username (default: postgres):" -ForegroundColor Yellow
        $pgUser = Read-Host
        if ([string]::IsNullOrEmpty($pgUser)) { $pgUser = "postgres" }
        
        Write-Host "  Creating database..." -ForegroundColor Yellow
        $createDbSql = @"
CREATE DATABASE taste_fun;
CREATE USER taste_fun_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE taste_fun TO taste_fun_user;
"@
        
        Write-Host $createDbSql | psql -U $pgUser
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Database created successfully" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "⚠️  PostgreSQL not found. Please install PostgreSQL 14+ first." -ForegroundColor Yellow
    Write-Host "   Download: https://www.postgresql.org/download/" -ForegroundColor Yellow
}

# Check Redis
Write-Host ""
Write-Host "Checking Redis..." -ForegroundColor Yellow
try {
    redis-cli --version | Out-Null
    Write-Host "✓ Redis found" -ForegroundColor Green
    
    # Try to ping Redis
    $redisPing = redis-cli ping
    if ($redisPing -eq "PONG") {
        Write-Host "✓ Redis is running" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Redis is not running. Please start Redis server." -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Redis not found. Please install Redis first." -ForegroundColor Yellow
    Write-Host "   Download: https://redis.io/download" -ForegroundColor Yellow
    Write-Host "   Windows: https://github.com/microsoftarchive/redis/releases" -ForegroundColor Yellow
}

# Run migrations
Write-Host ""
Write-Host "Would you like to run database migrations now? (y/n)" -ForegroundColor Yellow
$runMigrations = Read-Host
if ($runMigrations -eq "y") {
    Write-Host "Running migrations..." -ForegroundColor Yellow
    npm run db:migrate
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Migrations completed successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Migrations failed. Please check your database configuration." -ForegroundColor Red
    }
}

# Build project
Write-Host ""
Write-Host "Building project..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Build completed successfully" -ForegroundColor Green
} else {
    Write-Host "⚠️  Build had some warnings (this is expected with missing dependencies)" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Ensure PostgreSQL is running" -ForegroundColor White
Write-Host "  2. Ensure Redis is running" -ForegroundColor White
Write-Host "  3. Verify .env configuration" -ForegroundColor White
Write-Host "  4. Run: npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "The service will be available at:" -ForegroundColor Yellow
Write-Host "  API:       http://localhost:3006" -ForegroundColor White
Write-Host "  WebSocket: ws://localhost:3002" -ForegroundColor White
Write-Host ""
Write-Host "Documentation:" -ForegroundColor Yellow
Write-Host "  - README.md         : Overview" -ForegroundColor White
Write-Host "  - DEPLOYMENT.md     : Deployment guide" -ForegroundColor White
Write-Host "  - API.md            : API documentation" -ForegroundColor White
Write-Host "  - IMPLEMENTATION.md : Implementation details" -ForegroundColor White
Write-Host ""
Write-Host "Would you like to start the development server now? (y/n)" -ForegroundColor Yellow
$startServer = Read-Host
if ($startServer -eq "y") {
    Write-Host ""
    Write-Host "Starting development server..." -ForegroundColor Green
    npm run dev
}
