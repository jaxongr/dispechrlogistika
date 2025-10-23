# Deployment Guide - Logistics Dispatch System

## Server ma'lumotlari
- **Server IP**: 5.189.141.151
- **Port**: 3001 (port 3000 boshqa loyiha uchun ishlatilmoqda)
- **GitHub Repository**: https://github.com/jaxongr/dispechrlogistika.git

## Deployment qadamlari

### 1. Serverga ulanish
```bash
ssh username@5.189.141.151
```

### 2. Kerakli dasturlarni o'rnatish (agar yo'q bo'lsa)
```bash
# Node.js va npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Git
sudo apt-get install -y git

# PM2 (Process Manager)
sudo npm install -g pm2

# Nginx (agar yo'q bo'lsa)
sudo apt-get install -y nginx
```

### 3. Deployment skriptini yuklash va ishga tushirish
```bash
# Deployment skriptini yuklash
cd ~
wget https://raw.githubusercontent.com/jaxongr/dispechrlogistika/main/deploy.sh
chmod +x deploy.sh

# Deploy qilish
./deploy.sh
```

### 4. .env faylini sozlash
```bash
cd /var/www/dispatchr-logistics/backend
nano .env
```

Quyidagilarni o'zgartiring:
```env
# Port (already set to 3001)
PORT=3001

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=logistics_dispatch
DB_USER=postgres
DB_PASSWORD=your_actual_password

# JWT Secret (change this!)
JWT_SECRET=your_very_secure_jwt_secret_key_here

# Telegram API credentials
TELEGRAM_API_ID=your_actual_api_id
TELEGRAM_API_HASH=your_actual_api_hash
TELEGRAM_BOT_TOKEN=your_actual_bot_token

# Target Channel
TARGET_CHANNEL_ID=-1001234567890
TARGET_CHANNEL_USERNAME=your_channel_username
```

### 5. PostgreSQL Database sozlash (agar kerak bo'lsa)
```bash
# PostgreSQL o'rnatish
sudo apt-get install -y postgresql postgresql-contrib

# Database yaratish
sudo -u postgres psql
CREATE DATABASE logistics_dispatch;
CREATE USER postgres WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE logistics_dispatch TO postgres;
\q

# Database jadvallarini yaratish
cd /var/www/dispatchr-logistics/backend
npm run init-db
```

### 6. Nginx sozlash
```bash
# Nginx konfiguratsiya faylini yaratish
sudo nano /etc/nginx/sites-available/dispatchr-logistics
```

Nginx konfiguratsiyasini joylashtiring (nginx-config.conf faylidan nusxa ko'chiring):
```bash
sudo ln -s /etc/nginx/sites-available/dispatchr-logistics /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7. Firewall sozlash
```bash
# Port 3001 ni ochish (agar kerak bo'lsa)
sudo ufw allow 3001/tcp
sudo ufw reload
```

### 8. Ilovani ishga tushirish
```bash
cd /var/www/dispatchr-logistics/backend
pm2 start src/server.js --name dispatchr-logistics
pm2 save
pm2 startup
```

### 9. Tekshirish
```bash
# PM2 status
pm2 status

# Logs
pm2 logs dispatchr-logistics

# Health check
curl http://localhost:3001/api/health

# Nginx orqali
curl http://5.189.141.151/dispatch
```

## Foydali buyruqlar

### PM2 boshqaruvi
```bash
pm2 status                    # Status ko'rish
pm2 logs dispatchr-logistics  # Loglarni ko'rish
pm2 restart dispatchr-logistics  # Qayta ishga tushirish
pm2 stop dispatchr-logistics  # To'xtatish
pm2 delete dispatchr-logistics  # O'chirish
```

### Yangilanishlarni olish
```bash
cd /var/www/dispatchr-logistics
git pull origin main
cd backend
npm install
pm2 restart dispatchr-logistics
```

### Backup
```bash
# Database backup
pg_dump -U postgres logistics_dispatch > backup_$(date +%Y%m%d).sql

# Files backup
tar -czf dispatchr-backup-$(date +%Y%m%d).tar.gz /var/www/dispatchr-logistics
```

## URL'lar

- **Direct access**: http://5.189.141.151:3001
- **Via Nginx (recommended)**: http://5.189.141.151/dispatch
- **API**: http://5.189.141.151/dispatch/api
- **Health check**: http://5.189.141.151/dispatch/api/health

## Muammolarni hal qilish

### Agar port band bo'lsa:
```bash
# Qaysi process portni ishlatayotganini aniqlash
sudo lsof -i :3001
sudo netstat -tulpn | grep 3001

# Boshqa port ishlatish (masalan 3002)
# .env faylida PORT=3002 ga o'zgartiring
```

### Loglarni ko'rish:
```bash
# PM2 logs
pm2 logs dispatchr-logistics --lines 100

# Nginx logs
sudo tail -f /var/log/nginx/dispatch-logistics-error.log
sudo tail -f /var/log/nginx/dispatch-logistics-access.log
```

### Database muammolari:
```bash
# PostgreSQL status
sudo systemctl status postgresql

# Database ulanishini tekshirish
psql -U postgres -d logistics_dispatch -c "SELECT version();"
```

## Xavfsizlik

1. **.env faylini himoyalash**:
```bash
chmod 600 /var/www/dispatchr-logistics/backend/.env
```

2. **SSL sertifikat o'rnatish (Let's Encrypt)**:
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

3. **Firewall sozlash**:
```bash
sudo ufw enable
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 22/tcp    # SSH
sudo ufw status
```

## Qo'shimcha ma'lumot

Muammolar yoki savollar bo'lsa, GitHub Issues ga murojaat qiling:
https://github.com/jaxongr/dispechrlogistika/issues
