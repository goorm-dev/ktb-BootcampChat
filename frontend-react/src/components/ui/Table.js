import React from 'react';
import { Text } from '@vapor-ui/core';
import { cn } from '../../utils/cn';

// Table 컴포넌트 - Bootstrap table 대체
export const Table = ({ 
  children, 
  striped = false,
  bordered = false,
  hover = false,
  responsive = false,
  size = 'md',
  className = '',
  ...props 
}) => {
  const tableStyles = {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: 'var(--vapor-color-normal)',
    borderRadius: 'var(--vapor-radius-md)',
    overflow: 'hidden',
    ...(bordered && {
      border: '1px solid var(--vapor-color-secondary)',
    }),
  };

  const tableClass = cn(
    'vapor-table',
    striped && 'vapor-table-striped',
    hover && 'vapor-table-hover',
    `vapor-table-${size}`,
    className
  );

  const table = (
    <table
      style={tableStyles}
      className={tableClass}
      {...props}
    >
      {children}
    </table>
  );

  if (responsive) {
    return (
      <div style={{ 
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        border: '1px solid var(--vapor-color-secondary)',
        borderRadius: 'var(--vapor-radius-md)',
      }}>
        {table}
      </div>
    );
  }

  return table;
};

// TableHead 컴포넌트
export const TableHead = ({ children, className = '', ...props }) => {
  return (
    <thead
      style={{
        backgroundColor: 'var(--vapor-color-gray-100)',
        borderBottom: '2px solid var(--vapor-color-secondary)',
      }}
      className={className}
      {...props}
    >
      {children}
    </thead>
  );
};

// TableBody 컴포넌트
export const TableBody = ({ children, className = '', ...props }) => {
  return (
    <tbody className={className} {...props}>
      {children}
    </tbody>
  );
};

// TableRow 컴포넌트
export const TableRow = ({ 
  children, 
  active = false,
  className = '',
  ...props 
}) => {
  return (
    <tr
      style={{
        ...(active && {
          backgroundColor: 'var(--vapor-color-primary-light)',
        }),
        borderBottom: '1px solid var(--vapor-color-secondary)',
      }}
      className={className}
      {...props}
    >
      {children}
    </tr>
  );
};

// TableHeader 컴포넌트 (th)
export const TableHeader = ({ 
  children, 
  width,
  align = 'left',
  className = '',
  ...props 
}) => {
  return (
    <th
      style={{
        padding: 'var(--vapor-space-200) var(--vapor-space-300)',
        textAlign: align,
        fontWeight: 600,
        fontSize: 'var(--vapor-font-size-sm)',
        color: 'var(--vapor-color-gray-700)',
        ...(width && { width }),
      }}
      className={className}
      {...props}
    >
      {children}
    </th>
  );
};

// TableCell 컴포넌트 (td)
export const TableCell = ({ 
  children, 
  align = 'left',
  className = '',
  ...props 
}) => {
  return (
    <td
      style={{
        padding: 'var(--vapor-space-200) var(--vapor-space-300)',
        textAlign: align,
        fontSize: 'var(--vapor-font-size-md)',
        borderBottom: '1px solid var(--vapor-color-secondary)',
      }}
      className={className}
      {...props}
    >
      {children}
    </td>
  );
};

// TableCaption 컴포넌트
export const TableCaption = ({ children, className = '', ...props }) => {
  return (
    <caption
      style={{
        paddingTop: 'var(--vapor-space-200)',
        paddingBottom: 'var(--vapor-space-200)',
        color: 'var(--vapor-color-gray-600)',
        textAlign: 'left',
        fontSize: 'var(--vapor-font-size-sm)',
      }}
      className={className}
      {...props}
    >
      {children}
    </caption>
  );
};

export default { 
  Table, 
  TableHead, 
  TableBody, 
  TableRow, 
  TableHeader, 
  TableCell, 
  TableCaption 
};