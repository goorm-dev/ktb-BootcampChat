import React, { useState, useEffect } from 'react';
import { WarningIcon, TimeIcon } from '@vapor-ui/icons';
import { Button, Text, Callout } from '@vapor-ui/core';

const DuplicateLoginModal = ({ 
  isOpen, 
  onClose, 
  deviceInfo, 
  ipAddress,
  onTimeout 
}) => {
  const [timeLeft, setTimeLeft] = useState(10);

  useEffect(() => {
    if (!isOpen) return;

    // 10초 카운트다운
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      setTimeLeft(10);
    };
  }, [isOpen, onTimeout]);

  if (!isOpen) return null;

  return (
    <>
      <div className="modal fade show d-block" tabIndex="-1" role="dialog">
        <div className="modal-dialog modal-dialog-centered" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">중복 로그인 감지됨</h5>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                aria-label="Close"
              >
                ×
              </Button>
            </div>
            
            <div className="modal-body">
              <Callout color="danger">
                <div className="d-flex align-items-start gap-2">
                  <WarningIcon className="flex-shrink-0" size={20} />
                  <div>
                    <Text typography="body2" className="mb-2">다른 기기에서 로그인이 감지되었습니다.</Text>
                    <div className="mt-3">
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <small className="text-muted">접속 위치: {ipAddress}</small>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <small className="text-muted">디바이스: {deviceInfo}</small>
                      </div>
                    </div>
                  </div>
                </div>
              </Callout>

              <div className="text-center my-3">
                <div className="d-flex align-items-center justify-content-center gap-2">
                  <TimeIcon size={20} />
                  <span>{timeLeft}초 후에 자동으로 로그아웃됩니다.</span>
                </div>
              </div>

              <div className="progress" style={{ height: '4px' }}>
                <div 
                  className="progress-bar bg-warning"
                  role="progressbar"
                  style={{ 
                    width: `${(timeLeft / 10) * 100}%`,
                    transition: 'width 1s linear'
                  }}
                  aria-valuenow={timeLeft}
                  aria-valuemin="0"
                  aria-valuemax="10"
                />
              </div>
            </div>

            <div className="modal-footer">
              <Button
                variant="solid"
                color="primary"
                style={{ width: '100%' }}
                onClick={onTimeout}
              >
                지금 로그아웃
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show"></div>
    </>
  );
};

export default DuplicateLoginModal;