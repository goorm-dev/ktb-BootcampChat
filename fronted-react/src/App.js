// src/App.js
import React from 'react';
import { ThemeProvider, createThemeConfig } from '@vapor-ui/core';
import '@vapor-ui/core/styles.css';
import './index.css'; // globals.css의 내용이 담긴 파일
import AppRouter from './Router';

// _app.js 에 있던 테마 설정을 가져옵니다.
const themeConfig = createThemeConfig({
  appearance: 'dark',
  // ... (기존 themeConfig 내용)
});

function App() {
  return (
    <ThemeProvider config={themeConfig}>
      <AppRouter />
    </ThemeProvider>
  );
}

export default App;