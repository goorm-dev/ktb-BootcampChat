import React, { useCallback, useEffect, useRef, useState, forwardRef } from 'react';
import { Button } from '@goorm-dev/vapor-components';
import { 
  Smile,
  Paperclip,
  Send
} from 'lucide-react';
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
        return;
      }
    }
    
    setShowMentionList(false);
  }, [onMessageChange, setMentionFilter, setShowMentionList, setMentionIndex]);

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
      const participants = getFilteredParticipants(room);
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
      // IME 입력 중인지 확인
      if (e.isComposing || e.keyCode === 229) {
        return;
      }

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
    room
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

    if (markdown.includes('\n')) {
      newText = message.substring(0, start) +
                markdown.replace('\n\n', '\n' + selectedText + '\n') +
                message.substring(end);
      if (selectedText) {
        newSelectionStart = start + markdown.split('\n')[0].length + 1;
        newSelectionEnd = newSelectionStart + selectedText.length;
        newCursorPos = newSelectionEnd;
      } else {
        newCursorPos = start + markdown.indexOf('\n') + 1;
        newSelectionStart = newCursorPos;
        newSelectionEnd = newCursorPos;
      }
    } else if (markdown.endsWith(' ')) {
      newText = message.substring(0, start) +
                markdown + selectedText +
                message.substring(end);
      newCursorPos = start + markdown.length + selectedText.length;
      newSelectionStart = newCursorPos;
      newSelectionEnd = newCursorPos;
    } else {
      newText = message.substring(0, start) +
                markdown + selectedText + markdown +
                message.substring(end);
      if (selectedText) {
        newSelectionStart = start + markdown.length;
        newSelectionEnd = newSelectionStart + selectedText.length;
      } else {
        newSelectionStart = start + markdown.length;
        newSelectionEnd = newSelectionStart;
      }
      newCursorPos = newSelectionEnd;
    }

    setMessage(newText);

    setTimeout(() => {
      if (messageInputRef.current) {
        input.focus();
        input.setSelectionRange(newSelectionStart, newSelectionEnd);
        if (selectedText) {
          input.setSelectionRange(newCursorPos, newCursorPos);
        }
      }
    }, 0);
  }, [message, setMessage, messageInputRef]);

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
            size="sm"
          />
        </div>

        <div className="chat-input-main">
          {showMentionList && (
            <MentionDropdown
              participants={getFilteredParticipants(room)} // room 객체 전달
              activeIndex={mentionIndex}
              onSelect={handleMentionSelect}
              onMouseEnter={(index) => setMentionIndex(index)}
            />
          )}
          <textarea
            ref={messageInputRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isDragging ? "파일을 여기에 놓아주세요." : "메시지를 입력하세요... (@를 입력하여 멘션, Shift + Enter로 줄바꿈)"}
            disabled={isDisabled}
            className={`${isDragging ? 'dragging' : ''} chat-input-textarea`}
            rows={1}
            autoComplete="off"
            spellCheck="true"
            style={{
              minHeight: '40px',
              maxHeight: `${parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.5 * 10}px`
            }}
          />
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
          <div className="chat-input-actions-left">
            <Button
              ref={emojiButtonRef}
              variant="ghost"
              onClick={toggleEmojiPicker}
              disabled={isDisabled}
              className="toolbar-button"
              title="이모티콘"
            >
              <Smile className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => fileInputRef?.current?.click()}
              disabled={isDisabled}
              className="toolbar-button"
              title="파일 첨부"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileValidationAndPreview(e.target.files?.[0])}
              className="hidden"
              accept="image/*,video/*,audio/*,application/pdf"
            />
          </div>

          <Button
            variant="ghost"
            onClick={handleSubmit}
            disabled={isDisabled || (!message.trim() && files.length === 0)}
            className="toolbar-button"
            title="메시지 보내기"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
});

ChatInput.displayName = 'ChatInput';

export default ChatInput;