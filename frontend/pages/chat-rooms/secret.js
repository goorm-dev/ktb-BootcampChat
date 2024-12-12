import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Card } from '@goorm-dev/vapor-core';
import {
  Button,
  Input,
  Text,
  Alert,
  FormGroup,
  Label,
} from '@goorm-dev/vapor-components';
import { AlertCircle } from 'lucide-react';
import authService from '../../services/authService';
import axiosInstance from '../../services/axios';

function SecretChatRoom() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [roomId, setRoomId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (!user) {
      router.push('/');
      return;
    }

    setCurrentUser(user);

    // `roomId`를 URL에서 가져옴
    const queryRoomId = router.query.roomId;
    if (!queryRoomId) {
      setError('유효하지 않은 채팅방입니다.');
    } else {
      setRoomId(queryRoomId);
    }
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    if (!password.trim()) {
      setError('비밀번호를 입력해주세요.');
      return;
    }
  
    if (!currentUser?.token) {
      setError('인증 정보가 없습니다. 다시 로그인해주세요.');
      return;
    }
  
    try {
      setLoading(true);
      setError('');
  
      // 서버에 비밀번호 검증 요청
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': currentUser.token,
          'x-session-id': currentUser.sessionId,
        },
        body: JSON.stringify({ password }),
      });

      console.log("#####Res",response)
  
      // 상태 코드에 따라 처리
      if (response.ok) {
        // 성공 (HTTP 200)
        router.push(`/chat?room=${roomId}`);
      } else {
        // 상태 코드별 에러 메시지 처리
        switch (response.status) {
          case 401:
            setError('비밀번호가 올바르지 않습니다.');
            break;
          case 404:
            setError('채팅방을 찾을 수 없습니다.');
            break;
          case 500:
            setError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
            break;
          default:
            setError('예기치 않은 오류가 발생했습니다.');
        }
      }
    } catch (error) {
      console.error('Room join error:', error);
      setError('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };
  


  return (
    <div className="auth-container">
      <Card className="auth-card">
        <Card.Header>
          <Text as="h5" typography="heading5">
            비밀번호 입력
          </Text>
        </Card.Header>
        <Card.Body className="p-8">
          {error && (
            <Alert color="danger" className="mb-6">
              <AlertCircle className="w-4 h-4 mr-2" />
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <FormGroup>
              <Label htmlFor="roomPassword">채팅방 비밀번호</Label>
              <Input
                id="roomPassword"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                disabled={loading}
              />
            </FormGroup>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={loading || !password.trim()}
            >
              {loading ? '확인 중...' : '입장하기'}
            </Button>
          </form>
        </Card.Body>
      </Card>
    </div>
  );
}

export default SecretChatRoom;
