import React, { useState, useEffect, useCallback, forwardRef } from 'react';
import { Avatar } from '@vapor-ui/core';
import { generateColorFromEmail, getContrastTextColor } from '@/utils/colorUtils';

const SIZE_MAP = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64
};

/**
 * CustomAvatar 컴포넌트
 * 
 * @param {Object} props
 * @param {Object} props.user - 사용자 객체 (name, email, profileImage 필드)
 * @param {string} props.size - 아바타 크기 ('sm' | 'md' | 'lg' | 'xl')
 * @param {Function} props.onClick - 클릭 핸들러 (있으면 button으로 렌더링)
 * @param {string} props.src - 프로필 이미지 URL (user.profileImage 대신 직접 지정 가능)
 * @param {boolean} props.showImage - 이미지 표시 여부 (기본값: true)
 * @param {boolean} props.persistent - 실시간 프로필 업데이트 감지 여부 (기본값: false)
 * @param {boolean} props.showInitials - 이니셜 표시 여부 (기본값: true)
 * @param {string} props.className - 추가 CSS 클래스
 * @param {Object} props.style - 추가 인라인 스타일
 */
const CustomAvatar = forwardRef(({
  user,
  size = 'md',
  onClick,
  src,
  showImage = true,
  persistent = false,
  showInitials = true,
  className = '',
  style = {},
  ...props
}, ref) => {
  // persistent 모드일 때만 상태 관리
  const [currentImage, setCurrentImage] = useState('');
  const [imageError, setImageError] = useState(false);
  const avatarSizePx = SIZE_MAP[size] || SIZE_MAP.md;

  // 이메일 기반 배경색/텍스트 색상 생성
  const backgroundColor = generateColorFromEmail(user?.email);
  const color = getContrastTextColor(backgroundColor);

  // 프로필 이미지 URL 생성 (memoized)
  const getImageUrl = useCallback((imagePath) => {
    // src prop이 직접 제공된 경우
    if (src) return src;
    
    if (!imagePath) return null;
    
    // 이미 전체 URL인 경우
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    // API URL과 결합 필요한 경우
    return `${process.env.NEXT_PUBLIC_API_URL}${imagePath}`;
  }, [src]);

  // persistent 모드: 프로필 이미지 URL 처리
  useEffect(() => {
    if (!persistent) return;

    const imageUrl = getImageUrl(user?.profileImage);
    if (imageUrl && imageUrl !== currentImage) {
      setImageError(false);
      setCurrentImage(imageUrl);
    } else if (!imageUrl) {
      setCurrentImage('');
    }
  }, [persistent, user?.profileImage, getImageUrl, currentImage]);

  // persistent 모드: 전역 프로필 업데이트 리스너
  useEffect(() => {
    if (!persistent) return;

    const handleProfileUpdate = () => {
      try {
        const updatedUser = JSON.parse(localStorage.getItem('user') || '{}');
        // 현재 사용자의 프로필이 업데이트된 경우에만 이미지 업데이트
        if (user?.id === updatedUser.id && updatedUser.profileImage !== user.profileImage) {
          const newImageUrl = getImageUrl(updatedUser.profileImage);
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
  }, [persistent, getImageUrl, user?.id, user?.profileImage]);

  // 이미지 에러 핸들러
  const handleImageError = useCallback((e) => {
    if (!persistent) return;
    
    e.preventDefault();
    setImageError(true);

    console.debug('Avatar image load failed:', {
      user: user?.name,
      email: user?.email,
      imageUrl: persistent ? currentImage : getImageUrl(user?.profileImage)
    });
  }, [persistent, currentImage, user?.name, user?.email, user?.profileImage, getImageUrl]);

  // 최종 이미지 URL 결정
  const finalImageUrl = (() => {
    if (!showImage) return undefined;
    
    if (persistent) {
      return currentImage && !imageError ? currentImage : undefined;
    }
    
    return getImageUrl(user?.profileImage);
  })();

  // 사용자 이름 첫 글자
  const initial = showInitials ? (user?.name?.charAt(0)?.toUpperCase() || '?') : '';

  // 클릭 가능한 경우 button으로 렌더링
  const renderProp = onClick ? <button onClick={onClick} /> : undefined;

  return (
    <Avatar.Root
      ref={ref}
      key={user?._id || user?.id}
      shape="circle"
      size={size}
      render={renderProp}
      src={finalImageUrl}
      className={className}
      style={{
        backgroundColor,
        color,
        cursor: onClick ? 'pointer' : 'default',
        width: avatarSizePx,
        height: avatarSizePx,
        ...style
      }}
      {...props}
    >
      {finalImageUrl && (
        <Avatar.ImagePrimitive 
          onError={persistent ? handleImageError : undefined}
          loading="lazy"
          alt={`${user?.name}'s profile`}
        />
      )}
      <Avatar.FallbackPrimitive
        style={{
          backgroundColor,
          color,
          fontWeight: '500',
          width: '100%',
          height: '100%'
        }}
      >
        {initial}
      </Avatar.FallbackPrimitive>
    </Avatar.Root>
  );
});

CustomAvatar.displayName = 'CustomAvatar';

export default CustomAvatar;
