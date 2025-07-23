import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { ErrorCircleIcon, StarIcon } from '@vapor-ui/icons';
import ReactCanvasConfetti from 'react-canvas-confetti';
import { Button, Card, Text, Callout, TextInput } from '@vapor-ui/core';
import { Flex, Stack, Center, Box } from '../components/ui/Layout';
import authService from '../services/authService';

const canvasStyles = {
  position: 'fixed',
  pointerEvents: 'none',
  width: '100%',
  height: '100%',
  top: 0,
  left: 0,
  zIndex: 9999
};

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const navigate = useNavigate(); 
  const refAnimationInstance = useRef(null);

  const getInstance = useCallback((instance) => {
    refAnimationInstance.current = instance;
  }, []);

  const makeShot = useCallback((particleRatio, opts) => {
    refAnimationInstance.current?.({
      ...opts,
      origin: { y: 0.7 },
      particleCount: Math.floor(200 * particleRatio),
    });
  }, []);

  const fireConfetti = useCallback(() => {
    makeShot(0.25, {
      spread: 26,
      startVelocity: 55,
    });

    makeShot(0.2, {
      spread: 60,
    });

    makeShot(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
    });

    makeShot(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
    });

    makeShot(0.1, {
      spread: 120,
      startVelocity: 45,
    });
  }, [makeShot]);

  const validateForm = () => {
    const newErrors = [];
    
    if (!formData.name?.trim()) {
      newErrors.push({ field: 'name', message: '이름을 입력해주세요.' });
    }
    
    if (!formData.email?.trim()) {
      newErrors.push({ field: 'email', message: '이메일을 입력해주세요.' });
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.push({ field: 'email', message: '올바른 이메일 형식이 아닙니다.' });
      }
    }
    
    if (!formData.password) {
      newErrors.push({ field: 'password', message: '비밀번호를 입력해주세요.' });
    } else if (formData.password.length < 6) {
      newErrors.push({ field: 'password', message: '비밀번호는 6자 이상이어야 합니다.' });
    }
    
    if (!formData.confirmPassword) {
      newErrors.push({ field: 'confirmPassword', message: '비밀번호 확인을 입력해주세요.' });
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.push({ field: 'confirmPassword', message: '비밀번호가 일치하지 않습니다.' });
    }
    
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors([]);

    try {
      const { name, email, password } = formData;
      // 회원가입
      await authService.register({ name, email, password });
      
      // 바로 로그인 처리
      await authService.login({ email, password });
      
      // 회원가입 성공 처리
      setShowSuccessModal(true);
      fireConfetti();
      
      // 10초 후 채팅방 목록 페이지로 이동
      setTimeout(() => {
        navigate('/chat-rooms');
      }, 10000);

    } catch (err) {
      console.error('Registration error:', err);
      
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      } else if (err.response?.data?.message) {
        setErrors([{ message: err.response.data.message }]);
      } else {
        setErrors([{ message: '회원가입 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const getFieldError = (fieldName) => {
    return errors.find(error => error.field === fieldName)?.message;
  };

  return (
    <div className="auth-container">
      <ReactCanvasConfetti refConfetti={getInstance} style={canvasStyles} />
      
      <Card.Root className="auth-card">
        <Card.Body className="card-body">
          <Stack gap="300" align="center">
            <img src="images/logo.png" style={{ width: '50%' }} alt="Logo" />
            <Text typography="heading3">회원가입</Text>
          </Stack>

          {errors.length > 0 && (
            <Box mt="400">
              <Callout color="danger">
                <Flex align="center" gap="200">
                  <ErrorCircleIcon size={18} />
                  <Stack gap="100">
                    {errors.map((error, index) => (
                      <Text key={index} typography="body3">
                        {error.message}
                      </Text>
                    ))}
                  </Stack>
                </Flex>
              </Callout>
            </Box>
          )}

          <Box mt="400">
            <form onSubmit={handleSubmit}>
              <Stack gap="300">
                <TextInput.Root type="text" value={formData.name} onValueChange={(value) => setFormData(prev => ({ ...prev, name: value }))} disabled={loading} invalid={!!getFieldError('name')} placeholder="이름을 입력하세요">
                  <TextInput.Label>이름 <span style={{ color: 'var(--vapor-color-danger)' }}>*</span></TextInput.Label>
                  <TextInput.Field
                    id="name"
                    name="name"
                    placeholder="이름을 입력하세요"
                    required
                    style={{ width: '100%' }}
                  />
                </TextInput.Root>
                {getFieldError('name') && (
                  <Text typography="body3" color="danger">{getFieldError('name')}</Text>
                )}

                <TextInput.Root type="email" value={formData.email} onValueChange={(value) => setFormData(prev => ({ ...prev, email: value }))} disabled={loading} invalid={!!getFieldError('email')} placeholder="이메일을 입력하세요">
                  <TextInput.Label>이메일 <span style={{ color: 'var(--vapor-color-danger)' }}>*</span></TextInput.Label>
                  <TextInput.Field
                    id="email"
                    name="email"
                    placeholder="이메일을 입력하세요"
                    required
                    style={{ width: '100%' }}
                  />
                </TextInput.Root>
                {getFieldError('email') && (
                  <Text typography="body3" color="danger">{getFieldError('email')}</Text>
                )}

                <TextInput.Root type="password" value={formData.password} onValueChange={(value) => setFormData(prev => ({ ...prev, password: value }))} disabled={loading} invalid={!!getFieldError('password')} placeholder="비밀번호를 입력하세요">
                  <TextInput.Label>비밀번호 <span style={{ color: 'var(--vapor-color-danger)' }}>*</span></TextInput.Label>
                  <TextInput.Field
                    id="password"
                    name="password"
                    placeholder="비밀번호를 입력하세요"
                    required
                    style={{ width: '100%' }}
                  />
                </TextInput.Root>
                {getFieldError('password') && (
                  <Text typography="body3" color="danger">{getFieldError('password')}</Text>
                )}

                <TextInput.Root type="password" value={formData.confirmPassword} onValueChange={(value) => setFormData(prev => ({ ...prev, confirmPassword: value }))} disabled={loading} invalid={!!getFieldError('confirmPassword')} placeholder="비밀번호를 다시 입력하세요">
                  <TextInput.Label>비밀번호 확인 <span style={{ color: 'var(--vapor-color-danger)' }}>*</span></TextInput.Label>
                  <TextInput.Field
                    id="confirmPassword"
                    name="confirmPassword"
                    placeholder="비밀번호를 다시 입력하세요"
                    required
                    style={{ width: '100%' }}
                  />
                </TextInput.Root>
                {getFieldError('confirmPassword') && (
                  <Text typography="body3" color="danger">{getFieldError('confirmPassword')}</Text>
                )}

              </Stack>
              
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
                <Button
                  type="submit"
                  size="lg"
                  color="primary"
                  disabled={loading}
                  style={{ minWidth: '200px' }}
                >
                  {loading ? '회원가입 중...' : '회원가입'}
                </Button>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '2rem' }}>
                <Stack gap="100" align="center">
                  <Text typography="body3">이미 계정이 있으신가요?</Text>
                  <Button
                    size="md"
                    onClick={() => navigate('/')}
                    disabled={loading}
                  >
                    로그인
                  </Button>
                </Stack>
              </div>

            </form>
          </Box>
        </Card.Body>
      </Card.Root>

      {/* Success Modal - Bootstrap Modal */}
      {showSuccessModal && (
        <>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <StarIcon size={24} className="me-2" />
                    회원가입 성공
                  </h5>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSuccessModal(false)}
                    aria-label="Close"
                  >
                    ×
                  </Button>
                </div>
                
                <div className="modal-body text-center py-4">
                  <h4 className="text-success mb-3">회원가입을 축하합니다!</h4>
                  <Text typography="body2" color="neutral-weak">10초 후 채팅방 목록으로 이동합니다.</Text>
                </div>
                
                <div className="modal-footer">
                  <Button
                    color="primary"
                    style={{ width: '100%' }}
                    onClick={() => navigate('/chat-rooms')}
                  >
                    지금 이동하기
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}
    </div>
  );
};

export default Register;