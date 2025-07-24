// Updated ChatInput.js with Detective Mode button in input area
import debounce from 'lodash.debounce';
import React, { useCallback, useEffect, useRef, useState, forwardRef } from 'react';
import {
  LikeIcon,
  AttachFileOutlineIcon,
  SendIcon
} from '@vapor-ui/icons';
import { Button, IconButton } from '@vapor-ui/core';
import { Flex, HStack } from '../ui/Layout';
import { Gamepad2 } from 'lucide-react';
import MarkdownToolbar from './MarkdownToolbar';
import EmojiPicker from './EmojiPicker';
import MentionDropdown from './MentionDropdown';
import FilePreview from './FilePreview';
import VoiceRecorder from './VoiceRecorder';
import fileService from '../../services/fileService';

const ChatInput = forwardRef(({
  message = '',
  onMessageChange = () => { },
  onSubmit = () => { },
  onEmojiToggle = () => { },
  onFileSelect = () => { },
  fileInputRef,
  disabled = false,
  uploading: externalUploading = false,
  showEmojiPicker = false,
  showMentionList = false,
  mentionFilter = '',
  mentionIndex = 0,
  getFilteredParticipants = () => [],
  setMessage = () => { },
  setShowEmojiPicker = () => { },
  setShowMentionList = () => { },
  setMentionFilter = () => { },
  setMentionIndex = () => { },
  room = null,
  socketRef = null,
  detectiveMode = false,
  onDetectiveToggle = () => { },
  detectiveGameActive = false,
  canStartDetectiveGame = true,
  detectiveGameStarting = false,
  placeholder = "메시지를 입력하거나 🎤 버튼으로 음성 입력... (@를 입력하여 멘션, Shift + Enter로 줄바꿈)"
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
  const [mentionPosition, setMentionPosition] = useState({top: 0, left: 0});
  const [voiceError, setVoiceError] = useState(null);
  const [showGameRules, setShowGameRules] = useState(false);
  const [hasSentDetectiveIntro, setHasSentDetectiveIntro] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);

  // Handle detective game start
  const handleDetectiveStart = useCallback(() => {
    console.log('🎮 Detective game start clicked', { canStartDetectiveGame, detectiveGameActive });
    
    if (!canStartDetectiveGame) {
      // Show message if someone else is already playing
      setMessage(prev => prev + ' (다른 사용자가 이미 탐정 게임을 플레이 중입니다.)');
      return;
    }

    console.log('🎮 Toggling detective mode...');
    onDetectiveToggle();

    // Send game instructions as system message when turning ON detective mode
    if (!detectiveGameActive && !detectiveMode) {
      console.log('🕵️ Sending detective instructions...');
      setTimeout(() => {
        onSubmit({
          type: 'system',
          subType: 'detective_instructions',
          content: `🕵️ **2030년 사이버 범죄 수사 게임**

**사건 개요:**
2030년 3월 15일 새벽 3시, 회사의 핵심 서비스가 갑자기 다운되었습니다. 사용자 데이터베이스 연결이 끊어지면서 전체 시스템이 마비되었고, 약 2시간 동안 50만 명의 사용자가 서비스를 이용할 수 없었습니다. 추정 손실액은 약 3억 원에 달합니다.

사건 후 조사 결과, 누군가가 정상적인 CI/CD 프로세스를 무시하고 프로덕션 환경에 직접 코드를 배포했다는 정황이 발견되었습니다. 더군다나 그 흔적을 숨기기 위해 중요한 시스템 로그들까지 삭제된 상태였습니다.

**당신의 역할: 🔍 수사관**
- 용의자 **Steve**를 심문하여 자백을 받아내야 합니다
- Steve는 15년 경력의 시니어 개발자로 시스템 관리와 Git 운영 전문가입니다
- 항상 **@smokinggun**으로 태그하여 대화하세요

**승리 조건:**
다음 두 가지 핵심 증거를 **모두** 제시해야 Steve가 자백합니다:
1. **프로덕션에 직접 force push한 증거**
2. **로그를 삭제하여 흔적을 지운 증거**

**수사 팁:**
- Steve는 회피적이고 변명을 많이 할 것입니다
- Jenkins나 다른 개발자들을 탓하며 책임을 회피할 것입니다
- 기술적 전문용어로 혼란시키려 할 것입니다
- "force push", "git push --force", "로그 삭제" 등의 키워드가 중요합니다

**게임 시작!** Steve에게 질문을 시작해보세요. 🎯`
        });
      }, 100);
    }
  }, [canStartDetectiveGame, onDetectiveToggle, detectiveGameActive, detectiveMode, onSubmit]);

  // Handle voice transcription
  const handleVoiceTranscription = useCallback((transcription, isPartial = false) => {
    if (!transcription || !transcription.trim()) return;

    const cleanTranscription = transcription.trim();

    if (isPartial) {
      console.log('Partial transcription:', cleanTranscription);
      return;
    }

    if (message.trim()) {
      setMessage(prevMessage => `${prevMessage} ${cleanTranscription}`);
    } else {
      setMessage(cleanTranscription);
    }

    setTimeout(() => {
      if (messageInputRef?.current) {
        messageInputRef.current.focus();
        const length = messageInputRef.current.value.length;
        messageInputRef.current.setSelectionRange(length, length);
      }
    }, 100);
  }, [message, setMessage, messageInputRef]);

  const handleVoiceError = useCallback((error) => {
    console.error('Voice input error:', error);
    setVoiceError(error);

    setTimeout(() => {
      setVoiceError(null);
    }, 5000);
  }, []);

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

  const handleSubmit = debounce(async () => {
    if (isDisabled || (!message.trim() && files.length === 0) || isRateLimited) return;

    try {
      let messageContent = message.trim();
      
      // Auto-insert @smokinggun if detective mode is on and not already present
      if (detectiveMode && messageContent && !messageContent.includes('@smokinggun')) {
        messageContent = `@smokinggun ${messageContent}`;
        console.log('🔍 Auto-inserted @smokinggun in detective mode:', messageContent);
      }

      if (files.length > 0) {
        await onSubmit({
          type: 'file',
          content: messageContent,
          fileData: { file: files[0].file }
        });
      } else {
        await onSubmit({
          type: 'text',
          content: messageContent
        });
      }
      setMessage('');
      setFiles([]);
    } catch (error) {
      if (error.response?.status === 429) {
        const retryAfter = parseInt(error.response.headers['retry-after']) || 1000;
        setIsRateLimited(true);
        setTimeout(() => setIsRateLimited(false), retryAfter);
        console.warn("Rate limited, will retry later");
      } else {
        console.error("Send error:", error);
      }
    }
  }, 500);

  // Remove the automatic intro message effect
  // useEffect(() => {
  //   if (detectiveMode && !hasSentDetectiveIntro && detectiveGameActive) {
  //     setHasSentDetectiveIntro(true);
  //     console.log('🕵️ Detective mode activated, sending intro message');
  //     console.log('🕵️ Detective mode state:', { detectiveMode, detectiveGameActive, room: room?._id });
  //     onSubmit({
  //       type: 'text',
  //       content: "@smokinggun 규칙을 알려줘"
  //     });
  //   }
  // }, [detectiveMode, hasSentDetectiveIntro, onSubmit, detectiveGameActive, room]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close emoji picker if clicking outside
      if (
        showEmojiPicker &&
        !emojiPickerRef.current?.contains(event.target) &&
        !emojiButtonRef.current?.contains(event.target)
      ) {
        setShowEmojiPicker(false);
      }
      
      // Close mention list if clicking outside
      if (showMentionList && !event.target.closest('.mention-dropdown')) {
        setShowMentionList(false);
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
  }, [showEmojiPicker, showMentionList, setShowEmojiPicker, files, messageInputRef, handleFileValidationAndPreview]);

  const calculateMentionPosition = useCallback((textarea, atIndex) => {
    const textBeforeAt = textarea.value.slice(0, atIndex);
    const lines = textBeforeAt.split('\n');
    const currentLineIndex = lines.length - 1;
    const currentLineText = lines[currentLineIndex];

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

    const textareaRect = textarea.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(textarea);
    const paddingLeft = parseInt(computedStyle.paddingLeft);
    const paddingTop = parseInt(computedStyle.paddingTop);
    const lineHeight = parseInt(computedStyle.lineHeight) || (parseFloat(computedStyle.fontSize) * 1.5);
    const scrollTop = textarea.scrollTop;

    let left = textareaRect.left + paddingLeft + textWidth;
    let top = textareaRect.top + paddingTop + (currentLineIndex * lineHeight) - scrollTop;

    const dropdownWidth = 320;
    const dropdownHeight = 250;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (left + dropdownWidth > viewportWidth) {
      left = viewportWidth - dropdownWidth - 10;
    }
    if (left < 10) {
      left = 10;
    }

    top = top + 40;

    if (top - dropdownHeight < 10) {
      top = textareaRect.top + paddingTop + ((currentLineIndex + 1) * lineHeight) - scrollTop + 2;
    } else {
      top = top - dropdownHeight;
    }

    return {top, left};
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
        // Close emoji picker if it's open to avoid overlap
        if (showEmojiPicker) {
          setShowEmojiPicker(false);
        }
        
        setMentionFilter(textAfterAt.toLowerCase());
        setShowMentionList(true);
        setMentionIndex(0);

        const position = calculateMentionPosition(textarea, lastAtSymbol);
        setMentionPosition(position);
        return;
      }
    }

    setShowMentionList(false);
  }, [onMessageChange, setMentionFilter, setShowMentionList, setMentionIndex, calculateMentionPosition]);

  const handleMentionSelect = useCallback((user) => {
    if (!messageInputRef?.current || !user || !user.name) return;

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
    if (e.nativeEvent.isComposing) {
      return;
    }

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
          if (participantsCount > 0 && participants[mentionIndex]) {
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
    // Close mention list if it's open to avoid overlap
    if (showMentionList) {
      setShowMentionList(false);
    }
    setShowEmojiPicker(prev => !prev);
  }, [setShowEmojiPicker, showMentionList, setShowMentionList]);

  const isDisabled = disabled || uploading || externalUploading;

  // Get detective placeholder
  const getPlaceholder = () => {
    if (detectiveMode && detectiveGameActive) {
      return "질문을 입력하세요 (@smokinggun 자동 추가됨)...";
    }
    if (detectiveMode && !detectiveGameActive) {
      return "질문을 입력하세요 (@smokinggun 자동 추가됨)...";
    }
    return placeholder;
  };

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
            style={{
              width: '100%',
              padding: 0,
              margin: 0
            }}
        >
          <div className="chat-input" style={{
            width: '100%',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 0
          }}>
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

            <div className="chat-input-toolbar" style={{
              width: '100%',
              padding: '8px 0 0 0',
              margin: 0
            }}>
              <MarkdownToolbar
                  onAction={handleMarkdownAction}
                  size="md"
              />
            </div>

            <div className="chat-input-main" style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'stretch',
              gap: '8px',
              minHeight: '60px',
              width: '100%',
              padding: 0,
              margin: 0
            }}>
              {/* Voice Recorder - positioned on the left */}
              <div style={{display: 'flex', alignItems: 'flex-start', paddingTop: '8px'}}>
                <VoiceRecorder
                    onTranscription={handleVoiceTranscription}
                    onError={handleVoiceError}
                    socketRef={socketRef}
                    disabled={isDisabled}
                    size="md"
                />
              </div>

              {/* Text input area - takes full available width */}
              <div style={{position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0}}>
                <textarea
                  ref={messageInputRef}
                  value={message}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={isDragging ? "파일을 여기에 놓아주세요." : getPlaceholder()}
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
                    border: detectiveMode ? '2px solid #dc2626' : '1px solid var(--vapor-color-border)',
                    borderRadius: 'var(--vapor-radius-md)',
                    padding: '12px',
                    paddingRight: '180px', // Space for buttons on the right
                    backgroundColor: detectiveMode ? '#fef2f2' : 'var(--vapor-color-normal)',
                    color: detectiveMode ? '#000000' : 'var(--vapor-color-text-primary)',
                    fontSize: 'var(--vapor-font-size-100)',
                    lineHeight: '1.5',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box',
                    margin: 0,
                    outline: 'none'
                  }}
                />
                
                {/* Button row inside textarea */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  right: '8px',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  zIndex: 2
                }}>
                  {/* Detective Game Button */}
                  <Button
                    variant={detectiveMode ? "solid" : "outline"}
                    size="sm"
                    onClick={handleDetectiveStart}
                    disabled={isDisabled || (!canStartDetectiveGame && !detectiveGameActive)}
                    style={detectiveMode ?
                      {
                        backgroundColor: '#dc2626',
                        borderColor: '#dc2626',
                        color: 'white',
                        padding: '6px 12px',
                        fontSize: '12px',
                        minWidth: 'auto'
                      } :
                      {
                        borderColor: '#dc2626',
                        color: '#dc2626',
                        padding: '6px 12px',
                        fontSize: '12px',
                        minWidth: 'auto'
                      }
                    }
                    title={!canStartDetectiveGame ? "다른 사용자가 게임 중입니다" : "탐정 게임 시작"}
                  >
                    <Gamepad2 size={14}/>
                    <span style={{marginLeft: '4px'}}>
                      {detectiveGameStarting ? '시작 중...' :
                        detectiveMode ? '🕵️ ON' : '탐정 게임'}
                    </span>
                  </Button>
                  
                  {/* Send Button */}
                  <Button
                    color="primary"
                    size="sm"
                    onClick={handleSubmit}
                    disabled={isDisabled || (!message.trim() && files.length === 0)}
                    aria-label="메시지 보내기"
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px'
                    }}
                  >
                    <SendIcon size={14}/>
                    <span style={{marginLeft: '4px'}}>보내기</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Actions row with emoji and file buttons */}
            <div className="chat-input-actions" style={{
              width: '100%',
              padding: '8px 0 0 0',
              margin: 0
            }}>
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
          
          {/* Emoji Picker */}
          {showEmojiPicker && (
            <div
              style={{
                position: 'fixed',
                bottom: '80px',
                left: '20px',
                zIndex: 9999,
                backgroundColor: 'white',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                border: '1px solid var(--vapor-color-border)'
              }}
              ref={emojiPickerRef}
              onClick={(e) => e.stopPropagation()}
            >
              <EmojiPicker
                onSelect={handleEmojiSelect}
                onClose={() => setShowEmojiPicker(false)}
                emojiSize={20}
                emojiButtonSize={36}
                perLine={8}
                maxFrequentRows={4}
              />
            </div>
          )}
          
          {/* Mention Dropdown */}
          {showMentionList && (
            <div
              style={{
                position: 'fixed',
                top: `${mentionPosition.top}px`,
                left: `${mentionPosition.left}px`,
                zIndex: 9998,
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                border: '1px solid var(--vapor-color-border)',
                maxHeight: '200px',
                overflow: 'auto'
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
          
          {/* Detective Game Rules Modal */}
          {showGameRules && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}>
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '32px',
                maxWidth: '700px',
                maxHeight: '80vh',
                overflow: 'auto',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
              }}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'}}>
                  <h2 style={{margin: 0, color: '#1a1a1a', fontSize: '24px'}}>🕵️ 탐정 게임 규칙</h2>
                  <button
                      onClick={() => setShowGameRules(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '24px',
                        cursor: 'pointer',
                        color: '#666',
                        padding: '4px'
                      }}
                  >
                    ×
                  </button>
                </div>

                <div style={{color: '#333', lineHeight: '1.6'}}>
                  <div style={{backgroundColor: '#f8f9fa', padding: '16px', borderRadius: '8px', marginBottom: '20px'}}>
                    <h3 style={{margin: '0 0 8px 0', color: '#dc2626'}}>🎯 목표</h3>
                    <p style={{margin: 0}}>
                      AI 용의자 <strong>@smokinggun</strong>을 심문하여 자백을 받아내세요!
                    </p>
                  </div>

                  <div style={{marginBottom: '20px'}}>
                    <h3 style={{margin: '0 0 12px 0', color: '#1f2937'}}>📋 자백 조건</h3>
                    <p style={{margin: '0 0 8px 0'}}>두 가지 핵심 증거를 <strong>모두</strong> 제시해야 합니다:</p>
                    <ol style={{margin: '0 0 0 20px', padding: 0}}>
                      <li><strong>프로덕션에 직접 force push한 증거</strong></li>
                      <li><strong>로그를 삭제하여 흔적을 지운 증거</strong></li>
                    </ol>
                  </div>

                  <div style={{marginBottom: '20px'}}>
                    <h3 style={{margin: '0 0 12px 0', color: '#1f2937'}}>💡 공략 팁</h3>
                    <ul style={{margin: 0, paddingLeft: '20px'}}>
                      <li>항상 <code>@smokinggun</code> 태그로 대화하세요</li>
                      <li>기술적 전문용어로 회피하려 할 때 끈질기게 파고드세요</li>
                      <li>"force push", "git push --force", "로그 삭제" 등의 키워드가 중요합니다</li>
                      <li>Jenkins나 다른 개발자를 탓하며 책임을 회피할 것입니다</li>
                    </ul>
                  </div>

                  <div style={{
                    backgroundColor: '#fef3c7',
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid #f59e0b'
                  }}>
                    <h4 style={{margin: '0 0 8px 0', color: '#92400e'}}>⚠️ 주의사항</h4>
                    <p style={{margin: 0, fontSize: '14px'}}>
                      탐정 모드가 활성화되면 시스템 로그 메시지들이 숨겨져서 게임에 집중할 수 있습니다.
                      게임 중에는 일반 채팅 기능이 제한됩니다.
                    </p>
                  </div>
                </div>

                <div style={{marginTop: '24px', textAlign: 'center'}}>
                  <Button
                      onClick={() => setShowGameRules(false)}
                      style={{
                        backgroundColor: '#dc2626',
                        color: 'white',
                        padding: '12px 24px',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '16px'
                      }}
                  >
                    게임 시작하기!
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {/* Voice Error */}
          {voiceError && (
              <div className="voice-error" style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                right: 0,
                backgroundColor: '#fee2e2',
                color: '#b91c1c',
                padding: '8px',
                borderRadius: '8px',
                marginBottom: '8px',
                textAlign: 'center',
                fontSize: '14px',
                zIndex: 1001
              }}>
                {voiceError}
              </div>
          )}
          
          {/* Rate Limit Error */}
          {isRateLimited && (
              <div className="rate-limit-error" style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                right: 0,
                backgroundColor: '#fef3c7',
                color: '#92400e',
                padding: '8px',
                borderRadius: '8px',
                marginBottom: '8px',
                textAlign: 'center',
                fontSize: '14px',
                zIndex: 1001
              }}>
                너무 빠르게 메시지를 보내고 있습니다. 잠시 후 다시 시도하세요.
              </div>
          )}
        </div>
      </>
    );
});

export default ChatInput;
