import { useRef, useEffect, useCallback } from 'react';

/**
 * IntersectionObserver 기반 무한 스크롤 훅
 * 
 * @param {Function} onLoadMore - 더 로드할 때 호출할 함수
 * @param {boolean} hasMore - 더 불러올 데이터가 있는지 여부
 * @param {boolean} isLoading - 현재 로딩 중인지 여부
 * @param {Object} options - IntersectionObserver 옵션
 * @returns {Object} { sentinelRef } - Sentinel 요소에 연결할 ref
 */
export const useInfiniteScroll = (
  onLoadMore,
  hasMore = true,
  isLoading = false,
  options = {}
) => {
  const sentinelRef = useRef(null);
  const observerRef = useRef(null);

  const handleIntersect = useCallback(
    (entries) => {
      const [entry] = entries;

      if (entry.isIntersecting && hasMore && !isLoading) {
        onLoadMore();
      }
    },
    [onLoadMore, hasMore, isLoading]
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) {
      return;
    }

    // IntersectionObserver 옵션 설정
    const observerOptions = {
      root: options.root || null, // viewport 기준
      rootMargin: options.rootMargin || '0px', // 200px 전에 미리 로드
      threshold: options.threshold || 0.1, // 10% 이상 보이면 트리거
      ...options
    };

    // Observer 생성
    observerRef.current = new IntersectionObserver(
      handleIntersect,
      observerOptions
    );

    observerRef.current.observe(sentinel);

    return () => {
      if (observerRef.current && sentinel) {
        observerRef.current.unobserve(sentinel);
      }
    };
  }, [hasMore, handleIntersect, options]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);

  return { sentinelRef };
};

export default useInfiniteScroll;
