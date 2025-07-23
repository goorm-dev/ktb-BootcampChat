import React from 'react';
import Link from 'next/link';

export default function Custom404() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      textAlign: 'center',
      padding: '20px'
    }}>
      <h1 style={{ fontSize: '72px', marginBottom: '16px', color: '#333' }}>404</h1>
      <h2 style={{ fontSize: '24px', marginBottom: '16px', color: '#666' }}>
        Page Not Found
      </h2>
      <p style={{ fontSize: '16px', color: '#888', marginBottom: '32px' }}>
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Link href="/" style={{
        padding: '12px 24px',
        backgroundColor: '#007bff',
        color: 'white',
        textDecoration: 'none',
        borderRadius: '6px',
        fontSize: '16px'
      }}>
        Go to Home
      </Link>
    </div>
  );
}