// frontend/services/axios.js
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// 재시도 설정
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 5000,
  backoffFactor: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableErrors: ['ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH', 'ERR_NETWORK']
};

// 기본 설정으로 axios 인스턴스 생성
const axiosInstance = axios.create({
  baseURL: API_BASE_URL || 'http://localhost:5000',
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

// 재시도 딜레이 계산 함수 
const getRetryDelay = (retryCount) => {
  // 지수 백오프와 약간의 무작위성 추가
  const delay = RETRY_CONFIG.initialDelayMs * 
    Math.pow(RETRY_CONFIG.backoffFactor, retryCount) *
    (1 + Math.random() * 0.1); // 지터 추가
  return Math.min(delay, RETRY_CONFIG.maxDelayMs);
};

// 재시도 가능한 에러인지 판단하는 함수
const isRetryableError = (error) => {
  if (!error) return false;
  
  // 네트워크 에러 코드 확인
  if (error.code && RETRY_CONFIG.retryableErrors.includes(error.code)) {
    return true;
  }
  
  // HTTP 상태 코드 확인
  if (error.response?.status && RETRY_CONFIG.retryableStatuses.includes(error.response.status)) {
    return true;
  }
  
  // 응답이 없는 경우 (네트워크 에러)
  if (!error.response && error.request) {
    return true;
  }
  
  return false;
};

// 요청 취소 토큰 저장소
const pendingRequests = new Map();

// 이전 요청 취소 함수
const cancelPendingRequests = (config) => {
  const requestKey = `${config.method}:${config.url}`;
  const previousRequest = pendingRequests.get(requestKey);
  
  if (previousRequest) {
    previousRequest.cancel('Request canceled due to duplicate request');
    pendingRequests.delete(requestKey);
  }
};

// 요청 인터셉터
axiosInstance.interceptors.request.use(
  (config) => {
    // 요청 데이터 검증
    if (config.method !== 'get' && !config.data) {
      config.data = {};
    }

    // localStorage에서 직접 사용자 정보 읽기
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user?.token) {
        config.headers['x-auth-token'] = user.token;
        if (user.sessionId) {
          config.headers['x-session-id'] = user.sessionId;
        }
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// 응답 인터셉터
axiosInstance.interceptors.response.use(
  (response) => {
    // 성공한 요청 제거
    const requestKey = `${response.config.method}:${response.config.url}`;
    pendingRequests.delete(requestKey);
    
    return response;
  },
  async (error) => {
    const config = error.config || {};
    config.retryCount = config.retryCount || 0;

    // 요청이 취소된 경우
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    // 401 에러 (인증 만료) - localStorage 자동 삭제 및 로그아웃 처리
    if (error.response?.status === 401) {
      
      // localStorage에서 사용자 정보 삭제
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user');
        localStorage.removeItem('lastTokenVerification');
        
        // 로그인 페이지로 리다이렉트 (현재 페이지가 로그인 페이지가 아닌 경우에만)
        if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
          window.location.href = '/';
        }
      }
      
      // 401 에러는 재시도하지 않고 즉시 반환
      const authError = new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
      authError.status = 401;
      authError.code = 'AUTH_EXPIRED';
      authError.config = config;
      authError.originalError = error;
      throw authError;
    }

    // 재시도 가능한 에러이고 최대 재시도 횟수에 도달하지 않은 경우
    if (isRetryableError(error) && config.retryCount < RETRY_CONFIG.maxRetries) {
      config.retryCount++;
      const delay = getRetryDelay(config.retryCount);

      try {
        // 딜레이 후 재시도
        await new Promise(resolve => setTimeout(resolve, delay));
        return await axiosInstance(config);
      } catch (retryError) {
        return Promise.reject(retryError);
      }
    }

    // 에러 유형별 처리
    if (!error.response) {
      // 네트워크 오류
      const customError = new Error();
      customError.message = [
        '서버와 통신할 수 없습니다.',
        '네트워크 연결을 확인하고 잠시 후 다시 시도해주세요.',
        error.code ? `(Error: ${error.code})` : ''
      ].filter(Boolean).join(' ');
      
      customError.isNetworkError = true;
      customError.originalError = error;
      customError.status = 0;
      customError.code = error.code || 'NETWORK_ERROR';
      customError.config = config;
      
      customError.retry = async () => {
        try {
          return await axiosInstance(config);
        } catch (retryError) {
          throw retryError;
        }
      };
      
      throw customError;
    }

    // HTTP 상태 코드별 처리
    const status = error.response.status;
    const errorData = error.response.data;

    let errorMessage;

    switch (status) {
      case 400:
        errorMessage = errorData?.message || '잘못된 요청입니다.';
        break;

      case 401:
        errorMessage = '인증이 필요하거나 만료되었습니다.';
        break;

      case 403:
        errorMessage = errorData?.message || '접근 권한이 없습니다.';
        break;

      case 404:
        errorMessage = errorData?.message || '요청한 리소스를 찾을 수 없습니다.';
        break;

      case 408:
        errorMessage = '요청 시간이 초과되었습니다.';
        break;

      case 429:
        errorMessage = '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.';
        break;

      case 500:
        errorMessage = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        break;

      case 502:
      case 503:
      case 504:
        errorMessage = '서버가 일시적으로 응답할 수 없습니다. 잠시 후 다시 시도해주세요.';
        break;

      default:
        errorMessage = errorData?.message || '예기치 않은 오류가 발생했습니다.';
    }

    // 에러 객체 생성 및 메타데이터 추가
    const enhancedError = new Error(errorMessage);
    enhancedError.status = status;
    enhancedError.code = errorData?.code;
    enhancedError.data = errorData;
    enhancedError.config = config;
    enhancedError.originalError = error;
    enhancedError.retry = async () => {
      try {
        return await axiosInstance(config);
      } catch (retryError) {
        throw retryError;
      }
    };

    throw enhancedError;
  }
);

// 인스턴스 내보내기
export default axiosInstance;