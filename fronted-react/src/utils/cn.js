// 클래스 이름 결합 유틸리티
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

// Vapor UI 색상 헬퍼
export const colors = {
  primary: 'var(--vapor-color-primary)',
  secondary: 'var(--vapor-color-secondary)',
  success: 'var(--vapor-color-success)',
  warning: 'var(--vapor-color-warning)',
  danger: 'var(--vapor-color-danger)',
  gray: {
    100: 'var(--vapor-color-gray-100)',
    500: 'var(--vapor-color-gray-500)',
    700: 'var(--vapor-color-gray-700)',
    900: 'var(--vapor-color-gray-900)',
  }
};

// Vapor UI 간격 헬퍼
export const spacing = {
  xs: 'var(--vapor-space-050)',
  sm: 'var(--vapor-space-100)',
  md: 'var(--vapor-space-200)',
  lg: 'var(--vapor-space-300)',
  xl: 'var(--vapor-space-400)',
  '2xl': 'var(--vapor-space-500)',
};

// Vapor UI 반지름 헬퍼
export const radius = {
  sm: 'var(--vapor-radius-sm)',
  md: 'var(--vapor-radius-md)',
  lg: 'var(--vapor-radius-lg)',
  xl: 'var(--vapor-radius-xl)',
  full: 'var(--vapor-radius-full)',
};

export default { cn, colors, spacing, radius };