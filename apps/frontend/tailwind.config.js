/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  // Vapor UI와 함께 사용하기 위한 설정
  corePlugins: {
    // preflight는 Vapor UI의 리셋과 충돌할 수 있으므로 필요시 비활성화
    // preflight: false,
  },
}
