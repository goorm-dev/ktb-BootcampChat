const path = require('path');
const { test, expect } = require('@playwright/test');
const { loginAction, registerAction } = require('../actions/auth.actions');
const {
  goToProfileAction,
  changeProfileImageAction,
  deleteProfileImageAction,
  updateProfileAction,
} = require('../actions/profile.actions');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const PROFILE_IMAGE_PATH = path.resolve(__dirname, '../fixtures/images/profile.jpg');

test.describe.serial('프로필 E2E 테스트', () => {
  let testUser;

  test.beforeAll(async ({ browser }) => {
    // 테스트용 계정 생성
    const context = await browser.newContext();
    const page = await context.newPage();

    testUser = {
      email: `profiletest_${Date.now()}@example.com`,
      password: 'Password123!',
      passwordConfirm: 'Password123!',
      name: 'Profile Test User',
    };

    await registerAction(page, testUser);

    await page.waitForTimeout(1000);
    await page.close();
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    // 로그인 상태로 시작
    await loginAction(page, testUser);
    await expect(page).toHaveURL(`${BASE_URL}/chat`);
  });

  test.describe('프로필 페이지 접근', () => {
    test('프로필 페이지 로드', async ({ page }) => {
      // 액션 실행
      await goToProfileAction(page);

      // 검증
      await expect(page).toHaveURL(`${BASE_URL}/profile`);
      await expect(page.getByTestId('profile-name-input')).toBeVisible();
      await expect(page.getByTestId('profile-save-button')).toBeVisible();
    });
  });

  test.describe('프로필 정보 수정', () => {
    test('이름 변경', async ({ page }) => {
      const newName = `테스트_${Math.random().toString(36).substring(2, 8)}`;

      // 액션 실행
      await updateProfileAction(page, { name: newName });

      // 검증
      await expect(page.getByTestId('profile-success-message')).toBeVisible();
      await expect(page.getByTestId('profile-name-input')).toHaveValue(newName);
    });
  });

  test.describe('프로필 이미지 관리', () => {
    test('프로필 이미지 변경', async ({ page }) => {
      // 액션 실행
      await changeProfileImageAction(page, PROFILE_IMAGE_PATH);

      // 검증 - Toast 성공 메시지 표시
      await expect(page.getByTestId('toast-success')).toBeVisible();

      // 검증 - 아바타가 보이고, 업로드 및 삭제 버튼이 보여야 함
      await expect(page.getByTestId('profile-image-avatar')).toBeVisible();
      await expect(page.getByTestId('profile-image-upload-button')).toBeVisible();
      await expect(page.getByTestId('profile-image-delete-button')).toBeVisible();
    });

    test('프로필 이미지 삭제', async ({ page }) => {
      // 액션 실행
      await deleteProfileImageAction(page);

      // 검증 - 삭제 버튼이 사라져야 함
      await expect(page.getByTestId('profile-image-delete-button')).not.toBeVisible();
    });
  });
});
