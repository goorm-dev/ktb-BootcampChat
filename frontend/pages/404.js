import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";

export default function Custom404() {
  const router = useRouter();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "system-ui, -apple-system, sans-serif",
        textAlign: "center",
        padding: "20px",
      }}
    >
      <h1 style={{ fontSize: "72px", marginBottom: "16px", color: "#333" }}>
        404
      </h1>
      <h2 style={{ fontSize: "24px", marginBottom: "16px", color: "#666" }}>
        페이지를 찾을 수 없습니다
      </h2>
      <p style={{ fontSize: "16px", color: "#888", marginBottom: "32px" }}>
        요청하신 페이지가 존재하지 않거나 이동되었습니다.
      </p>
      <div style={{ display: "flex", gap: "16px" }}>
        <Link
          href="/"
          style={{
            padding: "12px 24px",
            backgroundColor: "#007bff",
            color: "white",
            textDecoration: "none",
            borderRadius: "6px",
            fontSize: "16px",
          }}
        >
          홈으로 가기
        </Link>
        <button
          onClick={() => router.back()}
          style={{
            padding: "12px 24px",
            backgroundColor: "#6c757d",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontSize: "16px",
            cursor: "pointer",
          }}
        >
          이전 페이지로
        </button>
      </div>
    </div>
  );
}
