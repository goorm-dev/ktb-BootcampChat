import { useRef, useEffect } from 'react';

/**
 * 메시지 추가 시 스크롤 위치를 복원하는 훅
 * 
 * 채팅 메시지를 위에 추가할 때, 사용자가 보고 있던 메시지 위치를 유지합니다.
 * 
 * @param {Array} messages - 메시지 배열
 * @param {boolean} isLoading - 메시지 로딩 중 여부
 * @returns {Object} containerRef - 스크롤 컨테이너에 연결할 ref
 */
export const useScrollRestoration = (messages = [], isLoading = false) => {
  const containerRef = useRef(null);
  const previousScrollHeightRef = useRef(0);
  const previousScrollTopRef = useRef(0);
  const isRestoringRef = useRef(false);

  // 로딩 시작 시 현재 스크롤 위치 저장
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (isLoading && !isRestoringRef.current) {
      previousScrollHeightRef.current = container.scrollHeight;
      previousScrollTopRef.current = container.scrollTop;
      isRestoringRef.current = true;
    }
  }, [isLoading]);

  // 메시지 변경 시 스크롤 위치 복원
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isRestoringRef.current || isLoading) return;

    // 로딩이 끝났을 때만 복원
    const newScrollHeight = container.scrollHeight;
    const heightDifference = newScrollHeight - previousScrollHeightRef.current;

    if (heightDifference > 0) {
      // 새로 추가된 메시지 높이만큼 스크롤 위치 조정
      container.scrollTop = previousScrollTopRef.current + heightDifference;
    }

    isRestoringRef.current = false;
  }, [messages, isLoading]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      previousScrollHeightRef.current = 0;
      previousScrollTopRef.current = 0;
      isRestoringRef.current = false;
    };
  }, []);

  return containerRef;
};

export default useScrollRestoration;
