import React, { useState } from 'react';
import {
  PdfIcon as FileText,
  ImageIcon as Image,
  MovieIcon as Film,
  SoundOnIcon as Music,
  LinkOutlineIcon as ExternalLink,
  DownloadIcon as Download,
  ErrorCircleIcon as AlertCircle,
  FileIcon
} from '@vapor-ui/icons';
import { Button, Text, Callout } from '@vapor-ui/core';
import PersistentAvatar from '../../common/PersistentAvatar';
import MessageContent from './MessageContent';
import MessageActions from './MessageActions';
import ReadStatus from '../ReadStatus';
import fileService from '../../../services/fileService';

const FileMessage = ({
  msg = {},
  isMine = false,
  currentUser = null,
  onReactionAdd,
  onReactionRemove,
  room = null,
  messageRef,
  socketRef
}) => {
  const [error, setError] = useState(null);

  // 서버가 소켓 메시지로 보내준 최종 CloudFront URL을 그대로 사용합니다.
  const previewUrl = msg.file?.url;
  console.log(previewUrl);

  if (!msg?.file) {
    console.error('File data is missing:', msg);
    return null;
  }

  const formattedTime = new Date(msg.timestamp).toLocaleString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).replace(/\./g, '년').replace(/\s/g, ' ').replace('일 ', '일 ');

  const getFileIcon = () => {
    const mimetype = msg.file?.mimeType || '';
    const iconProps = { className: "w-5 h-5 flex-shrink-0" };

    if (mimetype.startsWith('image/')) return <Image {...iconProps} color="#00C853" />;
    if (mimetype.startsWith('video/')) return <Film {...iconProps} color="#2196F3" />;
    if (mimetype.startsWith('audio/')) return <Music {...iconProps} color="#9C27B0" />;
    if (mimetype === 'application/pdf') return <FileText {...iconProps} color="#F44336" />;
    return <FileIcon {...iconProps} color="#ffffff" />;
  };

  const getDecodedFilename = (encodedFilename) => {
    try {
      return decodeURIComponent(encodedFilename || '');
    } catch (e) {
      return encodedFilename || '';
    }
  };

  const renderAvatar = () => (
    <PersistentAvatar
      user={isMine ? currentUser : msg.sender}
      size="md"
      className="flex-shrink-0"
      showInitials={true}
    />
  );
  
  const handleFileDownload = (e) => {
    e.preventDefault();
    if (!previewUrl) {
      setError('파일 URL이 유효하지 않습니다.');
      return;
    }
    const link = document.createElement('a');
    link.href = previewUrl;
    link.download = getDecodedFilename(msg.file.originalName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleViewInNewTab = (e) => {
    e.preventDefault();
    if (!previewUrl) {
      setError('파일 URL이 유효하지 않습니다.');
      return;
    }
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  };

  const renderImagePreview = (originalname) => {
    console.log(previewUrl);
    console.log(originalname);
    console.log("ㅇㄴㅁㄹㅇㄹㄴㅇㅇ");
    // [핵심 수정]
    // previewUrl이 없는 경우(파일 처리 중) 로딩 상태를 보여줍니다.
    if (!previewUrl) {
      return (
        <div className="flex items-center justify-center h-40 bg-gray-800 rounded-sm">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      );
    }
    return (
      <div className="bg-transparent-pattern">
        <img
          src={previewUrl}
          alt={originalname}
          className="object-cover rounded-sm"
          onError={() => setError('이미지를 불러올 수 없습니다.')}
          loading="lazy"
        />
      </div>
    );
  };
  
  const renderFilePreview = () => {
    const mimetype = msg.file?.mimeType || '';
    const originalname = getDecodedFilename(msg.file?.originalName || 'Unknown File');
    const size = fileService.formatFileSize(msg.file?.size || 0);

    console.log(originalname);
    console.log(size);
    console.log("ㅇㄴㅁㄹㅇㄹㄴㅇㅇ");


    const FileActions = () => (
      <div className="file-actions mt-2 pt-2 border-t border-gray-700">
        <Button size="sm" variant="outline" onClick={handleViewInNewTab} title="새 탭에서 보기">
          <ExternalLink size={16} /> <span>새 탭에서 보기</span>
        </Button>
        <Button size="sm" variant="outline" onClick={handleFileDownload} title="다운로드">
          <Download size={16} /> <span>다운로드</span>
        </Button>
      </div>
    );

    if (mimetype.startsWith('image/')) {
      return (
        <div>
          {renderImagePreview(originalname)}
          <div className="flex items-center gap-3 p-1 mt-2">
            <div className="flex-1 min-w-0">
              <Text typography="body2" className="font-medium truncate flex items-center gap-2">{getFileIcon()} {originalname}</Text>
              <span className="text-sm text-gray-400">{size}</span>
            </div>
          </div>
          <FileActions />
        </div>
      );
    }

    if (mimetype.startsWith('video/')) {
      return (
        <div>
          <div>
            {previewUrl ? (
              <video className="object-cover rounded-sm" controls preload="metadata" aria-label={`${originalname} 비디오`}>
                <source src={previewUrl} type={mimetype} />
                비디오를 재생할 수 없습니다.
              </video>
            ) : (
              <div className="flex items-center justify-center h-40 bg-gray-800 rounded-sm"><Film className="w-8 h-8 text-gray-400" /></div>
            )}
          </div>
          <div className="flex items-center gap-3 p-1 mt-2">
            <div className="flex-1 min-w-0">
              <Text typography="body2" className="font-medium truncate flex items-center gap-2">{getFileIcon()} {originalname}</Text>
              <span className="text-sm text-gray-400">{size}</span>
            </div>
          </div>
          <FileActions />
        </div>
      );
    }

    if (mimetype.startsWith('audio/')) {
        return (
          <div>
            <div className="flex items-center gap-3 p-1 mt-2">
              <div className="flex-1 min-w-0">
                <Text typography="body2" className="font-medium truncate flex items-center gap-2">{getFileIcon()} {originalname}</Text>
                <span className="text-sm text-gray-400">{size}</span>
              </div>
            </div>
            <div className="px-3 pb-3">
              {previewUrl ? (
                <audio className="w-full" controls preload="metadata" aria-label={`${originalname} 오디오`}>
                  <source src={previewUrl} type={mimetype} />
                  오디오를 재생할 수 없습니다.
                </audio>
              ) : (
                <div className="flex items-center justify-center h-20 bg-gray-800 rounded-sm"><Music className="w-8 h-8 text-gray-400" /></div>
              )}
            </div>
            <FileActions />
          </div>
        );
      }

    return (
      <div>
        <div className="flex items-center gap-3 p-4 bg-gray-800 rounded-sm">
          <div className="flex-shrink-0">{getFileIcon()}</div>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{originalname}</div>
            <Text typography="body2" as="span" className="text-gray-400">{size}</Text>
          </div>
        </div>
        <FileActions />
      </div>
    );
  };

  return (
    <div className="messages">
      <div className={`message-group ${isMine ? 'mine' : 'yours'}`}>
        <div className="message-sender-info">
          {renderAvatar()}
          <span className="sender-name">
            {isMine ? '나' : msg.sender?.name}
          </span>
        </div>
        <div className={`message-bubble ${isMine ? 'message-mine' : 'message-other'} last file-message`}>
          <div className="message-content">
            {error && (
              <Callout color="danger" className="mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
                <Button variant="ghost" size="sm" className="ml-auto" aria-label="Close" onClick={() => setError(null)}>×</Button>
              </Callout>
            )}
            {renderFilePreview()}
            {msg.content && (
              <div className="mt-3">
                <MessageContent content={msg.content} />
              </div>
            )}
          </div>
          <div className="message-footer">
            <div className="message-time mr-3" title={new Date(msg.timestamp).toLocaleString('ko-KR')}>
              {formattedTime}
            </div>
            <ReadStatus
              messageType={msg.type}
              participants={room.participants}
              readers={msg.readers}
              messageId={msg._id}
              messageRef={messageRef}
              currentUserId={currentUser.id}
              socketRef={socketRef}
            />
          </div>
        </div>
        <MessageActions
          messageId={msg._id}
          messageContent={msg.content}
          reactions={msg.reactions}
          currentUserId={currentUser?.id}
          onReactionAdd={onReactionAdd}
          onReactionRemove={onReactionRemove}
          isMine={isMine}
          room={room}
        />
      </div>
    </div>
  );
};

FileMessage.defaultProps = {
  msg: {
    file: {
      mimetype: '',
      filename: '',
      originalname: '',
      size: 0,
      url: ''
    }
  },
  isMine: false,
  currentUser: null
};

export default React.memo(FileMessage);
