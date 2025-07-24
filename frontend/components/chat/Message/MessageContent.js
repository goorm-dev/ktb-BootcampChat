import React, { useMemo, useCallback, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkEmoji from 'remark-emoji';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { CopyIcon, CorrectOutlineIcon } from '@vapor-ui/icons';
import { Text } from '@vapor-ui/core';
import { Toast } from '../../Toast';

const MessageContent = ({ content, isAI = false }) => {
  const [copyingMap, setCopyingMap] = useState(new Map());

  // 복사 기능 구현
  const copyToClipboard = useCallback(async (text, blockId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyingMap(prev => new Map(prev).set(blockId, true));
      Toast.success('코드가 클립보드에 복사되었습니다.');

      // 1초 후 복사 상태 초기화
      setTimeout(() => {
        setCopyingMap(prev => {
          const newMap = new Map(prev);
          newMap.delete(blockId);
          return newMap;
        });
      }, 1000);
    } catch (err) {
      console.error('Failed to copy:', err);
      Toast.error('복사에 실패했습니다.');
    }
  }, []);

  // 멘션 패턴을 찾아서 React 엘리먼트로 변환하는 함수
  const renderContentWithMentions = useMemo(() => (text) => {
    const mentionPattern = /@(wayneAI|consultingAI|[\w.-]+)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionPattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {text.slice(lastIndex, match.index)}
          </span>
        );
      }

      const mentionedName = match[1];
      const isAIMention = mentionedName === 'wayneAI' || mentionedName === 'consultingAI';
      const displayName = isAIMention
        ? (mentionedName === 'wayneAI' ? 'Wayne AI' : 'Consulting AI')
        : mentionedName;

      const mentionClass = isAIMention
        ? `mention mention-bot ${mentionedName === 'wayneAI' ? 'mention-wayne' : 'mention-consulting'}`
        : 'mention mention-user';

      parts.push(
        <span
          key={`mention-${match.index}`}
          className={mentionClass}
        >
          @{displayName}
        </span>
      );

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {text.slice(lastIndex)}
        </span>
      );
    }

    return parts;
  }, []);

  // 마크다운 렌더링을 위한 커스텀 컴포넌트
  const components = useMemo(() => ({
    p: ({ children }) => {
      if (
        children.length === 1 &&
        typeof children[0] === 'string' &&
        !children[0].includes('\n')
      ) {
        return <Text typography="body2">{renderContentWithMentions(children[0])}</Text>;
      }
      return <Text typography="body2">{children}</Text>;
    },
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const blockId = Math.random().toString(36).substr(2, 9);

      return !inline && match ? (
        <div className="relative group">
          <button
            onClick={() => copyToClipboard(String(children).replace(/\n$/, ''), blockId)}
            className="absolute right-2 top-2 p-2 rounded bg-gray-800/50 hover:bg-gray-800/80 transition-all duration-200 opacity-0 group-hover:opacity-100 z-10"
            title="코드 복사"
          >
            {copyingMap.get(blockId) ? (
              <CorrectOutlineIcon size={16} style={{ color: 'var(--vapor-color-success)' }} />
            ) : (
              <CopyIcon size={16} style={{ color: 'var(--vapor-color-gray-500)' }} />
            )}
          </button>
          <SyntaxHighlighter
            style={tomorrow}
            language={match[1]}
            PreTag="div"
            showLineNumbers={true}
            wrapLines={true}
            {...props}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code
          className="rounded px-1.5 py-0.5 text-sm bg-black/10"
          {...props}
        >
          {children}
        </code>
      );
    },
    h1: ({ node, children, ...props }) => (
      <h1 className="md-heading md-h1" {...props}>
        {children}
      </h1>
    ),
    h2: ({ node, children, ...props }) => (
      <h2 className="md-heading md-h2" {...props}>
        {children}
      </h2>
    ),
    h3: ({ node, children, ...props }) => (
      <h3 className="md-heading md-h3" {...props}>
        {children}
      </h3>
    ),
    ul: ({ node, children, ...props }) => (
      <ul className="md-list md-ul" {...props}>
        {children}
      </ul>
    ),
    ol: ({ node, children, ...props }) => (
      <ol className="md-list md-ol" {...props}>
        {children}
      </ol>
    ),
    li: ({ node, children, ...props }) => {
      // 체크박스가 포함된 리스트 아이템인지 확인
      const hasCheckbox = node.children.some(child =>
        child.type === 'element' &&
        child.tagName === 'input' &&
        child.properties.type === 'checkbox'
      );

      return (
        <li
          className={`md-list-item ${hasCheckbox ? 'list-none' : ''}`}
          {...props}
        >
          {children}
        </li>
      );
	  },
    a: ({ node, children, href, ...props }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="md-link"
        {...props}
      >
        {children}
      </a>
    ),
    img: ({ node, src, alt, ...props }) => (
      <img
        src={src}
        alt={alt}
        className="md-image"
        loading="lazy"
        onError={(e) => {
          e.target.src = '/placeholder-image.png';
        }}
        {...props}
      />
    ),
    table: ({ node, children, ...props }) => (
      <div className="md-table-wrapper">
        <table className="md-table" {...props}>
          {children}
        </table>
      </div>
    ),
    blockquote: ({ node, children, ...props }) => (
      <blockquote className="md-blockquote" {...props}>
        {children}
      </blockquote>
    ),
    em: ({ node, children, ...props }) => (
      <em className="md-italic" {...props}>
        {children}
      </em>
    ),
    strong: ({ node, children, ...props }) => (
      <strong className="md-bold" {...props}>
        {children}
      </strong>
    )
  }), [renderContentWithMentions, copyToClipboard, copyingMap]);

  // 순수 텍스트 내용 여부 확인
  // const isPlainText = useMemo(() => {
  //   return typeof content === 'string' &&
  //          !content.includes('```') &&
  //          !content.includes('`') &&
  //          !content.includes('#') &&
  //          !content.includes('*') &&
  //          !content.includes('_') &&
  //          !content.includes('[') &&
  //          !content.includes('|');
  // }, [content]);

  if (typeof content !== 'string') {
    return String(content);
  }

  // 멘션이 포함된 경우 직접 렌더링
  if (content.includes('@')) {
    return <Text typography="body2" className="message-text">{renderContentWithMentions(content)}</Text>;
  }

  // 마크다운 콘텐츠의 경우 ReactMarkdown 사용
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks, remarkEmoji]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
};

export default React.memo(MessageContent);
