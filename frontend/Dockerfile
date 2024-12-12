# Base image
FROM --platform=linux/amd64 node:20-alpine as build
WORKDIR /app

# .env.local 파일 복사
COPY .env.local .env.local

# Copy .npmrc for authentication
COPY .npmrc .npmrc

# Install dependencies
COPY package*.json ./
RUN npm install

# Install curl using apk (for Alpine)
RUN apk add --no-cache curl


# Copy source code and build
COPY . .

# Remove .next folder to clear cache
RUN rm -rf .next

RUN npm run build

RUN echo "NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}" && \
    echo "ENCRYPTION_KEY: ${NEXT_PUBLIC_ENCRYPTION_KEY}" && \
    echo "PASSWORD_SALT: ${NEXT_PUBLIC_PASSWORD_SALT}"

RUN cat /app/next.config.js

# Start the app
EXPOSE 3000
CMD ["npm", "run", "start"]