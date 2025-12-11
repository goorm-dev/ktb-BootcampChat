const { loginAction, registerAction, logoutAction } = require('../../actions/auth.actions');
const { expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Action 간 timeout 설정 (환경변수로 조절 가능)
const ACTION_TIMEOUT = parseInt(process.env.ACTION_TIMEOUT || '1000', 10);
const ACTION_TIMEOUT_SHORT = parseInt(process.env.ACTION_TIMEOUT_SHORT || '500', 10);

/**
 * Artillery 로그인 시나리오
 * 랜덤 사용자 로그인 부하 테스트
 */
async function loginScenario(page, vuContext) {
    let testUser = vuContext.vars.testUser;

    try {
        // 1. 회원가입
        await registerAction(page, testUser);
        await page.waitForTimeout(ACTION_TIMEOUT);

        // 2. 로그인
        await loginAction(page, testUser);
        await expect(page).toHaveURL(`${BASE_URL}/chat`);

        // 컨텍스트에 사용자 정보 저장 (다른 시나리오에서 사용 가능)
        vuContext.vars.testUser = testUser;
    } catch (error) {
        console.error('Login scenario failed:', error.message);
        throw error;
    }
}

/**
 * Artillery 인증 실패 시나리오
 * 잘못된 로그인 시도 부하 테스트
 */
async function failedLoginScenario(page, vuContext) {
    try {
        await loginAction(page, {
            email: 'nonexistent@example.com',
            password: 'WrongPassword123!',
        }, false);

        await page.waitForTimeout(500);
        const errorElement = page.getByTestId('login-error-message');
        await expect(errorElement).toBeVisible();
    } catch (error) {
        console.error('Failed login scenario failed:', error.message);
        throw error;
    }
}

module.exports = {
    loginScenario,
    failedLoginScenario,
};
