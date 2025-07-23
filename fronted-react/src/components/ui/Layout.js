import React from 'react';
import { cn } from '../../utils/cn';

// Flex 컴포넌트 - Bootstrap d-flex 대체
export const Flex = ({ 
  children, 
  direction = 'row', 
  justify = 'start', 
  align = 'start', 
  wrap = 'nowrap',
  gap = '0',
  className = '',
  ...props 
}) => {
  const flexStyles = {
    display: 'flex',
    flexDirection: direction,
    justifyContent: justify,
    alignItems: align,
    flexWrap: wrap,
    gap: `var(--vapor-space-${gap})`,
  };

  return (
    <div 
      style={flexStyles}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
};

// Grid 컴포넌트 - Bootstrap d-grid 대체
export const Grid = ({ 
  children, 
  cols = 1, 
  gap = '200',
  className = '',
  ...props 
}) => {
  const gridStyles = {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap: `var(--vapor-space-${gap})`,
  };

  return (
    <div 
      style={gridStyles}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
};

// Container 컴포넌트 - Bootstrap container 대체
export const Container = ({ 
  children, 
  maxWidth = '1200px',
  padding = '300',
  className = '',
  ...props 
}) => {
  const containerStyles = {
    maxWidth,
    margin: '0 auto',
    padding: `0 var(--vapor-space-${padding})`,
    width: '100%',
  };

  return (
    <div 
      style={containerStyles}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
};

// Spacer 컴포넌트 - Bootstrap margin/padding 대체
export const Spacer = ({ 
  size = '200',
  direction = 'vertical',
  className = '',
  ...props 
}) => {
  const spacerStyles = {
    [direction === 'vertical' ? 'height' : 'width']: `var(--vapor-space-${size})`,
    flexShrink: 0,
  };

  return (
    <div 
      style={spacerStyles}
      className={className}
      {...props}
    />
  );
};

// Box 컴포넌트 - 범용 레이아웃 컴포넌트
export const Box = ({ 
  children, 
  p = '0',
  px = null,
  py = null,
  pt = null,
  pb = null,
  pl = null,
  pr = null,
  m = '0',
  mx = null,
  my = null,
  mt = null,
  mb = null,
  ml = null,
  mr = null,
  bg = null,
  border = false,
  borderRadius = null,
  shadow = false,
  position = null,
  top = null,
  bottom = null,
  left = null,
  right = null,
  width = null,
  height = null,
  className = '',
  ...props 
}) => {
  const boxStyles = {
    // Padding
    padding: p !== '0' ? `var(--vapor-space-${p})` : undefined,
    paddingLeft: (px !== null ? `var(--vapor-space-${px})` : pl !== null ? `var(--vapor-space-${pl})` : undefined),
    paddingRight: (px !== null ? `var(--vapor-space-${px})` : pr !== null ? `var(--vapor-space-${pr})` : undefined),
    paddingTop: (py !== null ? `var(--vapor-space-${py})` : pt !== null ? `var(--vapor-space-${pt})` : undefined),
    paddingBottom: (py !== null ? `var(--vapor-space-${py})` : pb !== null ? `var(--vapor-space-${pb})` : undefined),
    
    // Margin
    margin: m !== '0' ? `var(--vapor-space-${m})` : undefined,
    marginLeft: (mx !== null ? `var(--vapor-space-${mx})` : ml !== null ? `var(--vapor-space-${ml})` : undefined),
    marginRight: (mx !== null ? `var(--vapor-space-${mx})` : mr !== null ? `var(--vapor-space-${mr})` : undefined),
    marginTop: (my !== null ? `var(--vapor-space-${my})` : mt !== null ? `var(--vapor-space-${mt})` : undefined),
    marginBottom: (my !== null ? `var(--vapor-space-${my})` : mb !== null ? `var(--vapor-space-${mb})` : undefined),
    
    // Background
    backgroundColor: bg ? `var(--vapor-color-${bg})` : undefined,
    
    // Border
    border: border ? `1px solid var(--vapor-color-secondary)` : undefined,
    borderRadius: borderRadius ? `var(--vapor-radius-${borderRadius})` : undefined,
    
    // Shadow
    boxShadow: shadow ? '0 1px 3px rgba(0, 0, 0, 0.1)' : undefined,
    
    // Position
    position,
    top,
    bottom,
    left,
    right,
    
    // Size
    width,
    height,
  };

  // Remove undefined values
  Object.keys(boxStyles).forEach(key => {
    if (boxStyles[key] === undefined) {
      delete boxStyles[key];
    }
  });

  return (
    <div 
      style={boxStyles}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
};

// Stack 컴포넌트 - 수직 스택 레이아웃
export const Stack = ({ 
  children, 
  gap = '200',
  align = 'stretch',
  className = '',
  ...props 
}) => {
  return (
    <Flex 
      direction="column" 
      gap={gap} 
      align={align}
      className={className}
      {...props}
    >
      {children}
    </Flex>
  );
};

// HStack 컴포넌트 - 수평 스택 레이아웃
export const HStack = ({ 
  children, 
  gap = '200',
  align = 'center',
  justify = 'start',
  className = '',
  ...props 
}) => {
  return (
    <Flex 
      direction="row" 
      gap={gap} 
      align={align}
      justify={justify}
      className={className}
      {...props}
    >
      {children}
    </Flex>
  );
};

// Center 컴포넌트 - 중앙 정렬
export const Center = ({ 
  children, 
  className = '',
  ...props 
}) => {
  return (
    <Flex 
      justify="center" 
      align="center"
      className={className}
      {...props}
    >
      {children}
    </Flex>
  );
};

export default {
  Flex,
  Grid,
  Container,
  Spacer,
  Box,
  Stack,
  HStack,
  Center,
};