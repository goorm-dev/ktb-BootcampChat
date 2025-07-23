import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation} from 'react-router-dom';
import { Button, Avatar, Text } from '@vapor-ui/core';
import { Flex, HStack, Box, Container } from './ui/Layout';
import authService from '../services/authService';

const Navbar = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // 인증 상태 변경을 감지하는 효과
  useEffect(() => {
    const checkAuth = () => {
      const user = authService.getCurrentUser();
      setCurrentUser(user);
    };

    // 초기 인증 상태 확인
    checkAuth();

    // authStateChange 이벤트 리스너 등록
    const handleAuthChange = () => {
      checkAuth();
    };

    // userProfileUpdate 이벤트 리스너 등록
    const handleProfileUpdate = () => {
      checkAuth();
    };

    window.addEventListener('authStateChange', handleAuthChange);
    window.addEventListener('userProfileUpdate', handleProfileUpdate);

    // 정리 함수
    return () => {
      window.removeEventListener('authStateChange', handleAuthChange);
      window.removeEventListener('userProfileUpdate', handleProfileUpdate);
    };
  }, []);

  const handleNavigation = (path) => {
    navigate(path);
  };

  const handleLogout = async () => {
    await authService.logout();
    // 로그아웃 후 authStateChange 이벤트 발생
    window.dispatchEvent(new Event('authStateChange'));
  };

  const isInChatRooms = location.pathname === '/chat-rooms';

  return (
    <nav>
      <Container>
        <Flex justify="space-between" align="center">
          {/* Logo */}
          <Box>
            <div 
              onClick={() => handleNavigation(currentUser ? '/chat-rooms' : '/')}
              style={{ cursor: 'pointer' }}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleNavigation(currentUser ? '/chat-rooms' : '/');
                }
              }}
            >
              <img
                src="/images/logo.png"
                alt="Chat App Logo"
                width={240}
                height={81}
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
          </Box>

          {/* Navigation Menu */}
          <Box>
            {currentUser && (
              <HStack gap="150">
                <Button
                  color="primary"
                  size="md"
                  onClick={() => handleNavigation('/chat-rooms')}
                >
                  채팅방 목록
                </Button>
                <Button
                  color="primary"
                  size="md"
                  onClick={() => handleNavigation('/chat-rooms/new')}
                >
                  새 채팅방
                </Button>
              </HStack>
            )}
          </Box>

          {/* User Menu */}
          <Box>
            {currentUser ? (
              <HStack gap="150" align="center">
                {/* Profile Image */}
                <Avatar.Root
                  size="md"
                  style={{ flexShrink: 0 }}
                  src={currentUser.profileImage ? `${process.env.NEXT_PUBLIC_API_URL}${currentUser.profileImage}` : undefined}
                >
                  <Avatar.Image />
                  <Avatar.Fallback>{currentUser.name?.[0]?.toUpperCase()}</Avatar.Fallback>
                </Avatar.Root>
                
                {/* Member Name */}
                <Text typography="body2" style={{ fontWeight: 500 }}>
                  {currentUser.name}
                </Text>
                
                {/* Profile Button */}
                <Button
                  size="md"
                  onClick={() => handleNavigation('/profile')}
                >
                  프로필
                </Button>
                
                {/* Logout Button */}
                <Button
                  color="danger"
                  size="md"
                  onClick={handleLogout}
                >
                  로그아웃
                </Button>
              </HStack>
            ) : (
              <HStack gap="150">
                <Button
                  size="md"
                  onClick={() => handleNavigation('/')}
                >
                  로그인
                </Button>
                <Button
                  size="md"
                  onClick={() => handleNavigation('/register')}
                >
                  회원가입
                </Button>
              </HStack>
            )}
          </Box>
        </Flex>
      </Container>
    </nav>
  );
};

export default Navbar;