import React, { useState, useEffect, useCallback, forwardRef } from 'react';
import { Avatar } from '@vapor-ui/core';
import { getConsistentAvatarStyles } from '../../utils/colorUtils';

const PersistentAvatar = forwardRef(({
  user,
  size = "md",
  className = "",
  onClick,
  showInitials = true,
  ...props
}, ref) => {
  const [currentImage, setCurrentImage] = useState('');
  const [imageError, setImageError] = useState(false);

  // getProfileImageUrl 함수 memoization
  const getProfileImageUrl = useCallback((imagePath) => {
    if (!imagePath) return null;
    return imagePath.startsWith('http') ? 
      imagePath : 
      `${process.env.REACT_APP_API_URL}${imagePath}`;
  }, []);

  // 프로필 이미지 URL 처리
  useEffect(() => {
    const imageUrl = getProfileImageUrl(user?.profileImage);
    if (imageUrl && imageUrl !== currentImage) {
      setImageError(false);
      setCurrentImage(imageUrl);
    } else if (!imageUrl) {
      setCurrentImage('');
    }
  }, [user?.profileImage, getProfileImageUrl, currentImage]);

  // 전역 프로필 업데이트 리스너
  useEffect(() => {
    const handleProfileUpdate = () => {
      try {
        const updatedUser = JSON.parse(localStorage.getItem('user') || '{}');
        // 현재 사용자의 프로필이 업데이트된 경우에만 이미지 업데이트
        if (user?.id === updatedUser.id && updatedUser.profileImage !== user.profileImage) {
          const newImageUrl = getProfileImageUrl(updatedUser.profileImage);
          setImageError(false);
          setCurrentImage(newImageUrl);
        }
      } catch (error) {
        console.error('Profile update handling error:', error);
      }
    };
    
    window.addEventListener('userProfileUpdate', handleProfileUpdate);
    return () => {
      window.removeEventListener('userProfileUpdate', handleProfileUpdate);
    };
  }, [getProfileImageUrl, user?.id, user?.profileImage]);

  // 이메일 기반의 일관된 스타일 가져오기
  const avatarStyles = getConsistentAvatarStyles(user?.email);

  const handleImageError = (e) => {
    e.preventDefault();
    setImageError(true);

    // 콘솔에 디버그 정보 출력
    console.debug('Avatar image load failed:', {
      user: user?.name,
      email: user?.email,
      imageUrl: currentImage
    });
  };

  // Vapor UI size mapping
  const getVaporSize = (size) => {
    switch (size) {
      case 'sm': return 'sm';
      case 'lg': return 'lg';
      case 'xl': return 'xl';
      default: return 'md';
    }
  };

  return (
    <Avatar.Root
      ref={ref}
      size={getVaporSize(size)}
      className={className}
      onClick={onClick}
      src={currentImage && !imageError ? currentImage : undefined}
      style={{
        backgroundColor: avatarStyles.backgroundColor,
        color: avatarStyles.color,
        cursor: onClick ? 'pointer' : 'default',
        ...props.style
      }}
      {...props}
    >
      {currentImage && !imageError ? (
        <Avatar.Image
          onError={handleImageError}
          alt={`${user?.name}'s profile`}
        />
      ) : null}
      <Avatar.Fallback
        style={{
          backgroundColor: avatarStyles.backgroundColor,
          color: avatarStyles.color,
          fontWeight: '500'
        }}
      >
        {showInitials ? (user?.name?.[0]?.toUpperCase() || '?') : ''}
      </Avatar.Fallback>
    </Avatar.Root>
  );
});

PersistentAvatar.displayName = 'PersistentAvatar';

export default PersistentAvatar;