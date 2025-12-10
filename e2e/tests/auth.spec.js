const { test, expect } = require('@playwright/test');
const { loginAction, registerAction, logoutAction } = require('../actions/auth.actions');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe.serial('인증 E2E 테스트', () => {
  let testUser;

  test.beforeAll(async ({ browser }) => {
    // 테스트용 계정 생성
    const context = await browser.newContext();
    const page = await context.newPage();
    
    testUser = {
      email: `testuser_${Date.now()}@example.com`,
      password: 'Password123!',
      passwordConfirm: 'Password123!',
      name: 'Test User',
    };
    
    await registerAction(page, testUser);

    await page.waitForTimeout(1000);
    await page.close();
    await context.close();
  });

  test.describe('로그인', () => {
    test('올바른 계정 정보로 로그인 성공', async ({ page }) => {
      // 액션 실행
      await loginAction(page, testUser);

      // 검증
      await expect(page).toHaveURL(`${BASE_URL}/chat`);
    });

    test('잘못된 비밀번호로 로그인 실패', async ({ page }) => {
      // 액션 실행
      await loginAction(page, {
        email: testUser.email,
        password: 'WrongPassword123!',
      });

      // 검증
      await expect(page).toHaveURL(`${BASE_URL}`);
      const errorElement = page.getByTestId('login-error-message');
      await expect(errorElement).toBeVisible();
    });

    test('존재하지 않는 이메일로 로그인 실패', async ({ page }) => {
      // 액션 실행
      await loginAction(page, {
        email: 'nonexistent@example.com',
        password: 'password123',
      });

      // 검증
      await expect(page).toHaveURL(`${BASE_URL}/`);
      const errorElement = page.getByTestId('login-error-message');
      await expect(errorElement).toBeVisible();
    });

    test('빈 필드로 로그인 시도 시 검증 오류', async ({ page }) => {
      // 액션 실행
      await loginAction(page, {
        email: '',
        password: '',
      });

      // 검증
      await expect(page).toHaveURL(`${BASE_URL}/`);
    });
  });

  test.describe('회원가입', () => {
    test('새로운 계정으로 회원가입 성공', async ({ page }) => {
      const newUser = {
        email: `newuser_${Date.now()}@example.com`,
        password: 'Password123!',
        passwordConfirm: 'Password123!',
        name: 'New User',
      };

      // 액션 실행
      await registerAction(page, newUser);
      await loginAction(page, newUser);

      // 검증
      await expect(page).toHaveURL(`${BASE_URL}/chat`);
    });

    test('중복된 이메일로 회원가입 실패', async ({ page }) => {
      // 중복 이메일로 회원가입 시도
      await registerAction(page, testUser);

      // 검증
      await expect(page).toHaveURL(`${BASE_URL}/register`);
      const errorElement = page.getByTestId('register-error-message');
      await expect(errorElement).toBeVisible();
    });
  });

  test.describe('로그아웃', () => {
    test.beforeEach(async ({ page }) => {
      // 로그인 상태로 시작
      await loginAction(page, testUser);
      await expect(page).toHaveURL(`${BASE_URL}/chat`);
    });

    test('로그아웃 성공', async ({ page }) => {
      // 액션 실행
      await logoutAction(page);

      // 검증
      await expect(page).toHaveURL(new RegExp(`^${BASE_URL}/`));
      await expect(page.getByTestId('login-email-input')).toBeVisible();
    });
  });

  test.describe('인증 필요한 페이지 접근', () => {
    test('로그인하지 않은 상태에서 채팅 페이지 접근 시 리다이렉트', async ({ page }) => {
      // 액션 실행
      await page.goto(`${BASE_URL}/chat`);

      // 검증
      await expect(page).toHaveURL(new RegExp(`^${BASE_URL}/`));
      await expect(page.getByTestId('login-email-input')).toBeVisible();
    });

    test('로그인하지 않은 상태에서 프로필 페이지 접근 시 리다이렉트', async ({ page }) => {
      // 액션 실행
      await page.goto(`${BASE_URL}/profile`);

      // 검증
      await expect(page).toHaveURL(new RegExp(`^${BASE_URL}/`));
      await expect(page.getByTestId('login-email-input')).toBeVisible();
    });
  });
});
