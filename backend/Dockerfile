FROM node:20.16.0-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production

# 2) 런타임 스테이지
FROM node:20.16.0-alpine

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 백엔드가 5001번 포트를 사용하도록 환경변수 설정
ENV NODE_ENV=production
ENV PORT=5001

# 컨테이너가 수신할 포트
EXPOSE 5001

# package.json에 정의된 start 스크립트가 process.env.PORT를 사용하도록 가정
CMD ["npm", "start"]