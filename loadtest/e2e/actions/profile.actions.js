const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * 프로필 페이지로 이동 액션
 * @param {import('@playwright/test').Page} page
 */
async function goToProfileAction(page) {
  await page.goto(`${BASE_URL}/profile`);
}

/**
 * 프로필 이미지 변경 액션
 * @param {import('@playwright/test').Page} page
 * @param {string} imagePath - 업로드할 이미지 파일 경로
 */
async function changeProfileImageAction(page, imagePath) {
  await goToProfileAction(page);
  await page.getByTestId('profile-image-file-input').setInputFiles(imagePath);
}

/**
 * 프로필 이미지 삭제 액션
 * @param {import('@playwright/test').Page} page
 */
async function deleteProfileImageAction(page) {
  await goToProfileAction(page);
  await page.getByTestId('profile-image-delete-button').click();
}

/**
 * 프로필 정보 수정 액션
 * @param {import('@playwright/test').Page} page
 * @param {Object} profileData - { name?: string }
 */
async function updateProfileAction(page, profileData) {
  await goToProfileAction(page);

  if (profileData.name) {
    await page.getByTestId('profile-name-input').fill(profileData.name);
  }

  await page.getByTestId('profile-save-button').click();
}

module.exports = {
  goToProfileAction,
  changeProfileImageAction,
  deleteProfileImageAction,
  updateProfileAction,
};
