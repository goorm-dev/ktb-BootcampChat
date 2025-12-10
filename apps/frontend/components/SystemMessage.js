import React from 'react';
import { VStack, Text } from '@vapor-ui/core';

const SystemMessage = ({ msg }) => {
  const formattedTime = new Date(msg.timestamp).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/\./g, '년').replace(/\s/g, ' ').replace('일 ', '일 ');

  return (
    <VStack
      gap="$050"
      padding="$100 $200"
      margin="$100 0"
      className="self-center rounded-xl backdrop-blur-md bg-v-gray-100/50"
    >
      <Text typography="subtitle1" className="text-v-gray-500">
        {msg.content}
      </Text>
      {formattedTime && (
        <Text typography="subtitle2" className="opacity-50 text-v-gray-500 text-center">
          {formattedTime}
        </Text>
      )}
    </VStack>
  );
};

export default React.memo(SystemMessage);