import React from 'react';
import { useRouter } from 'next/router';
import { HStack, NavigationMenu } from '@vapor-ui/core';
import { useAuth } from '@/contexts/AuthContext';

const ChatHeader = () => {
  const router = useRouter();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <HStack
      justifyContent="space-between"
      alignItems="center"
      paddingX="$400"
      paddingY="$300"
      className="bg-surface-200 backdrop-blur-sm sticky top-0 z-10"
    >
      {/* 왼쪽: 로고 */}
      <button
        onClick={() => router.push('/chat')}
        className="bg-transparent border-none cursor-pointer p-0"
      >
        <img
          src="/images/logo.png"
          alt="Chat App Logo"
          height={15}
          className="logo"
        />
      </button>

      {/* 오른쪽: 네비게이션 메뉴 */}
      <NavigationMenu.Root aria-label="Chat Actions">
        <NavigationMenu.List>
          <NavigationMenu.Item>
            <NavigationMenu.Link href="/chat" data-testid="chat-list-link">채팅방 목록</NavigationMenu.Link>
          </NavigationMenu.Item>
          <NavigationMenu.Item>
            <NavigationMenu.Link href="/chat/new" data-testid="chat-new-link">새 채팅방</NavigationMenu.Link>
          </NavigationMenu.Item>
          <NavigationMenu.Item>
            <NavigationMenu.Link href="/profile" data-testid="profile-link">프로필</NavigationMenu.Link>
          </NavigationMenu.Item>
          <NavigationMenu.Item>
            <NavigationMenu.Link onClick={handleLogout} data-testid="logout-link">로그아웃</NavigationMenu.Link>
          </NavigationMenu.Item>
        </NavigationMenu.List>
      </NavigationMenu.Root>
    </HStack>
  );
};

export default ChatHeader;
