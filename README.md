# GAS Pagamenti - Local Server Setup

## Prerequisites

- Node.js (v14 or higher)
- Google Cloud Project with Sheets API enabled
- Service Account credentials

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Sheets API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Sheets API"
   - Click "Enable"

4. Create a **Service Account**:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "Service Account"
   - Fill in the details and click "Create"
   - Skip optional steps and click "Done"

5. Create a **Service Account Key**:
   - Click on the service account you just created
   - Go to "Keys" tab
   - Click "Add Key" → "Create new key"
   - Choose "JSON" format
   - Download the file and save it as `credentials.json` in the project root

6. **Share your Google Sheets** with the service account email:
   - Open the service account details
   - Copy the email (looks like: `name@project-id.iam.gserviceaccount.com`)
   - Open each of your 3 Google Sheets
   - Click "Share" and paste the service account email
   - Give "Editor" permission

### 3. Environment Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Edit `.env` if needed (default values should work)

### 4. Run the Server

Development mode (auto-restart on changes):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The app will be available at: http://localhost:3000

## Project Structure

```
gass/
├── server.js              # Express server with Google Sheets API
├── public/
│   └── index.html        # Frontend application
├── credentials.json      # Google service account credentials (not in git)
├── .env                  # Environment variables (not in git)
├── package.json          # Node.js dependencies
└── README.md            # This file
```

## Deployment

### Deploy to a VPS/Server

1. Copy all files to your server
2. Install Node.js on the server
3. Run `npm install --production`
4. Use a process manager like PM2:
   ```bash
   npm install -g pm2
   pm2 start server.js --name gas-pagamenti
   pm2 save
   pm2 startup
   ```

### Deploy with Docker

Create a `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

Build and run:
```bash
docker build -t gas-pagamenti .
docker run -p 3000:3000 -v $(pwd)/credentials.json:/app/credentials.json gas-pagamenti
```

## Security Notes

- **Never commit** `credentials.json` or `.env` to git
- Keep your service account key secure
- Use HTTPS in production
- Consider adding authentication for the web interface
