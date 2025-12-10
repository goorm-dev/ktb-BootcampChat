# Stage 1: Builder
FROM node:22-alpine AS builder
WORKDIR /app

# 패키지 파일 복사
COPY package.json ./

# 의존성 설치 (빌드에 필요한 devDependencies 포함)
RUN npm i

# 소스 코드 복사
COPY . .

# Next.js 빌드
RUN npm run build

# Stage 2: Runner
FROM node:22-alpine AS runner
WORKDIR /app

# 보안을 위한 non-root 사용자 생성
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 필요한 파일만 복사
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 파일 권한 설정
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "server.js"]
