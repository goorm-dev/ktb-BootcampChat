import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";

function Error() {
  const [statusCode, setStatusCode] = useState("Error");
  const router = useRouter();

  useEffect(() => {
    // 클라이언트 사이드에서 에러 정보 가져오기
    const getErrorInfo = () => {
      // URL에서 에러 정보 확인
      const urlParams = new URLSearchParams(window.location.search);
      const errorCode = urlParams.get("error");

      if (errorCode) {
        setStatusCode(errorCode);
      } else {
        // 기본적으로 404 에러로 처리
        setStatusCode("404");
      }
    };

    // 브라우저에서만 실행
    if (typeof window !== "undefined") {
      getErrorInfo();
    }
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "48px", marginBottom: "16px" }}>{statusCode}</h1>
      <p style={{ fontSize: "18px", color: "#666" }}>
        {statusCode === "404"
          ? "페이지를 찾을 수 없습니다"
          : `에러 ${statusCode}가 발생했습니다`}
      </p>
      <button
        onClick={() => router.push("/")}
        style={{
          marginTop: "20px",
          padding: "10px 20px",
          backgroundColor: "#007bff",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
        }}
      >
        홈으로 돌아가기
      </button>
    </div>
  );
}

export default Error;
