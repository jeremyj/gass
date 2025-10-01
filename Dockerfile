FROM node:18-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy application files
COPY . .

# Create volume for database
VOLUME ["/app/data"]

EXPOSE 3000
CMD ["node", "server.js"]