import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ErrorCircleIcon, CheckCircleIcon } from '@vapor-ui/icons';
import { Button, Box, VStack, HStack, Field, Form, Text, TextInput, Callout } from '@vapor-ui/core';
import authService from '@/services/authService';
import { withAuth, useAuth } from '@/contexts/AuthContext';
import ProfileImageUpload from '@/components/ProfileImageUpload';
import { generateColorFromEmail, getContrastTextColor } from '@/utils/colorUtils';

const Profile = () => {
  const { user, updateProfile: updateProfileContext, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const avatarStyleRef = useRef(null);

  // 초기 폼 데이터 설정
  useEffect(() => {
    if (user) {
      setFormData(prev => ({ ...prev, name: user.name }));

      // 아바타 스타일 설정
      if (!avatarStyleRef.current && user.email) {
        const backgroundColor = generateColorFromEmail(user.email);
        const color = getContrastTextColor(backgroundColor);
        avatarStyleRef.current = { backgroundColor, color };
      }
    }
  }, [user]);

  const handleImageChange = useCallback(async (imageUrl) => {
    // ProfileImageUpload 컴포넌트에서 이미 업로드를 처리하므로
    // Context의 사용자 정보만 업데이트
    updateUser({ profileImage: imageUrl });
  }, [updateUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.newPassword !== formData.confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);

    try {
      // 비밀번호 변경 처리
      if (formData.newPassword) {
        await authService.changePassword(
          '',
          formData.newPassword,
          user.token,
          user.sessionId
        );
      }

      // 이름 변경 처리
      if (formData.name !== user.name) {
        // AuthContext의 updateProfile 사용 (API 호출 + 상태 저장)
        await updateProfileContext({ name: formData.name });
      }

      // 성공 메시지 설정
      setSuccess('프로필이 성공적으로 업데이트되었습니다.');

      // 비밀번호 필드 초기화
      setFormData(prev => ({
        ...prev,
        newPassword: '',
        confirmPassword: ''
      }));

    } catch (err) {
      console.error('Profile update error:', err);
      setError(err.response?.data?.message || err.message || '프로필 업데이트 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      padding="$300"
    >
      <VStack
        gap="$400"
        width="400px"
        padding="$400"
        borderRadius="$300"
        border="1px solid var(--vapor-color-border-normal)"
        backgroundColor="var(--vapor-color-surface-raised)"
        render={<Form onSubmit={handleSubmit} />}
      >
        <Text typography="heading4">프로필 설정</Text>
        
        <Box display="flex" justifyContent="center" width="100%">
          <ProfileImageUpload
            currentImage={user.profileImage}
            onImageChange={handleImageChange}
          />
        </Box>

        {error && (
          <Callout.Root colorPalette="danger" data-testid="profile-error-message">
            <Callout.Icon>
              <ErrorCircleIcon />
            </Callout.Icon>
            {error}
          </Callout.Root>
        )}

        {success && (
          <Callout.Root colorPalette="success" data-testid="profile-success-message">
            <Callout.Icon>
              <CheckCircleIcon />
            </Callout.Icon>
            {success}
          </Callout.Root>
        )}

        <VStack gap="$300">
          <Field.Root>
            <Box render={<Field.Label />} flexDirection="column">
              <Text typography="subtitle2" foreground="normal-200">
                이메일
              </Text>
              <TextInput
                id="profile-email"
                size="lg"
                type="email"
                value={user.email}
                disabled
              />
            </Box>
          </Field.Root>
          
          <Field.Root>
            <Box render={<Field.Label />} flexDirection="column">
              <Text typography="subtitle2" foreground="normal-200">
                이름
              </Text>
              <TextInput
                id="profile-name"
                size="lg"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                disabled={loading}
                required
                placeholder="이름을 입력하세요"
                data-testid="profile-name-input"
              />
            </Box>
            <Field.Error match="valueMissing">이름을 입력해주세요.</Field.Error>
          </Field.Root>
          
          <Field.Root>
            <Box render={<Field.Label />} flexDirection="column">
              <Text typography="subtitle2" foreground="normal-200">
                새 비밀번호
              </Text>
              <TextInput
                id="profile-new-password"
                size="lg"
                type="password"
                value={formData.newPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                disabled={loading}
                placeholder="새 비밀번호를 입력하세요"
                pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{8,16}"
                data-testid="new-password-input"
              />
            </Box>
            <Field.Description>
              8~16자, 대소문자 영문, 숫자, 특수문자 포함
            </Field.Description>
            <Field.Error match="patternMismatch">
              유효한 비밀번호 형식이 아닙니다.
            </Field.Error>
          </Field.Root>
          
          <Field.Root>
            <Box render={<Field.Label />} flexDirection="column">
              <Text typography="subtitle2" foreground="normal-200">
                새 비밀번호 확인
              </Text>
              <TextInput
                id="profile-confirm-password"
                size="lg"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                disabled={loading}
                placeholder="새 비밀번호를 다시 입력하세요"
                data-testid="confirm-password-input"
              />
            </Box>
          </Field.Root>

          <Button
            type="submit"
            size="lg"
            disabled={loading}
            data-testid="profile-save-button"
          >
            {loading ? '저장 중...' : '저장'}
          </Button>
        </VStack>
      </VStack>
    </Box>
  );
};

export default withAuth(Profile);