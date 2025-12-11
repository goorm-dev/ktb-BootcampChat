const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * 로그인 액션
 * @param {import('@playwright/test').Page} page
 * @param {Object} credentials - { email: string, password: string }
 * @param waitForRedirect
 */
async function loginAction(page, credentials, waitForRedirect = true) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByTestId('login-email-input').fill(credentials.email);
  await page.getByTestId('login-password-input').fill(credentials.password);
  await page.getByTestId('login-submit-button').click();
  await page.waitForURL(`${BASE_URL}/chat`);

}

/**
 * 회원가입 액션
 * @param {import('@playwright/test').Page} page
 * @param {Object} userData - { email: string, password: string, passwordConfirm: string, name: string }
 */
async function registerAction(page, userData) {
  await page.goto(`${BASE_URL}/register`);
  await page.getByTestId('register-email-input').fill(userData.email);
  await page.getByTestId('register-password-input').fill(userData.password);
  await page.getByTestId('register-password-confirm-input').fill(userData.passwordConfirm);
  await page.getByTestId('register-name-input').fill(userData.name);
  await page.getByTestId('register-submit-button').click();
}

/**
 * 로그아웃 액션
 * @param {import('@playwright/test').Page} page
 */
async function logoutAction(page) {
  await page.getByTestId('logout-link').click();
}

module.exports = {
  loginAction,
  registerAction,
  logoutAction,
};
