const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true'
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // 에러 처리 문제 해결을 위해 일시적으로 비활성화
  transpilePackages: ['@vapor-ui/core', '@vapor-ui/icons'],
  compress: true, // 서버 압축을 명시적으로 활성화
  // Docker 빌드를 위한 standalone 출력 모드 (개발 환경에는 영향 없음)
  output: 'standalone',
  // monorepo에서 standalone 빌드 시 중첩 경로 방지
  outputFileTracingRoot: __dirname,
  // 개발 환경에서의 에러 오버레이 설정
  devIndicators: {
    buildActivity: true,
    buildActivityPosition: 'bottom-right'
  },
  // 개발 환경에서만 더 자세한 에러 로깅
  ...(process.env.NODE_ENV === 'development' && {
    experimental: {
      forceSwcTransforms: true
    }
  })
};

module.exports = withBundleAnalyzer(nextConfig);
