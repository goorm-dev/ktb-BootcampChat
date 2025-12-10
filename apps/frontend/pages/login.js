import { useEffect } from 'react';
import { useRouter } from 'next/router';

const LoginRedirect = () => {
  const router = useRouter();

  useEffect(() => {
    // query params도 함께 전달 (예: redirect 파라미터)
    router.replace({
      pathname: '/',
      query: router.query
    });
  }, [router]);

  return null;
};

export default LoginRedirect;  