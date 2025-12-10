// components/EmojiPicker.js

import React from 'react';
import data from '@emoji-mart/data/sets/14/native';
import Picker from '@emoji-mart/react';

function EmojiPicker({ onSelect }) {
  return (
    <Picker
      data={data}
      onEmojiSelect={onSelect}
      theme="light"
      set="native"
      locale="ko"
      previewPosition="none"
      skinTonePosition="none"
      emojiButtonSize={30}
      emojiSize={20}
      maxFrequentRows={4}
      perLine={9}
    />
  );
}

export default EmojiPicker;