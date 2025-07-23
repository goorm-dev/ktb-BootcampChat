import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ErrorCircleIcon, NetworkIcon } from '@vapor-ui/icons';
import authService from '../services/authService';
import { withoutAuth } from '../middleware/withAuth';

// Vapor UI 컴포넌트들을 개별적으로 import
import { Button, TextInput, Card, Text, Callout } from '@vapor-ui/core';

// Layout 컴포넌트들을 개별적으로 import
import { Flex, Center, Box, Stack } from '../components/ui/Layout';

// 컴포넌트 검증 (개발 환경에서만)
if (process.env.NODE_ENV === 'development') {
  console.log('=== Component Check ===');
  console.log('Button:', Button);
  console.log('TextInput:', TextInput);
  console.log('TextInput.Root:', TextInput?.Root);
  console.log('TextInput.Label:', TextInput?.Label);
  console.log('TextInput.Input:', TextInput?.Input);
  console.log('Card:', Card);
  console.log('Card.Root:', Card?.Root);
  console.log('Card.Body:', Card?.Body);
  console.log('Text:', Text);
  console.log('Callout:', Callout);
  console.log('Flex:', Flex);
  console.log('Center:', Center);
  console.log('Box:', Box);
  console.log('===================');
}

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState({
    checking: typeof window !== 'undefined', // 클라이언트에서만 체크
    connected: false
  });
  const router = useRouter();
  const { redirect } = router.query;

  // 서버 연결 상태 확인
  useEffect(() => {
    // 클라이언트 사이드에서만 실행되도록 보장
    if (typeof window === 'undefined') {
      return;
    }

    const checkServerConnection = async () => {
      try {
        console.log('Checking server connection...');
        await authService.checkServerConnection();
        console.log('Server connection successful');
        setServerStatus({ checking: false, connected: true });
      } catch (error) {
        console.error('Server connection check failed:', error);

        // 개발 환경에서는 더 관대하게 처리
        if (process.env.NODE_ENV === 'development') {
          console.warn('Development mode: proceeding despite connection check failure');
          setServerStatus({ checking: false, connected: true });
          setError({
            type: 'warning',
            title: '개발 환경: 서버 연결 확인 실패',
            message: '서버 연결을 확인할 수 없지만 계속 진행합니다.',
            suggestion: '백엔드 서버가 실행 중인지 확인해주세요.'
          });
        } else {
          // 프로덕션에서는 연결 실패해도 페이지는 보여주되, 경고만 표시
          setServerStatus({ checking: false, connected: false });
          setError({
            type: 'warning',
            title: '서버 연결 확인 실패',
            message: '서버와의 연결을 확인할 수 없습니다.',
            suggestion: '로그인을 시도해보세요. 문제가 지속되면 새로고침해주세요.'
          });
        }
      }
    };

    // 약간의 지연을 두어 hydration 완료 후 실행
    const timer = setTimeout(() => {
      checkServerConnection();
    }, 100);

    // fallback으로 4초 후에는 무조건 체크 완료로 처리 (authService timeout 3초 + 여유시간)
    const fallbackTimer = setTimeout(() => {
      console.log('Server connection check timeout, proceeding anyway');
      setServerStatus(prev => prev.checking ? { checking: false, connected: true } : prev);
    }, 4000);

    return () => {
      clearTimeout(timer);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const validateForm = () => {
    // 이메일 검증
    if (!formData.email?.trim()) {
      setError({
        type: 'warning',
        title: '입력 오류',
        message: '이메일을 입력해주세요.',
        field: 'email'
      });
      return false;
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setError({
        type: 'warning',
        title: '입력 오류',
        message: '올바른 이메일 형식이 아닙니다.',
        field: 'email'
      });
      return false;
    }

    // 비밀번호 검증
    if (!formData.password) {
      setError({
        type: 'warning',
        title: '입력 오류',
        message: '비밀번호를 입력해주세요.',
        field: 'password'
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // 서버 연결 상태 확인
    if (!serverStatus.connected) {
      setError({
        type: 'error',
        title: '서버 연결 실패',
        message: '서버와 연결할 수 없습니다.',
        suggestion: '인터넷 연결을 확인하고 잠시 후 다시 시도해주세요.',
        Icon: NetworkIcon
      });
      return;
    }

    // 폼 유효성 검사
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      // 로그인 요청 데이터 준비
      const loginCredentials = {
        email: formData.email.trim(),
        password: formData.password
      };

      // 디버그 로깅
      console.log('Submitting login request:', {
        email: loginCredentials.email,
        hasPassword: !!loginCredentials.password,
        timestamp: new Date().toISOString()
      });

      // 로그인 요청
      await authService.login(loginCredentials);
      const redirectUrl = router.query.redirect || '/chat-rooms';
      router.push(redirectUrl);

    } catch (err) {
      console.error('Login error:', err);

      if (err.isAxiosError && err.response?.status === 500) {
        setError({
          type: 'error',
          title: '서버 오류',
          message: '서버에서 오류가 발생했습니다.',
          suggestion: '잠시 후 다시 시도해주세요.',
          Icon: ErrorCircleIcon
        });
      } else {
        setError({
          type: 'error',
          title: '로그인 실패',
          message: err.message || '로그인 처리 중 오류가 발생했습니다.',
          suggestion: '입력하신 정보를 다시 확인해주세요.',
          Icon: ErrorCircleIcon
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error?.field === name) setError(null);
  };

  if (serverStatus.checking) {
    return (
      <div className="auth-container">
        <Card.Root className="auth-card">
          <Card.Body className="card-body">
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <img src="images/logo-h.png" style={{ width: '50%' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <Text typography="body1">서버 연결 확인 중...</Text>
              <div className="spinner-border text-primary mt-3" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          </Card.Body>
        </Card.Root>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <Card.Root className="auth-card">
        <Card.Body className="card-body">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <img src="images/logo-h.png" style={{ width: '50%' }} />
          </div>

          {error && (
            <Callout color={error.type === 'error' ? 'danger' : error.type === 'warning' ? 'warning' : 'primary'}>
              <strong>{error.title}</strong>
              <Text typography="body2">{error.message}</Text>
              {error.suggestion && <small>{error.suggestion}</small>}
            </Callout>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <TextInput.Root
                type="email"
                value={formData.email}
                onValueChange={(value) => {
                  setFormData(prev => ({ ...prev, email: value }));
                  if (error?.field === 'email') setError(null);
                }}
                disabled={loading}
                invalid={error?.field === 'email'}
                placeholder="이메일을 입력하세요"
              >
                <TextInput.Label>이메일</TextInput.Label>
                <TextInput.Field
                  id="email"
                  name="email"
                  autoComplete="email"
                  required
                  style={{ width: '100%' }}
                />
              </TextInput.Root>
              {error?.field === 'email' && (
                <Text typography="body3" color="danger">{error.message}</Text>
              )}
            </div>

            <div className="mb-3">
              <TextInput.Root
                type="password"
                value={formData.password}
                onValueChange={(value) => {
                  setFormData(prev => ({ ...prev, password: value }));
                  if (error?.field === 'password') setError(null);
                }}
                disabled={loading}
                invalid={error?.field === 'password'}
                placeholder="비밀번호를 입력하세요"
              >
                <TextInput.Label>비밀번호</TextInput.Label>
                <TextInput.Field
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  style={{ width: '100%' }}
                />
              </TextInput.Root>
              {error?.field === 'password' && (
                <Text typography="body3" color="danger">{error.message}</Text>
              )}
            </div>

            <Button
              type="submit"
              color="primary"
              size="lg"
              style={{ width: '100%', marginTop: 'var(--vapor-space-200)' }}
              disabled={loading || !serverStatus.connected}
            >
              {loading ? '로그인 중...' : '로그인'}
            </Button>

            <div style={{ marginTop: 'var(--vapor-space-400)', textAlign: 'center' }}>
              <Text typography="body2" style={{ display: 'block', marginBottom: 'var(--vapor-space-200)' }}>계정이 없으신가요?</Text>
              <Button
                onClick={() => router.push('/register')}
                disabled={loading || !serverStatus.connected}
              >
                회원가입
              </Button>
            </div>
          </form>
        </Card.Body>
      </Card.Root>
    </div>
  );
};

export default withoutAuth(Login);
