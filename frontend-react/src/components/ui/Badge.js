import React from 'react';
import { cn } from '../../utils/cn';

// Badge 컴포넌트 - Bootstrap badge 대체
export const Badge = ({ 
  children, 
  variant = 'primary',
  size = 'md',
  pill = false,
  className = '',
  ...props 
}) => {
  const variants = {
    primary: {
      backgroundColor: 'var(--vapor-color-primary)',
      color: 'white',
    },
    secondary: {
      backgroundColor: 'var(--vapor-color-secondary)',
      color: 'var(--vapor-color-gray-900)',
    },
    success: {
      backgroundColor: 'var(--vapor-color-success)',
      color: 'white',
    },
    danger: {
      backgroundColor: 'var(--vapor-color-danger)',
      color: 'white',
    },
    warning: {
      backgroundColor: 'var(--vapor-color-warning)',
      color: 'var(--vapor-color-gray-900)',
    },
    info: {
      backgroundColor: 'var(--vapor-color-info)',
      color: 'white',
    },
    light: {
      backgroundColor: 'var(--vapor-color-gray-100)',
      color: 'var(--vapor-color-gray-900)',
    },
    dark: {
      backgroundColor: 'var(--vapor-color-gray-900)',
      color: 'white',
    },
  };

  const sizes = {
    sm: {
      fontSize: 'var(--vapor-font-size-xs)',
      padding: 'var(--vapor-space-025) var(--vapor-space-100)',
    },
    md: {
      fontSize: 'var(--vapor-font-size-sm)',
      padding: 'var(--vapor-space-050) var(--vapor-space-150)',
    },
    lg: {
      fontSize: 'var(--vapor-font-size-md)',
      padding: 'var(--vapor-space-100) var(--vapor-space-200)',
    },
  };

  const variantStyle = variants[variant] || variants.primary;
  const sizeStyle = sizes[size] || sizes.md;

  const badgeStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    lineHeight: 1,
    borderRadius: pill ? 'var(--vapor-radius-full)' : 'var(--vapor-radius-sm)',
    ...variantStyle,
    ...sizeStyle,
  };

  return (
    <span
      style={badgeStyles}
      className={cn('vapor-badge', className)}
      {...props}
    >
      {children}
    </span>
  );
};

// NotificationBadge 컴포넌트 - 알림 배지
export const NotificationBadge = ({ 
  count = 0,
  max = 99,
  showZero = false,
  className = '',
  ...props 
}) => {
  if (count === 0 && !showZero) return null;

  const displayCount = count > max ? `${max}+` : count;

  return (
    <Badge
      variant="danger"
      size="sm"
      pill
      className={cn('vapor-notification-badge', className)}
      style={{
        position: 'absolute',
        top: '-6px',
        right: '-6px',
        minWidth: '18px',
        height: '18px',
        fontSize: '10px',
        lineHeight: '1',
      }}
      {...props}
    >
      {displayCount}
    </Badge>
  );
};

// StatusBadge 컴포넌트 - 상태 배지
export const StatusBadge = ({ 
  status = 'inactive',
  className = '',
  ...props 
}) => {
  const statusMap = {
    active: { variant: 'success', text: '활성' },
    inactive: { variant: 'secondary', text: '비활성' },
    pending: { variant: 'warning', text: '대기중' },
    error: { variant: 'danger', text: '오류' },
    online: { variant: 'success', text: '온라인' },
    offline: { variant: 'secondary', text: '오프라인' },
  };

  const statusConfig = statusMap[status] || statusMap.inactive;

  return (
    <Badge
      variant={statusConfig.variant}
      className={cn('vapor-status-badge', className)}
      {...props}
    >
      {statusConfig.text}
    </Badge>
  );
};

export default { Badge, NotificationBadge, StatusBadge };