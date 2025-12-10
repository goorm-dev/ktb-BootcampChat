// utils/colorUtils.js

// 전역 색상 캐시 맵
const globalColorCache = new Map();

// 사용자 색상 팔레트 (Vapor UI 색상 토큰 기반)
const USER_COLORS = [
  '#d54049', // red-500
  '#ca4676', // pink-500
  '#b148cb', // grape-500
  '#805ceb', // violet-500
  '#3174dc', // blue-500
  '#0d8298', // cyan-500
  '#058765', // green-500
  '#4c850e', // lime-500
  '#a26c01', // yellow-500
  '#cd4d0a', // orange-500
  '#f26394', // pink-400
  '#9a83f8'  // violet-400
];

// 이메일로부터 고유한 색상 생성
export const generateColorFromEmail = (email) => {
  if (!email) return '#3174dc'; // default blue-500

  // 캐시된 색상이 있는지 확인
  if (globalColorCache.has(email)) {
    return globalColorCache.get(email);
  }

  // 해시 생성
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = ((hash << 5) - hash) + email.charCodeAt(i);
    hash = hash & hash;
  }

  // 색상 선택
  const color = USER_COLORS[Math.abs(hash) % USER_COLORS.length];
  globalColorCache.set(email, color);
  
  return color;
};

// 배경색에 따른 텍스트 색상 계산
export const getContrastTextColor = (backgroundColor) => {
  if (!backgroundColor) return '#000000';
  
  // RGB 변환
  const r = parseInt(backgroundColor.slice(1, 3), 16);
  const g = parseInt(backgroundColor.slice(3, 5), 16);
  const b = parseInt(backgroundColor.slice(5, 7), 16);
  
  // YIQ 명도 계산
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return yiq >= 128 ? '#000000' : '#FFFFFF';
};

// 이메일에 대한 일관된 아바타 스타일 반환
export const getConsistentAvatarStyles = (email) => {
  if (!email) return {};
  const backgroundColor = generateColorFromEmail(email);
  const color = getContrastTextColor(backgroundColor);
  return { backgroundColor, color };
};