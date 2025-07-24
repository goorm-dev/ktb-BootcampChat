# 프론트엔드 Dockerfile
# Next.js 애플리케이션을 위한 멀티스테이지 빌드
FROM node:18-alpine AS base

# 의존성 설치를 위한 단계
FROM base AS deps
# libc6-compat는 Alpine에서 일부 패키지 호환성을 위해 필요
RUN apk add --no-cache libc6-compat

WORKDIR /app

# 패키지 파일들을 먼저 복사하여 Docker 레이어 캐싱 최적화
COPY package*.json ./
RUN npm ci --omit=dev

# 개발 의존성을 포함한 빌드용 단계
FROM base AS builder
WORKDIR /app

# 의존성 복사
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 개발 의존성 설치 (빌드에 필요)
RUN npm ci

# Next.js 애플리케이션 빌드
# 환경변수는 빌드 시점에 주입되어야 함
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# 빌드 실행
RUN npm run build

# 프로덕션 실행을 위한 최종 단계
FROM base AS production

WORKDIR /app

# 프로덕션 환경 설정
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 애플리케이션 실행을 위한 사용자 생성 (보안 강화)
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Next.js 빌드 결과물과 필요한 파일들만 복사
COPY --from=builder /app/public ./public

# Next.js 빌드 결과물 복사 (standalone 모드 사용)
# Next.js 13.4+ 에서는 output: 'standalone' 설정 권장
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# nextjs 사용자로 전환
USER nextjs

# 포트 노출
EXPOSE 3000

# 환경변수 설정
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))" || \
  CMD node -e "require('http').get('http://localhost:3000', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Next.js 애플리케이션 실행 (standalone 모드)
CMD ["node", "server.js"]

# 개발 단계 (선택적)
FROM base AS development

WORKDIR /app

# 개발 의존성 포함하여 모든 의존성 설치
COPY package*.json ./
RUN npm ci

# 소스 코드 복사
COPY . .

# 개발 서버 실행
CMD ["npm", "run", "dev"] 