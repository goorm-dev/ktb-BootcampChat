import React from 'react';
import { ToastContainer, toast, Slide } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.min.css';
import { Callout } from '@vapor-ui/core';
import { 
  CheckCircleIcon,
  ErrorCircleIcon,
  InfoCircleOutlineIcon,
  WarningIcon
} from '@vapor-ui/icons';

// react-toastify 기본 스타일 제거
const toastStyles = `
  .Toastify__toast {
    background: transparent !important;
    box-shadow: none !important;
    padding: 0 !important;
    min-height: auto !important;
  }
  
  .Toastify__toast-body {
    padding: 0 !important;
    margin: 0 !important;
  }
  
  .Toastify__close-button {
    display: none !important;
  }
  
  .Toastify__toast-icon {
    display: none !important;
  }
`;

// Toast 타입별 설정
const TOAST_TYPES = {
  success: {
    type: 'success',
    colorPalette: 'success',
    icon: CheckCircleIcon,
    duration: 3000
  },
  error: {
    type: 'error',
    colorPalette: 'danger',
    icon: ErrorCircleIcon,
    duration: 5000
  },
  warning: {
    type: 'warning',
    colorPalette: 'warning',
    icon: WarningIcon,
    duration: 4000
  },
  info: {
    type: 'info',
    colorPalette: 'primary',
    icon: InfoCircleOutlineIcon,
    duration: 3000
  }
};

// Vapor-UI Callout 스타일 Toast 컴포넌트
const CalloutToast = ({ message, type }) => {
  const config = TOAST_TYPES[type] || TOAST_TYPES.info;
  const IconComponent = config.icon;

  return (
    <Callout.Root colorPalette={config.colorPalette} data-testid={`toast-${type}`}>
      <Callout.Icon>
        <IconComponent />
      </Callout.Icon>
      {message}
    </Callout.Root>
  );
};

// Toast 클래스 정의
class Toast {
  static show(message, type = 'info', options = {}) {
    const config = TOAST_TYPES[type] || TOAST_TYPES.info;

    toast[config.type](
      <CalloutToast message={message} type={type} />,
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
    <>
      <style>{toastStyles}</style>
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
    </>
  );
};

export { Toast };
export default ToastContainer$;