# 빌드용으로 Node.js 공식 이미지를 베이스로 사용 (경량화된 Alpine 버전)
FROM node:20-alpine AS builder

# 작업 디렉토리 설정
WORKDIR /usr/src/app

# package.json과 package-lock.json을 복사하여 의존성 설치를 위한 캐시 레이어 생성
COPY package*.json ./
COPY .npmrc ./

# 의존성 설치 (캐시 활용)
RUN npm install

# 애플리케이션 소스 코드 복사
COPY . .

# 애플리케이션 빌드
RUN npm run build

# 프로덕션용 이미지 설정 (경량화된 Alpine 버전 사용)
FROM node:20-alpine AS runner

# 작업 디렉토리 설정
WORKDIR /usr/src/app

# 프로덕션 환경 변수 설정
ENV NODE_ENV=production

# 빌드 단계에서 생성된 파일과 프로덕션 의존성만 복사
COPY --from=builder /usr/src/app/.next ./.next
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package.json ./package.json
COPY --from=builder /usr/src/app/public ./public

# Next.js 기본 포트 노출
EXPOSE 3000

# 애플리케이션 시작 명령어 정의
CMD ["npm", "start"]
