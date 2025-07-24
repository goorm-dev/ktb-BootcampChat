import React, { useMemo } from 'react';
import MessageContent from './MessageContent';
import MessageActions from './MessageActions';
import PersistentAvatar from '../../common/PersistentAvatar';
import ReadStatus from '../ReadStatus';
import { generateColorFromEmail, getContrastTextColor } from '../../../utils/colorUtils';

const UserMessage = ({
  msg = {}, 
  isMine = false, 
  currentUser = null,
  onReactionAdd,
  onReactionRemove,
  room = null,
  messageRef,
  socketRef
}) => {
  const formattedTime = new Date(msg.timestamp).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/\./g, '년').replace(/\s/g, ' ').replace('일 ', '일 ');

  // 아바타 스타일을 메모이제이션
  const avatarStyles = useMemo(() => {
    const email = isMine ? currentUser?.email : msg.sender?.email;
    if (!email) return {};
    const backgroundColor = generateColorFromEmail(email);
    const color = getContrastTextColor(backgroundColor);
    return { backgroundColor, color };
  }, [isMine, currentUser?.email, msg.sender?.email]);

  const user = isMine ? currentUser : msg.sender;

  return (
    <div className="messages">
      <div className={`message-group ${isMine ? 'mine' : 'yours'}`}>
        <div className="message-sender-info">
          <PersistentAvatar
            user={user}
            size="lg"
            style={avatarStyles}
            showInitials={true}
          />
          <span className="sender-name">
            {isMine ? '나' : msg.sender?.name}
          </span>
        </div>
        <div className={`message-bubble ${isMine ? 'message-mine' : 'message-other'} last relative group`}>
          <div className="message-content">
            <MessageContent content={msg.content} />
          </div>
          <div className="message-footer">
            <div className="message-time mr-3">
              {formattedTime}
            </div>
            <ReadStatus 
              messageType={msg.type}
              participants={room.participants}
              readers={msg.readers}
              messageId={msg.id}
              messageRef={messageRef}
              currentUserId={currentUser.id}
              socketRef={socketRef}
            />            
          </div>
        </div>
          
        <MessageActions 
          messageId={msg.id}
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

UserMessage.defaultProps = {
  msg: {},
  isMine: false,
  currentUser: null,
  onReactionAdd: () => {},
  onReactionRemove: () => {},
  room: null
};

export default React.memo(UserMessage);