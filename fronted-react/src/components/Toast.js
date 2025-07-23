import React from 'react';
import { ToastContainer, toast, Slide } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css'
import { 
  ErrorCircleIcon, 
  SuccessCircleIcon, 
  InfoIcon, 
  WarningIcon,
  ErrorCircleIcon as XCircleIcon 
} from '@vapor-ui/icons';

// Toast 타입별 설정
const TOAST_TYPES = {
  success: {
    type: 'success',
    duration: 3000
  },
  error: {
    type: 'error',
    duration: 5000
  },
  warning: {
    type: 'warning',
    duration: 4000
  },
  info: {
    type: 'info',
    duration: 3000
  }
};

// Toast 클래스 정의
class Toast {
  static show(message, type = 'info', options = {}) {
    const config = TOAST_TYPES[type] || TOAST_TYPES.info;

    toast[config.type](
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{message}</span>
      </div>,
      {
        position: "top-right",
        autoClose: options.duration || config.duration,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        ...options
      }
    );
  }

  static success(message, options = {}) {
    this.show(message, 'success', options);
  }

  static error(message, options = {}) {
    this.show(message, 'error', options);
  }

  static warning(message, options = {}) {
    this.show(message, 'warning', options);
  }

  static info(message, options = {}) {
    this.show(message, 'info', options);
  }
  
  static dismiss(toastId) {
    if (toastId) {
      toast.dismiss(toastId);
    } else {
      toast.dismiss(); // 모든 toast 닫기
    }
  }

  static isActive(toastId) {
    return toast.isActive(toastId);
  }
}

// Container 컴포넌트
const ToastContainer$ = () => {
  return (
    <ToastContainer
      position="top-right"
      autoClose={3000}
      hideProgressBar={true}
      newestOnTop={true}
      closeOnClick={true}
      rtl={false}
      pauseOnFocusLoss={true}
      draggable={true}
      pauseOnHover={true}
      theme="light"
      transition={Slide}
    />
  );
};

export { Toast };
export default ToastContainer$;