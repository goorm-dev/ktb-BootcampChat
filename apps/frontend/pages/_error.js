import Head from 'next/head';

const ErrorPage = () => {
  return (
    <>
      <Head>
        <title>Page Not Found</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap" rel="stylesheet" />
      </Head>
      <style jsx global>{`
        /* 모든 전역 CSS 리셋 (_app.js의 globals.css, Vapor UI 등) */
        html, body, div, span, h1, p, img, br {
          all: revert;
        }

        :root {
          --primary-blue: #00479D;
          --primary-sky: #6BC8F2;
        }

        html {
          height: auto !important;
          overflow: visible !important;
        }

        body {
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
          min-height: 100vh !important;
          margin: 0 !important;
          padding: 20px !important;
          font-family: 'Noto Sans KR', sans-serif !important;
          background-color: #f9f9f9 !important;
          color: #333 !important;
          box-sizing: border-box !important;
        }

        #__next {
          display: contents !important;
        }

        .error-page-container {
          text-align: center;
          max-width: 800px;
          width: 100%;
        }

        .error-page-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2rem;
        }

        .error-page-image {
          max-width: 100%;
          height: auto;
          max-height: 45vh;
          margin-bottom: 1rem;
        }

        .error-page-title {
          font-size: 3.5rem;
          font-weight: 900;
          color: var(--primary-blue);
          margin-bottom: 0.5rem;
          line-height: 1.2;
        }

        .error-page-animated-text span {
          display: inline-block;
          animation: bounce-rotate 1.2s ease-in-out infinite;
          color: var(--primary-blue);
          transform-origin: center;
          font-weight: 900;
        }

        .error-page-animated-text span:nth-child(1) { animation-delay: 0.15s; }
        .error-page-animated-text span:nth-child(2) { animation-delay: 0.3s; }
        .error-page-animated-text span:nth-child(3) { animation-delay: 0.45s; }
        .error-page-animated-text span:nth-child(4) { animation-delay: 0.6s; }
        .error-page-animated-text span:nth-child(5) { animation-delay: 0.75s; }

        @keyframes bounce-rotate {
          0% {
            transform: translateY(0) rotate(0deg) scale(1);
            color: #00479D;
          }
          25% {
            transform: translateY(-30px) rotate(-10deg) scale(1.2);
            color: #0052A3;
          }
          50% {
            transform: translateY(-15px) rotate(10deg) scale(1.1);
            color: #6BC8F2;
          }
          75% {
            transform: translateY(-25px) rotate(-5deg) scale(1.15);
            color: #0066CC;
          }
          100% {
            transform: translateY(0) rotate(0deg) scale(1);
            color: #00479D;
          }
        }

        .error-page-message {
          font-size: 1.25rem;
          line-height: 1.6;
          color: #555;
          margin-bottom: 2rem;
          word-break: keep-all;
        }

        @media (max-width: 768px) {
          .error-page-title {
            font-size: 2.5rem;
          }
          .error-page-mobile-break {
            display: block;
          }
          .error-page-message {
            font-size: 1rem;
          }
          .error-page-image {
            max-height: 40vh;
          }
        }

        @media (max-width: 480px) {
          .error-page-title {
            font-size: 1.75rem;
          }
        }
      `}</style>
      <div className="error-page-container">
        <div className="error-page-content">
          <img src="/404.svg" alt="404 Error: Page Not Found" className="error-page-image" />
          <h1 className="error-page-title">
            <span className="error-page-animated-text">
              <span>O</span>
              <span>O</span>
              <span>P</span>
              <span>S</span>
              <span>!</span>
            </span>
            <br className="error-page-mobile-break" />
            Page not found
          </h1>
          <p className="error-page-message">
            요청하신 페이지를 찾을 수 없습니다.<br />
            주소를 따라왔지만 원하는 목적지에 도착하지 못한 것 같아요.<br />
            잠시 후 다시 시도해 주세요.
          </p>
        </div>
      </div>
    </>
  );
};

export default ErrorPage;
