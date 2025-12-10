import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { ErrorCircleIcon, CheckCircleIcon } from '@vapor-ui/icons';
import {
    Box,
    Button,
    Callout,
    Field,
    Form,
    HStack,
    Text,
    TextInput,
    VStack,
} from '@vapor-ui/core';
import { useAuth, withoutAuth } from '@/contexts/AuthContext';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { register: registerContext } = useAuth();

  const validateForm = () => {
    // 비밀번호 일치 확인만 추가 검증 (나머지는 HTML5 폼 검증)
    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { name, email, password } = formData;
      await registerContext({ name, email, password });
      
      setSuccess(true);
      setLoading(false);
      
      setTimeout(() => {
        router.push('/login');
      }, 1000);
    } catch (err) {
      setError(err.message || '회원가입 처리 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-[var(--vapor-space-300)] bg-[var(--vapor-color-background)]">
      <VStack
        gap="$250"
        width="400px"
        padding="$300"
        borderRadius="$300"
        border="1px solid var(--vapor-color-border-normal)"
        render={<Form onSubmit={handleSubmit} />}
      >
        <div className="text-center mb-4">
          <img src="images/logo-h.png" class="w-1/2 mx-auto" />
        </div>

        {error && (
          <Callout.Root colorPalette="warning" data-testid="register-error-message">
            <Callout.Icon>
              <ErrorCircleIcon />
            </Callout.Icon>
            {error}
          </Callout.Root>
        )}

        {success && (
          <Callout.Root colorPalette="success" data-testid="register-success-message">
            <Callout.Icon>
              <CheckCircleIcon />
            </Callout.Icon>
            가입성공, 로그인 해 주세요.
          </Callout.Root>
        )}

        <VStack gap="$400">
          <VStack gap="$200">
            <Field.Root>
              <Box
                render={<Field.Label />}
                flexDirection="column"
                style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}
              >
                이름
                <TextInput
                  id="register-name"
                  size="lg"
                  type="text"
                  required
                  disabled={loading}
                  value={formData.name}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, name: value }))}
                  placeholder="이름을 입력하세요"
                  data-testid="register-name-input"
                />
              </Box>
              <Field.Error match="valueMissing">이름을 입력해주세요.</Field.Error>
            </Field.Root>

            <Field.Root>
              <Box
                render={<Field.Label />}
                flexDirection="column"
                style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}
              >
                이메일
                <TextInput
                  id="register-email"
                  size="lg"
                  type="email"
                  required
                  disabled={loading}
                  value={formData.email}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, email: value }))}
                  placeholder="이메일을 입력하세요"
                  data-testid="register-email-input"
                />
              </Box>
              <Field.Error match="valueMissing">이메일을 입력해주세요.</Field.Error>
              <Field.Error match="typeMismatch">유효한 이메일 형식이 아닙니다.</Field.Error>
            </Field.Root>

            <Field.Root>
              <Box
                render={<Field.Label />}
                flexDirection="column"
                style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}
              >
                비밀번호
                <TextInput
                  id="register-password"
                  size="lg"
                  type="password"
                  required
                  disabled={loading}
                  value={formData.password}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, password: value }))}
                  placeholder="비밀번호를 입력하세요"
                  pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{8,16}"
                  data-testid="register-password-input"
                />
              </Box>
              <Field.Description>8~16자, 대소문자 영문, 숫자, 특수문자 포함</Field.Description>
              <Field.Error match="valueMissing">비밀번호를 입력해주세요.</Field.Error>
              <Field.Error match="patternMismatch">유효한 비밀번호 형식이 아닙니다.</Field.Error>
            </Field.Root>

            <Field.Root>
              <Box
                render={<Field.Label />}
                flexDirection="column"
                style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}
              >
                비밀번호 확인
                <TextInput
                  id="register-password-confirm"
                  size="lg"
                  type="password"
                  required
                  disabled={loading}
                  value={formData.confirmPassword}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, confirmPassword: value }))}
                  placeholder="비밀번호를 다시 입력하세요"
                  data-testid="register-password-confirm-input"
                />
              </Box>
              <Field.Error match="valueMissing">비밀번호 확인을 입력해주세요.</Field.Error>
            </Field.Root>
          </VStack>

          <Button
            type="submit"
            size="lg"
            disabled={loading}
            data-testid="register-submit-button"
          >
            {loading ? '회원가입 중...' : '회원가입'}
          </Button>
        </VStack>

        <HStack justifyContent="center">
          <Text typography="body2">이미 계정이 있으신가요?</Text>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => router.push('/')}
            disabled={loading}
          >
            로그인
          </Button>
        </HStack>
      </VStack>
    </div>
  );
};

export default withoutAuth(Register);
