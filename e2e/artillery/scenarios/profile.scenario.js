const {
    goToProfileAction,
} = require('../../actions/profile.actions');
const { expect } = require('@playwright/test');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const PROFILE_IMAGE_PATH = path.resolve(__dirname, '../../fixtures/images/profile.jpg');

// Action 간 timeout 설정 (환경변수로 조절 가능)
const ACTION_TIMEOUT = parseInt(process.env.ACTION_TIMEOUT || '1000', 10);
const ACTION_TIMEOUT_SHORT = parseInt(process.env.ACTION_TIMEOUT_SHORT || '500', 10);

/**
 * Artillery 전체 프로필 업데이트 시나리오
 * 이름 변경 + 이미지 업로드
 */
async function fullProfileUpdateScenario(page, vuContext) {
    try {
        // 1. 프로필 페이지 이동
        await goToProfileAction(page);
        await page.waitForTimeout(ACTION_TIMEOUT_SHORT);

        // 2. 이미지 업로드
        await page.getByTestId('profile-image-file-input').setInputFiles(PROFILE_IMAGE_PATH);
        await page.waitForTimeout(ACTION_TIMEOUT);

        // 2-1. 이미지 업로드 검증
        await expect(page.getByTestId('toast-success')).toBeVisible();
        await page.waitForTimeout(ACTION_TIMEOUT_SHORT);

        // 3. 이름 변경
        const newName = `풀업데이트_${Math.random().toString(36).substring(2, 8)}`;
        await page.getByTestId('profile-name-input').fill(newName);
        await page.waitForTimeout(ACTION_TIMEOUT_SHORT);

        // 4. 저장
        await page.getByTestId('profile-save-button').click();
        await page.waitForTimeout(ACTION_TIMEOUT);

        // 5. 성공 확인
        await expect(page.getByTestId('profile-success-message')).toBeVisible();
        await expect(page.getByTestId('profile-name-input')).toHaveValue(newName);
        await expect(page.getByTestId('profile-image-avatar')).toBeVisible();
    } catch (error) {
        console.error('Full profile update scenario failed:', error.message);
        throw error;
    }
}

module.exports = {
    fullProfileUpdateScenario,
};
