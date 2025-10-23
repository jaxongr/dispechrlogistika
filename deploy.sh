#!/bin/bash

# Deployment Script for Logistics Dispatch System
# Deploy to port 3001 (port 3000 is already in use)

set -e

echo "🚀 Starting deployment..."

# Configuration
APP_NAME="dispatchr-logistics"
APP_DIR="/var/www/$APP_NAME"
PORT=3001
REPO_URL="https://github.com/jaxongr/dispechrlogistika.git"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📦 Deployment Configuration:${NC}"
echo "   App Name: $APP_NAME"
echo "   Directory: $APP_DIR"
echo "   Port: $PORT"
echo "   Repository: $REPO_URL"
echo ""

# Check if directory exists
if [ -d "$APP_DIR" ]; then
    echo -e "${YELLOW}📁 Directory exists, pulling latest changes...${NC}"
    cd $APP_DIR
    git pull origin main
else
    echo -e "${YELLOW}📁 Creating directory and cloning repository...${NC}"
    sudo mkdir -p $APP_DIR
    sudo chown -R $USER:$USER $APP_DIR
    git clone $REPO_URL $APP_DIR
    cd $APP_DIR
fi

# Install backend dependencies
echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
cd backend
npm install --production

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚙️  Creating .env file...${NC}"
    cp .env.example .env

    # Update port in .env
    sed -i "s/PORT=3000/PORT=$PORT/" .env

    echo -e "${RED}⚠️  IMPORTANT: Please update .env file with your actual credentials!${NC}"
    echo "   - Database credentials"
    echo "   - Telegram API credentials"
    echo "   - JWT secret"
    echo ""
fi

# Setup database
echo -e "${YELLOW}🗄️  Setting up database...${NC}"
npm run init-db

# Setup PM2 process manager
echo -e "${YELLOW}🔧 Setting up PM2...${NC}"

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}Installing PM2...${NC}"
    sudo npm install -g pm2
fi

# Stop existing process if running
pm2 delete $APP_NAME 2>/dev/null || true

# Start application with PM2
echo -e "${YELLOW}🚀 Starting application...${NC}"
pm2 start src/server.js --name $APP_NAME --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd -u $USER --hp /home/$USER

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo "📊 Application is running on port $PORT"
echo "🔍 Check status: pm2 status"
echo "📋 View logs: pm2 logs $APP_NAME"
echo "🔄 Restart: pm2 restart $APP_NAME"
echo "🛑 Stop: pm2 stop $APP_NAME"
echo ""
echo -e "${YELLOW}🌐 Configure Nginx reverse proxy:${NC}"
echo "   Location: /etc/nginx/sites-available/$APP_NAME"
echo "   Proxy to: http://localhost:$PORT"
echo ""
echo -e "${RED}⚠️  Don't forget to:${NC}"
echo "   1. Update .env file with actual credentials"
echo "   2. Configure Nginx reverse proxy"
echo "   3. Setup SSL certificate (Let's Encrypt)"
echo ""
