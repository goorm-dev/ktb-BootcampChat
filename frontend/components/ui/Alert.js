import React from 'react';
import { ErrorCircleIcon, CheckCircleIcon, InfoCircleIcon, WarningIcon, CloseOutlineIcon } from '@vapor-ui/icons';
import { Button } from '@vapor-ui/core';
import { cn } from '../../utils/cn';

// Alert 컴포넌트 - Bootstrap alert 대체
export const Alert = ({ 
  children, 
  variant = 'info',
  dismissible = false,
  onClose,
  className = '',
  ...props 
}) => {
  const variants = {
    primary: {
      backgroundColor: 'var(--vapor-color-primary-light)',
      borderColor: 'var(--vapor-color-primary)',
      color: 'var(--vapor-color-primary-dark)',
      icon: InfoCircleIcon,
    },
    secondary: {
      backgroundColor: 'var(--vapor-color-secondary-light)',
      borderColor: 'var(--vapor-color-secondary)',
      color: 'var(--vapor-color-secondary-dark)',
      icon: InfoCircleIcon,
    },
    success: {
      backgroundColor: 'var(--vapor-color-success-light)',
      borderColor: 'var(--vapor-color-success)',
      color: 'var(--vapor-color-success-dark)',
      icon: CheckCircleIcon,
    },
    danger: {
      backgroundColor: 'var(--vapor-color-danger-light)',
      borderColor: 'var(--vapor-color-danger)',
      color: 'var(--vapor-color-danger-dark)',
      icon: ErrorCircleIcon,
    },
    warning: {
      backgroundColor: 'var(--vapor-color-warning-light)',
      borderColor: 'var(--vapor-color-warning)',
      color: 'var(--vapor-color-warning-dark)',
      icon: WarningIcon,
    },
    info: {
      backgroundColor: 'var(--vapor-color-info-light)',
      borderColor: 'var(--vapor-color-info)',
      color: 'var(--vapor-color-info-dark)',
      icon: InfoCircleIcon,
    },
  };

  const variantStyle = variants[variant] || variants.info;
  const Icon = variantStyle.icon;

  const alertStyles = {
    padding: 'var(--vapor-space-300)',
    borderRadius: 'var(--vapor-radius-md)',
    border: `1px solid ${variantStyle.borderColor}`,
    backgroundColor: variantStyle.backgroundColor,
    color: variantStyle.color,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 'var(--vapor-space-200)',
    position: 'relative',
  };

  return (
    <div
      style={alertStyles}
      className={cn('vapor-alert', className)}
      role="alert"
      {...props}
    >
      <Icon size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        {children}
      </div>
      {dismissible && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          style={{
            padding: 'var(--vapor-space-050)',
            minWidth: 'auto',
            marginLeft: 'var(--vapor-space-200)',
            color: 'inherit',
          }}
        >
          <CloseOutlineIcon size={16} />
        </Button>
      )}
    </div>
  );
};

// AlertHeading 컴포넌트
export const AlertHeading = ({ children, className = '', ...props }) => {
  return (
    <h4
      style={{
        marginBottom: 'var(--vapor-space-100)',
        fontSize: 'var(--vapor-font-size-lg)',
        fontWeight: 600,
        color: 'inherit',
      }}
      className={className}
      {...props}
    >
      {children}
    </h4>
  );
};

// AlertLink 컴포넌트
export const AlertLink = ({ children, href, className = '', ...props }) => {
  return (
    <a
      href={href}
      style={{
        color: 'inherit',
        fontWeight: 600,
        textDecoration: 'underline',
      }}
      className={className}
      {...props}
    >
      {children}
    </a>
  );
};

export default { Alert, AlertHeading, AlertLink };