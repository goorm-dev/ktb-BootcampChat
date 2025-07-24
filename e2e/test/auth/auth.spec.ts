import { test, expect } from '@playwright/test';
import { TestHelpers } from '../helpers/test-helpers';

test.describe('인증 테스트', () => {
  const helpers = new TestHelpers();

  test('회원가입 및 로그인 흐름', async ({ page }) => {
    const credentials = helpers.generateUserCredentials(1);
    
    // 1. 회원가입
    await helpers.registerUser(page, credentials);
    
    // 채팅방 목록 페이지 확인
    await expect(page).toHaveURL('/chat-rooms');
    
    // 채팅방 목록 페이지의 필수 요소들이 로드되었는지 확인
    await expect(page.locator('.chat-rooms-card')).toBeVisible({ timeout: 30000 });

    // 채팅방 목록 헤더 텍스트 확인 (Card.Title 사용)
    await expect(page.getByRole('button', { name: '채팅방 목록' })).toBeVisible();
    
    // 연결 상태 확인
    // await expect(page.locator('.text-success')).toBeVisible();
    // await expect(page.locator('.text-success')).toHaveText('연결됨');
    await expect(page.getByText('연결됨')).toBeVisible();
  });

//   test('로그인 실패 케이스', async ({ page }) => {
//     const invalidCredentials = {
//       email: 'invalid@example.com',
//       password: 'wrongpassword'
//     };

//     await page.goto('/');
//     await page.waitForLoadState('networkidle');

//     // 입력 필드가 로드될 때까지 대기
//     await page.waitForSelector('input[name="email"]');
//     await page.waitForSelector('input[name="password"]');

//     await page.fill('input[name="email"]', invalidCredentials.email);
//     await page.fill('input[name="password"]', invalidCredentials.password);

//     // 폼 제출
//     await Promise.all([
//       page.waitForResponse(response => 
//         response.url().includes('/api/auth/login') && 
//         response.status() === 401
//       ),
//       page.click('button[type="submit"]')
//     ]);

//     // 에러 메시지 확인
//     await expect(page.locator('.alert.alert-danger')).toBeVisible({
//       timeout: 30000
//     });
//   });

//   test('회원가입 유효성 검사', async ({ page }) => {
//     await page.goto('/register');
//     await page.waitForLoadState('networkidle');

//     // 빈 폼 제출 시도
//     await Promise.all([
//       page.waitForResponse(response => 
//         response.url().includes('/api/auth/register') && 
//         response.status() === 400
//       ),
//       page.click('button[type="submit"]')
//     ]);

//     // 에러 메시지 확인
//     await expect(page.locator('.alert.alert-danger')).toBeVisible({
//       timeout: 30000
//     });

//     // 잘못된 이메일 형식
//     const invalidData = {
//       name: 'Test User',
//       email: 'invalid-email',
//       password: 'password123',
//       confirmPassword: 'password123'
//     };

//     await page.fill('input[name="name"]', invalidData.name);
//     await page.fill('input[name="email"]', invalidData.email);
//     await page.fill('input[name="password"]', invalidData.password);
//     await page.fill('input[name="confirmPassword"]', invalidData.confirmPassword);

//     await Promise.all([
//       page.waitForResponse(response => 
//         response.url().includes('/api/auth/register') && 
//         response.status() === 400
//       ),
//       page.click('button[type="submit"]')
//     ]);

//     await expect(page.locator('.alert.alert-danger')).toBeVisible({
//       timeout: 30000
//     });
//   });
});