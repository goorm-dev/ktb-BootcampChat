import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { ThemeProvider } from '@vapor-ui/core';
import { createThemeConfig } from '@vapor-ui/core';
import '@vapor-ui/core/styles.css';
import '../styles/globals.css';
import Navbar from '../components/Navbar';

// Create dark theme configuration
const themeConfig = createThemeConfig({
  appearance: 'dark',
  radius: 'md',
  scaling: 1.0,
  colors: {
    primary: '#3b82f6',
    secondary: '#64748b',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4',
  },
});

function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const showNavbar = !['/', '/register'].includes(router.pathname);

  return (
    <ThemeProvider config={themeConfig}>
      {showNavbar && <Navbar />}
      <Component {...pageProps} />
    </ThemeProvider>
  );
}

export default MyApp;