import React, { useState, useRef, useEffect } from 'react';
import { Button, Text } from '@vapor-ui/core';
import { CaretDownIcon } from '@vapor-ui/icons';

// Dropdown 컴포넌트 - Bootstrap dropdown 대체
export const Dropdown = ({ 
  children, 
  trigger, 
  placement = 'bottom-start',
  className = '',
  ...props 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getDropdownPosition = () => {
    const positions = {
      'bottom-start': { top: '100%', left: '0' },
      'bottom-end': { top: '100%', right: '0' },
      'top-start': { bottom: '100%', left: '0' },
      'top-end': { bottom: '100%', right: '0' },
    };
    return positions[placement] || positions['bottom-start'];
  };

  return (
    <div 
      ref={dropdownRef}
      style={{ position: 'relative', display: 'inline-block' }}
      className={className}
      {...props}
    >
      <div onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            ...getDropdownPosition(),
            backgroundColor: 'var(--vapor-color-normal)',
            border: '1px solid var(--vapor-color-secondary)',
            borderRadius: 'var(--vapor-radius-md)',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            minWidth: '160px',
            padding: 'var(--vapor-space-100)',
            marginTop: 'var(--vapor-space-025)',
          }}
        >
          {React.Children.map(children, child => 
            React.cloneElement(child, { 
              onClose: () => setIsOpen(false) 
            })
          )}
        </div>
      )}
    </div>
  );
};

// DropdownItem 컴포넌트
export const DropdownItem = ({ 
  children, 
  onClick, 
  onClose,
  disabled = false,
  className = '',
  ...props 
}) => {
  const handleClick = (e) => {
    if (!disabled) {
      onClick?.(e);
      onClose?.();
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        padding: 'var(--vapor-space-100) var(--vapor-space-200)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        borderRadius: 'var(--vapor-radius-sm)',
        opacity: disabled ? 0.5 : 1,
        transition: 'background-color 0.2s ease',
        ':hover': !disabled ? {
          backgroundColor: 'var(--vapor-color-secondary)',
        } : undefined,
      }}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
};

// DropdownDivider 컴포넌트
export const DropdownDivider = ({ className = '', ...props }) => {
  return (
    <div
      style={{
        height: '1px',
        backgroundColor: 'var(--vapor-color-secondary)',
        margin: 'var(--vapor-space-100) 0',
      }}
      className={className}
      {...props}
    />
  );
};

// DropdownHeader 컴포넌트
export const DropdownHeader = ({ children, className = '', ...props }) => {
  return (
    <div
      style={{
        padding: 'var(--vapor-space-100) var(--vapor-space-200)',
        fontSize: 'var(--vapor-font-size-sm)',
        fontWeight: 600,
        color: 'var(--vapor-color-gray-700)',
        borderBottom: '1px solid var(--vapor-color-secondary)',
        marginBottom: 'var(--vapor-space-100)',
      }}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
};

// DropdownButton 컴포넌트 - Bootstrap dropdown-toggle 대체
export const DropdownButton = ({ 
  children, 
  variant = 'outline', 
  size = 'md',
  disabled = false,
  className = '',
  ...props 
}) => {
  return (
    <Button
      variant={variant}
      size={size}
      disabled={disabled}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--vapor-space-100)',
      }}
      {...props}
    >
      {children}
      <CaretDownIcon size={16} />
    </Button>
  );
};

export default { Dropdown, DropdownItem, DropdownDivider, DropdownHeader, DropdownButton };