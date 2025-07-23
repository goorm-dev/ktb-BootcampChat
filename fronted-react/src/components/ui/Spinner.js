import React from 'react';
import { cn } from '../../utils/cn';

// Spinner 컴포넌트 - Bootstrap spinner 대체
export const Spinner = ({ 
  size = 'md',
  color = 'primary',
  variant = 'border',
  className = '',
  ...props 
}) => {
  const sizes = {
    sm: {
      width: '16px',
      height: '16px',
      borderWidth: '2px',
    },
    md: {
      width: '24px',
      height: '24px',
      borderWidth: '3px',
    },
    lg: {
      width: '32px',
      height: '32px',
      borderWidth: '4px',
    },
  };

  const sizeStyle = sizes[size] || sizes.md;

  const borderSpinnerStyles = {
    ...sizeStyle,
    border: `${sizeStyle.borderWidth} solid var(--vapor-color-secondary)`,
    borderTopColor: `var(--vapor-color-${color})`,
    borderRadius: '50%',
    animation: 'vapor-spinner-border 0.75s linear infinite',
  };

  const growSpinnerStyles = {
    ...sizeStyle,
    backgroundColor: `var(--vapor-color-${color})`,
    borderRadius: '50%',
    animation: 'vapor-spinner-grow 0.75s linear infinite',
  };

  const spinnerStyles = variant === 'grow' ? growSpinnerStyles : borderSpinnerStyles;

  return (
    <>
      <style jsx>{`
        @keyframes vapor-spinner-border {
          to {
            transform: rotate(360deg);
          }
        }
        
        @keyframes vapor-spinner-grow {
          0%,
          80% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }
      `}</style>
      <div
        style={spinnerStyles}
        className={cn('vapor-spinner', className)}
        role="status"
        aria-label="Loading"
        {...props}
      />
    </>
  );
};

// SpinnerButton 컴포넌트 - 버튼 내부 스피너
export const SpinnerButton = ({ 
  children, 
  loading = false,
  spinnerSize = 'sm',
  spinnerColor = 'current',
  className = '',
  ...props 
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--vapor-space-100)',
      }}
      className={className}
      {...props}
    >
      {loading && (
        <Spinner 
          size={spinnerSize} 
          color={spinnerColor}
        />
      )}
      {children}
    </div>
  );
};

// LoadingOverlay 컴포넌트 - 전체 화면 로딩
export const LoadingOverlay = ({ 
  isLoading = false,
  text = '로딩 중...',
  className = '',
  ...props 
}) => {
  if (!isLoading) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        gap: 'var(--vapor-space-300)',
      }}
      className={className}
      {...props}
    >
      <Spinner size="lg" color="primary" />
      {text && (
        <div
          style={{
            fontSize: 'var(--vapor-font-size-md)',
            color: 'var(--vapor-color-gray-700)',
            fontWeight: 500,
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
};

export default { Spinner, SpinnerButton, LoadingOverlay };