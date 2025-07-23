import React, { useCallback } from 'react';
import {
  BoldOutlineIcon as Bold,
  ItalicIcon as Italic,
  CodeBlockIcon as Code,
  CodeBlockOutlineIcon as FileCode2,
  BulletlistOutlineIcon as List,
  NumberlistOutlineIcon as ListOrdered,
  QuoteOutlineIcon as Quote,
  HeadingOutlineIcon as Heading2,
  LinkOutlineIcon as Link2
} from '@vapor-ui/icons';
import { IconButton } from '@vapor-ui/core';
import { HStack } from '../ui/Layout';

const MarkdownToolbar = ({ onAction, className = '', size = 'xs' }) => {
  // OS 확인
  const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modifierKey = isMac ? '⌘' : 'Ctrl';
  
  const toolbarActions = [
    { 
      id: 'bold',
      icon: Bold, 
      markdown: '**',
      tooltip: '굵게',
      shortcut: `${modifierKey}+B`,
      keyBinding: { key: 'b', modifier: true }
    },
    { 
      id: 'italic',
      icon: Italic, 
      markdown: '_',
      tooltip: '기울임',
      shortcut: `${modifierKey}+I`,
      keyBinding: { key: 'i', modifier: true }
    },
    { 
      id: 'inline-code',
      icon: Code, 
      markdown: '`',
      tooltip: '인라인 코드',
      shortcut: `${modifierKey}+\``,
      keyBinding: { key: '`', modifier: true }
    },
    { 
      id: 'code-block',
      icon: FileCode2, 
      markdown: '```\n\n```',
      tooltip: '코드 블록',
      shortcut: `${modifierKey}+Shift+C`,
      keyBinding: { key: 'c', modifier: true, shift: true }
    },
    { 
      id: 'bullet-list',
      icon: List, 
      markdown: '- ',
      tooltip: '글머리 기호',
      shortcut: `${modifierKey}+U`,
      keyBinding: { key: 'u', modifier: true }
    },
    { 
      id: 'numbered-list',
      icon: ListOrdered, 
      markdown: '1. ',
      tooltip: '번호 매기기',
      shortcut: `${modifierKey}+O`,
      keyBinding: { key: 'o', modifier: true }
    },
    { 
      id: 'quote',
      icon: Quote, 
      markdown: '> ',
      tooltip: '인용',
      shortcut: `${modifierKey}+Q`,
      keyBinding: { key: 'q', modifier: true }
    },
    { 
      id: 'heading',
      icon: Heading2, 
      markdown: '## ',
      tooltip: '제목',
      shortcut: `${modifierKey}+H`,
      keyBinding: { key: 'h', modifier: true }
    },
    { 
      id: 'link',
      icon: Link2, 
      markdown: '[](url)',
      tooltip: '링크',
      shortcut: `${modifierKey}+K`,
      keyBinding: { key: 'k', modifier: true }
    }
  ];

  const handleKeyDown = useCallback((e) => {
    const isModifierPressed = isMac ? e.metaKey : e.ctrlKey;
    
    const action = toolbarActions.find(action => {
      const kb = action.keyBinding;
      return kb.key === e.key.toLowerCase() &&
        kb.modifier === isModifierPressed &&
        (!kb.shift || kb.shift === e.shiftKey);
    });

    if (action) {
      e.preventDefault();
      onAction(action.markdown);
    }
  }, [onAction, isMac, toolbarActions]);

  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const ToolbarButton = ({ action }) => {
    const Icon = action.icon;
    return (
      <IconButton
        variant="ghost"
        size="md"
        onClick={() => onAction(action.markdown)}
        aria-label={`${action.tooltip} (${action.shortcut})`}
        title={`${action.tooltip} (${action.shortcut})`}
      >
        <Icon size={20} />
      </IconButton>
    );
  };

  return (
    <div className={`markdown-toolbar ${className}`}>
      <HStack gap="050" role="group" aria-label="Markdown toolbar">
        {toolbarActions.map((action) => (
          <ToolbarButton key={action.id} action={action} />
        ))}
      </HStack>
    </div>
  );
};

export default MarkdownToolbar;