// frontend-react/src/services/fileService.js
import axios from 'axios';
import authService from './authService';
import { Toast } from '../components/Toast';
// 백엔드 API와 통신하기 위한 axios 인스턴스
import axiosInstance from './axios';

class FileService {
  constructor() {
    this.baseUrl = process.env.REACT_APP_API_URL;
  }

  
  async validateFile(file) {
    if (!file) {
      return { success: false, message: '파일이 선택되지 않았습니다.' };
    }
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      return { success: false, message: '파일 크기는 50MB를 초과할 수 없습니다.' };
    }
    return { success: true };
  }
  
  
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  
  async uploadFile(file, roomId, onProgress) {
    // 1. 파일 유효성 검사
    const validationResult = await this.validateFile(file);
    if (!validationResult.success) {
      Toast.error(validationResult.message);
      return validationResult;
    }

    // 2. 사용자 인증 정보 확인
    const user = authService.getCurrentUser();
    if (!user?.token || !user?.sessionId) {
      const message = '인증 정보가 유효하지 않습니다. 다시 로그인해주세요.';
      Toast.error(message);
      return { success: false, message };
    }

    try {
      // --- 1단계: Presigned URL 생성 요청 ---
      console.log('[File Upload] Step 1: Requesting Presigned URL...');
      const presignedUrlResponse = await axiosInstance.post('/api/files/presigned-url', {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        roomId: roomId
      });

      const { presignedUrl, fileId } = presignedUrlResponse.data;
      if (!presignedUrl || !fileId) {
        throw new Error('Presigned URL을 받아오지 못했습니다.');
      }
      console.log('[File Upload] Step 1 Success:', { fileId });

      // --- 2단계: S3로 실제 파일 업로드 ---
      // 중요: S3 업로드 시에는 인증 헤더(Bearer Token)가 필요 없으므로,
      // 기본 axios 인스턴스가 아닌 일반 axios를 사용합니다.
      console.log('[File Upload] Step 2: Uploading file to S3...');
      await axios.put(presignedUrl, file, {
        headers: {
          'Content-Type': file.type,
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress(percentCompleted);
          }
        },
      });
      console.log('[File Upload] Step 2 Success');

      // --- 3단계: 업로드 완료 처리 ---
      console.log('[File Upload] Step 3: Notifying server of completion...');
      const completeResponse = await axiosInstance.patch(`/api/files/${fileId}/complete`);
      
      console.log('[File Upload] Step 3 Success:', completeResponse.data);

      // 최종적으로 백엔드에서 받은 완료된 파일 객체를 반환합니다.
      return {
        success: true,
        data: {
            file: completeResponse.data
        },
      };

    } catch (error) {
      console.error('[File Upload] Error:', error);
      const errorMessage = error.response?.data?.message || error.message || '파일 업로드 중 오류가 발생했습니다.';
      Toast.error(errorMessage);
      return {
        success: false,
        message: errorMessage
      };
    }
  }

  
  async downloadFile(fileId) {
    try {
      const response = await axiosInstance.get(`/api/files/download/${fileId}`, {
        responseType: 'blob',
      });
      return response;
    } catch (error) {
      console.error('파일 다운로드 에러', error);
      Toast.error(error.response?.data?.message || '파일 다운로드에 실패했습니다.');
      throw error;
    }
  }
}

const fileServiceInstance = new FileService();
export default fileServiceInstance;
