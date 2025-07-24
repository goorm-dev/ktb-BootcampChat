// utils/colorUtils.js

// 전역 색상 캐시 맵
const globalColorCache = new Map();

// AI 에이전트용 고정 색상
const AI_COLORS = {
  wayneAI: {
    backgroundColor: '#0084ff',
    color: '#FFFFFF'
  },
  consultingAI: {
    backgroundColor: '#00C853',
    color: '#FFFFFF'
  },
  smokinggun: {
    backgroundColor: '#FF5722',
    color: '#FFFFFF'
  }
};

// 사용자 색상 팔레트
const USER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
  '#FFEEAD', '#D4A5A5', '#9B5DE5', '#F15BB5',
  '#00BBF9', '#00F5D4', '#738276', '#A6D8D4'
];

// AI 아바타 스타일 가져오기
export const getAIAvatarStyles = (aiName) => {
  if (!aiName) return AI_COLORS.wayneAI; // 기본값

  const formattedName = aiName.toLowerCase();
  
  if (formattedName === 'wayneai') {
    return AI_COLORS.wayneAI;
  }
  if (formattedName === 'consultingai') {
    return AI_COLORS.consultingAI;
  }
  if (formattedName === 'smokinggun') {
    return AI_COLORS.smokinggun;
  }
  
  // 알 수 없는 AI의 경우 기본값 반환
  return AI_COLORS.wayneAI;
};

// 이메일로부터 고유한 색상 생성
export const generateColorFromEmail = (email) => {
  if (!email) return '#0084ff';

  // 캐시된 색상이 있는지 확인
  if (globalColorCache.has(email)) {
    return globalColorCache.get(email);
  }

  // AI 계정 처리
  if (email.endsWith('@wayne.ai')) {
    globalColorCache.set(email, AI_COLORS.wayneAI.backgroundColor);
    return AI_COLORS.wayneAI.backgroundColor;
  }
  if (email.endsWith('@consulting.ai')) {
    globalColorCache.set(email, AI_COLORS.consultingAI.backgroundColor);
    return AI_COLORS.consultingAI.backgroundColor;
  }
  if (email.endsWith('@smokinggun.ai')) {
    globalColorCache.set(email, AI_COLORS.smokinggun.backgroundColor);
    return AI_COLORS.smokinggun.backgroundColor;
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

// 현재 캐시된 모든 색상 가져오기
export const getAllCachedColors = () => {
  return new Map(globalColorCache);
};

// 캐시 초기화 (필요한 경우에만 사용)
export const clearColorCache = () => {
  globalColorCache.clear();
};

// AI 색상 가져오기 (이름으로)
export const getAIColorByName = (aiName) => {
  if (!aiName) return null;
  
  const formattedName = aiName.toLowerCase();
  return AI_COLORS[formattedName] || null;
};

// 사용자 정의 색상 설정 (캐시에 추가)
export const setCustomColor = (identifier, color) => {
  if (!identifier || !color) return false;
  
  try {
    globalColorCache.set(identifier, color);
    return true;
  } catch (error) {
    console.error('Error setting custom color:', error);
    return false;
  }
};

// 색상 유효성 검사
export const isValidColor = (color) => {
  if (!color) return false;
  
  // HEX 색상 코드 검증
  const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return hexRegex.test(color);
};