const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * 첫 번째 채팅방 입장 액션
 * @param {import('@playwright/test').Page} page
 */
async function joinFirstChatRoomAction(page) {
  await page.goto(`${BASE_URL}/chat`);
  await page.getByTestId('join-chat-room-button').first().click();
}

/**
 * 랜덤 채팅방 입장 액션
 * @param {import('@playwright/test').Page} page
 */
async function joinRandomChatRoomAction(page) {
  await page.goto(`${BASE_URL}/chat`);

  // 채팅방 버튼이 최소 하나 이상 로드될 때까지 대기
  await page.getByTestId('join-chat-room-button').first().waitFor({ state: 'visible' });

  const chatRoomButtons = page.getByTestId('join-chat-room-button');
  const count = await chatRoomButtons.count();

  const randomIndex = Math.floor(Math.random() * count);
  await chatRoomButtons.nth(randomIndex).click();
}

/**
 * 특정 채팅방 입장 액션
 * @param {import('@playwright/test').Page} page
 * @param {string} roomId - 채팅방 ID
 */
async function joinChatRoomByIdAction(page, roomId) {
  await page.goto(`${BASE_URL}/chat/${roomId}`);
}

/**
 * 채팅방 생성 액션
 * @param {import('@playwright/test').Page} page
 * @param {string} roomName - 생성할 채팅방 이름
 */
async function createChatRoomAction(page, roomName) {
  await page.goto(`${BASE_URL}/chat/new`);
  await page.getByTestId('chat-room-name-input').fill(roomName);
  await page.getByTestId('create-chat-room-button').click();
  await page.waitForURL(new RegExp(`${BASE_URL}/chat/[a-f0-9]{24}`));
}

/**
 * 메시지 전송 액션
 * @param {import('@playwright/test').Page} page
 * @param {string} message - 전송할 메시지 내용
 */
async function sendMessageAction(page, message) {
  await page.getByTestId('chat-message-input').fill(message);
  await page.getByTestId('chat-send-button').click();
}

/**
 * 여러 메시지 전송 액션
 * @param {import('@playwright/test').Page} page
 * @param {number} count - 전송할 메시지 개수
 * @returns {Promise<string[]>} 전송된 메시지 배열
 */
async function sendMultipleMessagesAction(page, count) {
  const messages = [];

  for (let i = 0; i < count; i++) {
    const message = `테스트 메시지 ${i + 1} - ${Math.random().toString(36).substring(7)}`;
    messages.push(message);

    await sendMessageAction(page, message);
    await page.waitForTimeout(100); // 메시지 전송 간 약간의 지연 추가
  }

  return messages;
}

/**
 * 파일 업로드 후 메세지 전송
 * @param {import('@playwright/test').Page} page
 * @param {string} filePath - 업로드할 파일 경로
 */
async function uploadFileAction(page, filePath, message = '') {
  await page.getByTestId('file-upload-input').setInputFiles(filePath);
  await sendMessageAction(page, message);
}

/**
 * 채팅 스크롤 최상단으로 이동 액션
 * @param {import('@playwright/test').Page} page
 */
async function scrollChatToTopAction(page) {
  const container = page.getByTestId('chat-messages-container');
  await container.evaluate((el) => { el.scrollTop = 0; });
  await page.waitForTimeout(1000); // 스크롤 후 잠시 대기
}

/**
 * 이모지 반응 추가 액션
 * @param {import('@playwright/test').Page} page
 * @param {string} emoji - 추가할 이모지 (기본값: '😀')
 */
async function addEmojiReactionAction(page, emoji = '😀') {
  await page.getByTestId('message-reaction-button').last().click();
  await page.locator(`[data-testid="emoji-picker-container"] >>> button[aria-label="${emoji}"]`).click();
}

module.exports = {
  joinFirstChatRoomAction,
  joinRandomChatRoomAction,
  joinChatRoomByIdAction,
  createChatRoomAction,
  sendMessageAction,
  sendMultipleMessagesAction,
  uploadFileAction,
  scrollChatToTopAction,
  addEmojiReactionAction,
};
