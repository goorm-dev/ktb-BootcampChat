# Base image
FROM --platform=linux/amd64 node:20-buster
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy .env 파일
COPY .env .env

# Copy source code
COPY . .

# Expose port and run the app
EXPOSE 5000
CMD ["npm", "start"]