import React, { useCallback, useEffect, useRef, useState, forwardRef } from 'react';
import { 
  LikeIcon,
  AttachFileOutlineIcon,
  SendIcon
} from '@vapor-ui/icons';
import { Button, IconButton } from '@vapor-ui/core';
import { Flex, HStack } from '../ui/Layout';
import MarkdownToolbar from './MarkdownToolbar';
import EmojiPicker from './EmojiPicker';
import MentionDropdown from './MentionDropdown';
import FilePreview from './FilePreview';
import fileService from '../../services/fileService';

const ChatInput = forwardRef(({
  message = '',
  onMessageChange = () => {},
  onSubmit = () => {},
  onEmojiToggle = () => {},
  onFileSelect = () => {},
  fileInputRef,
  disabled = false,
  uploading: externalUploading = false,
  showEmojiPicker = false,
  showMentionList = false,
  mentionFilter = '',
  mentionIndex = 0,
  getFilteredParticipants = () => [],
  setMessage = () => {},
  setShowEmojiPicker = () => {},
  setShowMentionList = () => {},
  setMentionFilter = () => {},
  setMentionIndex = () => {},
  room = null // room prop 추가
}, ref) => {
  const emojiPickerRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const dropZoneRef = useRef(null);
  const internalInputRef = useRef(null);
  const messageInputRef = ref || internalInputRef;
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });

  const handleFileValidationAndPreview = useCallback(async (file) => {
    if (!file) return;

    try {
      await fileService.validateFile(file);
      
      const filePreview = {
        file,
        url: URL.createObjectURL(file),
        name: file.name,
        type: file.type,
        size: file.size
      };
      
      setFiles(prev => [...prev, filePreview]);
      setUploadError(null);
      onFileSelect?.(file);
      
    } catch (error) {
      console.error('File validation error:', error);
      setUploadError(error.message);
    } finally {
      if (fileInputRef?.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [onFileSelect]);

  const handleFileRemove = useCallback((fileToRemove) => {
    setFiles(prev => prev.filter(file => file.name !== fileToRemove.name));
    URL.revokeObjectURL(fileToRemove.url);
    setUploadError(null);
    setUploadProgress(0);
  }, []);

  const handleFileDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    try {
      await handleFileValidationAndPreview(droppedFiles[0]);
    } catch (error) {
      console.error('File drop error:', error);
    }
  }, [handleFileValidationAndPreview]);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();

    if (files.length > 0) {
      try {
        const file = files[0];
        if (!file || !file.file) {
          throw new Error('파일이 선택되지 않았습니다.');
        }

        onSubmit({
          type: 'file',
          content: message.trim(),
          fileData: file
        });

        setMessage('');
        setFiles([]);

      } catch (error) {
        console.error('File submit error:', error);
        setUploadError(error.message);
      }
    } else if (message.trim()) {
      onSubmit({
        type: 'text',
        content: message.trim()
      });
      setMessage('');
    }
  }, [files, message, onSubmit, setMessage]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showEmojiPicker &&
        !emojiPickerRef.current?.contains(event.target) &&
        !emojiButtonRef.current?.contains(event.target)
      ) {
        setShowEmojiPicker(false);
      }
    };

    const handlePaste = async (event) => {
      if (!messageInputRef?.current?.contains(event.target)) return;

      const items = event.clipboardData?.items;
      if (!items) return;

      const fileItem = Array.from(items).find(
        item => item.kind === 'file' && 
        (item.type.startsWith('image/') || 
         item.type.startsWith('video/') || 
         item.type.startsWith('audio/') ||
         item.type === 'application/pdf')
      );

      if (!fileItem) return;

      const file = fileItem.getAsFile();
      if (!file) return;

      try {
        await handleFileValidationAndPreview(file);
        event.preventDefault();
      } catch (error) {
        console.error('File paste error:', error);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('paste', handlePaste);
      files.forEach(file => URL.revokeObjectURL(file.url));
    };
  }, [showEmojiPicker, setShowEmojiPicker, files, messageInputRef, handleFileValidationAndPreview]);

  const calculateMentionPosition = useCallback((textarea, atIndex) => {
    // Get all text before @ symbol
    const textBeforeAt = textarea.value.slice(0, atIndex);
    const lines = textBeforeAt.split('\n');
    const currentLineIndex = lines.length - 1;
    const currentLineText = lines[currentLineIndex];
    
    // Create a hidden div to measure exact text width
    const measureDiv = document.createElement('div');
    measureDiv.style.position = 'absolute';
    measureDiv.style.visibility = 'hidden';
    measureDiv.style.whiteSpace = 'pre';
    measureDiv.style.font = window.getComputedStyle(textarea).font;
    measureDiv.style.fontSize = window.getComputedStyle(textarea).fontSize;
    measureDiv.style.fontFamily = window.getComputedStyle(textarea).fontFamily;
    measureDiv.style.fontWeight = window.getComputedStyle(textarea).fontWeight;
    measureDiv.style.letterSpacing = window.getComputedStyle(textarea).letterSpacing;
    measureDiv.style.textTransform = window.getComputedStyle(textarea).textTransform;
    measureDiv.textContent = currentLineText;
    
    document.body.appendChild(measureDiv);
    const textWidth = measureDiv.offsetWidth;
    document.body.removeChild(measureDiv);
    
    // Get textarea position and compute styles
    const textareaRect = textarea.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(textarea);
    const paddingLeft = parseInt(computedStyle.paddingLeft);
    const paddingTop = parseInt(computedStyle.paddingTop);
    const lineHeight = parseInt(computedStyle.lineHeight) || (parseFloat(computedStyle.fontSize) * 1.5);
    const scrollTop = textarea.scrollTop;
    
    // Calculate exact position of @ symbol
    let left = textareaRect.left + paddingLeft + textWidth;
    // Position directly above the @ character (with small gap)
    let top = textareaRect.top + paddingTop + (currentLineIndex * lineHeight) - scrollTop;
    
    // Ensure dropdown stays within viewport
    const dropdownWidth = 320; // Approximate width
    const dropdownHeight = 250; // Approximate height
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Adjust horizontal position if needed
    if (left + dropdownWidth > viewportWidth) {
      left = viewportWidth - dropdownWidth - 10;
    }
    if (left < 10) {
      left = 10;
    }
    
    // Position dropdown 40px lower to be closer to the @ cursor
    top = top + 40; // Move 40px down from the cursor line
    
    // If not enough space above, show below
    if (top - dropdownHeight < 10) {
      top = textareaRect.top + paddingTop + ((currentLineIndex + 1) * lineHeight) - scrollTop + 2;
    } else {
      // Show above - adjust top to account for dropdown height
      top = top - dropdownHeight;
    }
    
    return { top, left };
  }, []);

  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    
    const textarea = e.target;
    textarea.style.height = 'auto';
    const maxHeight = parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.5 * 10;

    if (textarea.scrollHeight > maxHeight) {
      textarea.style.height = `${maxHeight}px`;
      textarea.style.overflowY = 'auto';
    } else {
      textarea.style.height = `${textarea.scrollHeight}px`;
      textarea.style.overflowY = 'hidden';
    }

    onMessageChange(e);

    if (lastAtSymbol !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtSymbol + 1);
      const hasSpaceAfterAt = textAfterAt.includes(' ');
      
      if (!hasSpaceAfterAt) {
        setMentionFilter(textAfterAt.toLowerCase());
        setShowMentionList(true);
        setMentionIndex(0);
        
        // Calculate and set mention dropdown position
        const position = calculateMentionPosition(textarea, lastAtSymbol);
        setMentionPosition(position);
        return;
      }
    }
    
    setShowMentionList(false);
  }, [onMessageChange, setMentionFilter, setShowMentionList, setMentionIndex, calculateMentionPosition]);

  const handleMentionSelect = useCallback((user) => {
    if (!messageInputRef?.current) return;

    const cursorPosition = messageInputRef.current.selectionStart;
    const textBeforeCursor = message.slice(0, cursorPosition);
    const textAfterCursor = message.slice(cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');

    if (lastAtSymbol !== -1) {
      const newMessage = 
        message.slice(0, lastAtSymbol) +
        `@${user.name} ` +
        textAfterCursor;

      setMessage(newMessage);
      setShowMentionList(false);

      setTimeout(() => {
        if (messageInputRef.current) {
          const newPosition = lastAtSymbol + user.name.length + 2;
          messageInputRef.current.focus();
          messageInputRef.current.setSelectionRange(newPosition, newPosition);
        }
      }, 0);
    }
  }, [message, setMessage, setShowMentionList, messageInputRef]);

  const handleKeyDown = useCallback((e) => {
    if (showMentionList) {
      const participants = getFilteredParticipants(room); // room 객체 전달
      const participantsCount = participants.length;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setMentionIndex(prev => 
            prev < participantsCount - 1 ? prev + 1 : 0
          );
          break;

        case 'ArrowUp':
          e.preventDefault();
          setMentionIndex(prev => 
            prev > 0 ? prev - 1 : participantsCount - 1
          );
          break;

        case 'Tab':
        case 'Enter':
          e.preventDefault();
          if (participantsCount > 0) {
            handleMentionSelect(participants[mentionIndex]);
          }
          break;

        case 'Escape':
          e.preventDefault();
          setShowMentionList(false);
          break;

        default:
          return;
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (message.trim() || files.length > 0) {
        handleSubmit(e);
      }
    } else if (e.key === 'Escape' && showEmojiPicker) {
      setShowEmojiPicker(false);
    }
  }, [
    message,
    files,
    showMentionList,
    showEmojiPicker,
    mentionIndex,
    getFilteredParticipants,
    handleMentionSelect,
    handleSubmit,
    setMentionIndex,
    setShowMentionList,
    setShowEmojiPicker,
    room // room 의존성 추가
  ]);

  const handleMarkdownAction = useCallback((markdown) => {
    if (!messageInputRef?.current) return;

    const input = messageInputRef.current;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selectedText = message.substring(start, end);
    let newText;
    let newCursorPos;
    let newSelectionStart;
    let newSelectionEnd;

    if (markdown.includes('
')) {
      

  

  const handleEmojiSelect = useCallback((emoji) => {
    if (!messageInputRef?.current) return;

    const cursorPosition = messageInputRef.current.selectionStart || message.length;
    const newMessage = 
      message.slice(0, cursorPosition) + 
      emoji.native + 
      message.slice(cursorPosition);
    
    setMessage(newMessage);
    setShowEmojiPicker(false);

    setTimeout(() => {
      if (messageInputRef.current) {
        const newCursorPosition = cursorPosition + emoji.native.length;
        messageInputRef.current.focus();
        messageInputRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
      }
    }, 0);
  }, [message, setMessage, setShowEmojiPicker, messageInputRef]);

  const toggleEmojiPicker = useCallback(() => {
    setShowEmojiPicker(prev => !prev);
  }, [setShowEmojiPicker]);

  const isDisabled = disabled || uploading || externalUploading;

  return (
    <>
      <div 
        className={`chat-input-wrapper ${isDragging ? 'dragging' : ''}`}
        ref={dropZoneRef}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDrop={handleFileDrop}
      >
      <div className="chat-input">
        {files.length > 0 && (
          <FilePreview
            files={files}
            uploading={uploading}
            uploadProgress={uploadProgress}
            uploadError={uploadError}
            onRemove={handleFileRemove}
            onRetry={() => setUploadError(null)}
            showFileName={true}
            showFileSize={true}
            variant="default"
          />
        )}

        <div className="chat-input-toolbar">
          <MarkdownToolbar 
            onAction={handleMarkdownAction}
            size="md"
          />
        </div>

        <div className="chat-input-main" style={{ position: 'relative' }}>
          <textarea
            ref={messageInputRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isDragging ? "파일을 여기에 놓아주세요." : "메시지를 입력하세요... (@를 입력하여 멘션, Shift + Enter로 줄바꿈)"}
            disabled={isDisabled}
            rows={1}
            autoComplete="off"
            spellCheck="true"
            className="chat-input-textarea"
            style={{
              minHeight: '40px',
              maxHeight: `${parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.5 * 10}px`,
              resize: 'none',
              width: '100%',
              border: '1px solid var(--vapor-color-border)',
              borderRadius: 'var(--vapor-radius-md)',
              padding: 'var(--vapor-space-150)',
              paddingRight: '120px', // Space for send button
              backgroundColor: 'var(--vapor-color-normal)',
              color: 'var(--vapor-color-text-primary)',
              fontSize: 'var(--vapor-font-size-100)',
              lineHeight: '1.5',
              transition: 'all 0.2s ease'
            }}
          />
          <Button
            color="primary"
            size="md"
            onClick={handleSubmit}
            disabled={isDisabled || (!message.trim() && files.length === 0)}
            aria-label="메시지 보내기"
            style={{ 
              position: 'absolute',
              bottom: '8px',
              right: '8px',
              padding: '8px 16px'
            }}
          >
            <SendIcon size={20} />
            <span style={{ marginLeft: 'var(--vapor-space-100)' }}>보내기</span>
          </Button>
        </div>

        <div className="chat-input-actions">
          {showEmojiPicker && (
            <div 
              ref={emojiPickerRef}
              className="emoji-picker-wrapper"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="emoji-picker-container">
                <EmojiPicker 
                  onSelect={handleEmojiSelect}
                  emojiSize={20}
                  emojiButtonSize={36}
                  perLine={8}
                  maxFrequentRows={4}
                />
              </div>
            </div>
          )}          
          <HStack gap="100">
            <IconButton
              ref={emojiButtonRef}
              variant="ghost"
              size="md"
              onClick={toggleEmojiPicker}
              disabled={isDisabled}
              aria-label="이모티콘"
              style={{ transition: 'all 0.2s ease' }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <LikeIcon size={20} />
            </IconButton>
            <IconButton
              variant="ghost"
              size="md"
              onClick={() => fileInputRef?.current?.click()}
              disabled={isDisabled}
              aria-label="파일 첨부"
              style={{ transition: 'all 0.2s ease' }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <AttachFileOutlineIcon size={20} />
            </IconButton>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileValidationAndPreview(e.target.files?.[0])}
              style={{ display: 'none' }}
              accept="image/*,video/*,audio/*,application/pdf"
            />
          </HStack>
        </div>
      </div>
      </div>

      {showMentionList && (
        <div
          style={{
            position: 'fixed',
            top: `${mentionPosition.top}px`,
            left: `${mentionPosition.left}px`,
            zIndex: 9999
          }}
        >
          <MentionDropdown
            participants={getFilteredParticipants(room)}
            activeIndex={mentionIndex}
            onSelect={handleMentionSelect}
            onMouseEnter={(index) => setMentionIndex(index)}
          />
        </div>
      )}
    </>
  );
});

ChatInput.displayName = 'ChatInput';

export default ChatInput;

ChatInput.displayName = 'ChatInput';

export default ChatInput;