import React, { useMemo } from 'react';
import { Text, Badge } from '@vapor-ui/core';

const MessageContent = ({ content }) => {
  // 멘션 패턴을 찾아서 React 엘리먼트로 변환하는 함수
  const renderContentWithMentions = useMemo(() => (text) => {
    const mentionPattern = /@([\w.-]+)/g;
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

      parts.push(
        <Badge
          key={`mention-${match.index}`}
          colorPalette="primary"
          shape="square"
          size="sm"
        >
          @{mentionedName}
        </Badge>
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

  if (typeof content !== 'string') {
    return String(content);
  }

  // 줄바꿈을 처리하여 렌더링
  const lines = content.split('\n');
  
  return (
    <Text typography="body2" className="message-text" style={{ whiteSpace: 'pre-wrap' }}>
      {lines.map((line, index) => (
        <React.Fragment key={index}>
          {line.includes('@') ? renderContentWithMentions(line) : line}
          {index < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </Text>
  );
};

export default React.memo(MessageContent);