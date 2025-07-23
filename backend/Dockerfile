# 백엔드 Dockerfile
# Node.js 18 LTS 버전을 기반으로 함
FROM node:18-alpine as base

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 매니저 최적화를 위해 package*.json 파일만 먼저 복사
COPY package*.json ./

# 프로덕션 의존성만 설치
RUN npm ci --only=production && npm cache clean --force

# 개발 단계 (개발 의존성 포함)
FROM base as development
# 개발 의존성 설치
RUN npm ci

# 소스 코드 복사
COPY . .

# 개발 모드로 실행
CMD ["npm", "run", "dev"]

# 프로덕션 빌드 단계
FROM base as production

# 애플리케이션 사용자 생성 (보안 강화)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 소스 코드 복사 (node_modules 제외)
COPY --chown=nodejs:nodejs . .

# uploads 디렉토리 생성 및 권한 설정
RUN mkdir -p uploads && \
    chown -R nodejs:nodejs uploads && \
    chmod 755 uploads

# 애플리케이션 사용자로 전환
USER nodejs

# 포트 노출 (환경변수로 설정 가능하도록)
EXPOSE 5000

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# 프로덕션 모드로 실행
CMD ["npm", "start"] 