import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { ThemeProvider } from '@vapor-ui/core';
import '@vapor-ui/core/styles.css';
import '../styles/globals.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ChatHeader from '@/components/ChatHeader';
import ToastContainer from '@/components/Toast';
import { AuthProvider } from '@/contexts/AuthContext';

function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: 3,
        retryDelay: attemptIndex => Math.min(1000 * (2 ** attemptIndex), 5000),
        staleTime: 30 * 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true
      }
    }
  }));

  const isErrorPage = router.pathname === '/_error';
  if (isErrorPage) {
    return <Component {...pageProps} />;
  }

  // 로그인/회원가입 페이지에서는 헤더 숨김
  const showHeader = !['/', '/register'].includes(router.pathname);

  return (
    <ThemeProvider defaultTheme="dark">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {showHeader && <ChatHeader />}
          <Component {...pageProps} />
          <ToastContainer />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default MyApp;
