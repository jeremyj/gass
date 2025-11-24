# GASS Deployment Guide - Docker with nginx-proxy

This guide explains how to deploy the GASS application using Docker with your existing `nginx-proxy` and `acme-companion` setup.

## Documentazione Correlata

- **[README](README.md)** - Panoramica progetto e quick start
- **[Manuale Utente](docs/MANUALE_UTENTE.md)** - Guida all'utilizzo dell'applicazione
- **[Documentazione Tecnica](docs/TECHNICAL.md)** - Architettura e riferimento sviluppatori

## Prerequisites

- Docker and Docker Compose installed
- Existing `nginx-proxy` and `acme-companion` containers running
- Domain name pointing to your server
- Port 80 and 443 accessible

## Quick Start

### 1. Configure Environment

Edit `docker-compose.yml` and update these values:

```yaml
environment:
  - VIRTUAL_HOST=gass.yourdomain.com        # ← Change to your domain
  - LETSENCRYPT_HOST=gass.yourdomain.com    # ← Change to your domain
  - LETSENCRYPT_EMAIL=your-email@example.com # ← Change to your email
```

### 2. Ensure Docker Network Exists

Your nginx-proxy should be using a Docker network (usually called `nginx-proxy`). Verify:

```bash
docker network ls | grep nginx-proxy
```

If it doesn't exist, create it:

```bash
docker network create nginx-proxy
```

If your nginx-proxy uses a different network name, update `docker-compose.yml`:

```yaml
networks:
  nginx-proxy:
    external: true
    name: your-actual-network-name  # ← Add this line
```

### 3. Generate Basic Auth Password

Run the provided script to create authentication credentials:

```bash
./generate-htpasswd.sh
```

This will create a `.htpasswd` file with your username and password.

### 4. Configure nginx-proxy for Basic Auth

#### Method 1: Using htpasswd volume (Recommended)

Mount the `.htpasswd` file into your nginx-proxy container. The file must be named exactly as your domain.

**If using docker-compose for nginx-proxy**, add this volume:

```yaml
services:
  nginx-proxy:
    volumes:
      # ... your existing volumes ...
      - /path/to/gass/.htpasswd:/etc/nginx/htpasswd/gass.yourdomain.com:ro
```

**If running nginx-proxy directly:**

```bash
docker run -d \
  --name nginx-proxy \
  -v /path/to/gass/.htpasswd:/etc/nginx/htpasswd/gass.yourdomain.com:ro \
  # ... other options ...
  nginxproxy/nginx-proxy
```

#### Method 2: Using BASIC_AUTH environment variable

In your GASS `docker-compose.yml`, add:

```yaml
environment:
  # ... existing environment variables ...
  - BASIC_AUTH=gas:$$apr1$$hash$$here  # Use output from htpasswd command
```

To get the hash:

```bash
cat .htpasswd
# Copy the entire line including username
```

**Note:** Double the `$` signs in docker-compose.yml (`$$` instead of `$`)

### 5. Ensure credentials.json Exists

Make sure your Google API credentials file is in place:

```bash
# Verify file exists
ls -la credentials.json

# If not, create or upload it
# This file contains your Google Sheets API credentials
```

### 6. Build and Start the Application

```bash
# Build the Docker image
docker-compose build

# Start the container
docker-compose up -d

# Check logs
docker-compose logs -f gass
```

### 7. Verify Deployment

1. **Check container is running:**
   ```bash
   docker ps | grep gass
   ```

2. **Check nginx-proxy detected the container:**
   ```bash
   docker logs nginx-proxy 2>&1 | grep gass
   ```

3. **Test the application:**
   ```bash
   # Should show nginx proxy response
   curl -I https://gass.yourdomain.com
   ```

4. **Access in browser:**
   - Go to `https://gass.yourdomain.com`
   - Should prompt for username/password
   - Enter credentials from step 3
   - Should see GASS application

## Troubleshooting

### Container won't start

Check logs:
```bash
docker-compose logs gass
```

Common issues:
- Missing `credentials.json` file
- Wrong file permissions
- Port 3000 already in use

### No SSL certificate generated

Check acme-companion logs:
```bash
docker logs acme-companion
```

Ensure:
- Domain DNS points to server
- Ports 80/443 are accessible
- `LETSENCRYPT_HOST` matches `VIRTUAL_HOST`
- `LETSENCRYPT_EMAIL` is valid

### Basic Auth not working

Verify:
1. `.htpasswd` file exists and has correct format:
   ```bash
   cat .htpasswd
   # Should show: username:hashedpassword
   ```

2. File is mounted correctly in nginx-proxy:
   ```bash
   docker exec nginx-proxy ls -la /etc/nginx/htpasswd/
   # Should show your domain file
   ```

3. Restart nginx-proxy after adding htpasswd:
   ```bash
   docker restart nginx-proxy
   ```

### Can't access the application

Check nginx-proxy config was generated:
```bash
docker exec nginx-proxy cat /etc/nginx/conf.d/default.conf | grep gass
```

Should show a server block for your domain.

## Maintenance

### View Application Logs

```bash
# Follow logs
docker-compose logs -f gass

# Last 100 lines
docker-compose logs --tail=100 gass
```

### Restart Application

```bash
docker-compose restart gass
```

### Update Application

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d
```

### Backup Database

The SQLite database is stored in a Docker volume. To backup:

```bash
# Create backup directory
mkdir -p backups

# Copy database from volume
docker run --rm \
  -v gass_gass-data:/data \
  -v $(pwd)/backups:/backup \
  alpine \
  cp /data/gass.db /backup/gass-$(date +%Y%m%d-%H%M%S).db

# List backups
ls -lh backups/
```

### Restore Database

```bash
# Stop application
docker-compose down

# Restore from backup
docker run --rm \
  -v gass_gass-data:/data \
  -v $(pwd)/backups:/backup \
  alpine \
  cp /backup/gass-20231120-120000.db /data/gass.db

# Start application
docker-compose up -d
```

### Automated Backup (Recommended)

Create a cron job to backup daily:

```bash
# Edit crontab
crontab -e

# Add this line (backup at 2 AM daily, keep last 30 days)
0 2 * * * cd /path/to/gass && docker run --rm -v gass_gass-data:/data -v $(pwd)/backups:/backup alpine sh -c "cp /data/gass.db /backup/gass-\$(date +\%Y\%m\%d).db && find /backup -name 'gass-*.db' -mtime +30 -delete"
```

## Docker Commands Reference

```bash
# View running containers
docker-compose ps

# Stop application
docker-compose stop

# Start application
docker-compose start

# Stop and remove container
docker-compose down

# Rebuild after code changes
docker-compose build

# View resource usage
docker stats gass-app

# Access container shell
docker-compose exec gass sh

# View volume location
docker volume inspect gass_gass-data
```

## Security Notes

1. **Never commit these files to git:**
   - `.htpasswd`
   - `credentials.json`
   - `.env` (if you create one)

2. **The `.gitignore` already excludes:**
   - `.htpasswd`
   - Database files
   - Credentials

3. **Change the default password** after first deployment

4. **Keep backups** in a secure location

5. **Update regularly:**
   ```bash
   # Update base image
   docker-compose pull
   docker-compose build --no-cache
   docker-compose up -d
   ```

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VIRTUAL_HOST` | Yes | Domain for nginx-proxy | `gass.example.com` |
| `VIRTUAL_PORT` | Yes | App port | `3000` |
| `LETSENCRYPT_HOST` | Yes | Domain for SSL cert | `gass.example.com` |
| `LETSENCRYPT_EMAIL` | Yes | Email for SSL renewal | `admin@example.com` |
| `NODE_ENV` | No | Node environment | `production` |
| `PORT` | No | App listening port | `3000` |

## File Structure

```
gass/
├── Dockerfile              # Docker image definition
├── docker-compose.yml      # Container orchestration
├── .dockerignore          # Files excluded from image
├── generate-htpasswd.sh   # Script to create auth file
├── .htpasswd              # Basic auth credentials (generated)
├── credentials.json       # Google API credentials
├── server.js              # Application entry point
├── gass.db               # SQLite database (in volume)
└── DEPLOYMENT.md         # This file
```

## Support

For issues:
1. Check logs: `docker-compose logs -f gass`
2. Verify nginx-proxy: `docker logs nginx-proxy`
3. Check acme-companion: `docker logs acme-companion`
4. Verify DNS: `dig gass.yourdomain.com`
5. Test connectivity: `curl -I https://gass.yourdomain.com`

## Next Steps

1. **Configure monitoring** (optional):
   - Set up Uptime Robot or similar
   - Monitor SSL expiration

2. **Set up automated backups** (see above)

3. **Document your setup** for your team

4. **Test recovery procedure** from backup
