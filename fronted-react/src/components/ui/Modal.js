import React, { useEffect } from 'react';
import { Button, Text } from '@vapor-ui/core';
import { CloseOutlineIcon } from '@vapor-ui/icons';

// Modal 컴포넌트 - Bootstrap Modal 대체
export const Modal = ({ 
  isOpen = false, 
  onClose, 
  title,
  children,
  size = 'md',
  className = '',
  ...props 
}) => {
  const sizes = {
    sm: '400px',
    md: '500px',
    lg: '800px',
    xl: '1140px',
  };

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose?.();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: 'var(--vapor-space-200)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--vapor-color-normal)',
          borderRadius: 'var(--vapor-radius-lg)',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
          maxWidth: sizes[size],
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        className={className}
        {...props}
      >
        {title && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--vapor-space-300) var(--vapor-space-400)',
              borderBottom: '1px solid var(--vapor-color-secondary)',
            }}
          >
            <Text typography="heading5">{title}</Text>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              style={{
                padding: 'var(--vapor-space-100)',
                minWidth: 'auto',
              }}
            >
              <CloseOutlineIcon size={16} />
            </Button>
          </div>
        )}
        <div
          style={{
            padding: title ? 'var(--vapor-space-400)' : 'var(--vapor-space-400)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

// ModalHeader 컴포넌트
export const ModalHeader = ({ children, onClose, className = '', ...props }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--vapor-space-300) var(--vapor-space-400)',
        borderBottom: '1px solid var(--vapor-color-secondary)',
      }}
      className={className}
      {...props}
    >
      {children}
      {onClose && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          style={{
            padding: 'var(--vapor-space-100)',
            minWidth: 'auto',
          }}
        >
          <CloseOutlineIcon size={16} />
        </Button>
      )}
    </div>
  );
};

// ModalBody 컴포넌트
export const ModalBody = ({ children, className = '', ...props }) => {
  return (
    <div
      style={{
        padding: 'var(--vapor-space-400)',
      }}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
};

// ModalFooter 컴포넌트
export const ModalFooter = ({ children, className = '', ...props }) => {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--vapor-space-200)',
        justifyContent: 'flex-end',
        padding: 'var(--vapor-space-300) var(--vapor-space-400)',
        borderTop: '1px solid var(--vapor-color-secondary)',
      }}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
};

export default { Modal, ModalHeader, ModalBody, ModalFooter };