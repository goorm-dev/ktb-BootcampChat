# 빌드 단계: Node.js 공식 이미지를 베이스로 사용 (경량화된 Alpine 버전)
FROM node:20-alpine AS builder

# 작업 디렉토리 설정
WORKDIR /usr/src/app

# package.json과 package-lock.json을 복사하여 의존성 설치를 위한 캐시 레이어 생성
COPY package*.json ./

# 프로덕션 의존성 설치
RUN npm install --only=production

# 애플리케이션 소스 코드 복사
COPY . .

# 프로덕션 단계: 경량화된 Alpine 버전 사용
FROM node:18-alpine AS runner

# 작업 디렉토리 설정
WORKDIR /usr/src/app

# 비루트 사용자 생성 및 권한 설정
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# uploads 디렉토리 생성 및 권한 설정
RUN mkdir -p /usr/src/app/uploads && \
    chown -R appuser:appgroup /usr/src/app/uploads && \
    chown -R appuser:appgroup /usr/src/app

# 비루트 사용자로 전환
USER appuser

# 프로덕션 환경 변수 설정
ENV NODE_ENV=production

# 빌드 단계에서 생성된 파일과 프로덕션 의존성만 복사
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app ./

# 애플리케이션이 사용하는 포트 노출
EXPOSE 5000

# 애플리케이션 시작 명령어 정의
CMD ["npm", "start"]