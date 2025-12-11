const {
    createChatRoomAction,
    joinRandomChatRoomAction,
    sendMessageAction,
    sendMultipleMessagesAction,
    uploadFileAction,
} = require('../../actions/chat.actions');
const { expect } = require('@playwright/test');
const path = require('path');
const { randomUUID } = require('crypto');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const MASS_MESSAGE_COUNT = process.env.MASS_MESSAGE_COUNT || 10;

// Action 간 timeout 설정 (환경변수로 조절 가능)
const ACTION_TIMEOUT = parseInt(process.env.ACTION_TIMEOUT || '1000', 10);
const ACTION_TIMEOUT_SHORT = parseInt(process.env.ACTION_TIMEOUT_SHORT || '500', 10);
const ACTION_TIMEOUT_LONG = parseInt(process.env.ACTION_TIMEOUT_LONG || '2000', 10);

async function gotoChatPage(page, vuContext) {
    await page.goto(`${BASE_URL}/chat`);
    await expect(page).toHaveURL(`${BASE_URL}/chat`);
}

/**
 * Artillery 채팅방 생성 및 메시지 전송 시나리오
 */
async function chatRoomCreationScenario(page, vuContext) {
    try {
        // 1. 채팅방 확인
        await expect(page).toHaveURL(`${BASE_URL}/chat`);

        // 2. 채팅방 생성
        const roomName = `부하테스트_${randomUUID()}`;
        await createChatRoomAction(page, roomName);
        await expect(page).toHaveURL(new RegExp(`${BASE_URL}/chat/\\w+`));

        // 3. 메시지 전송
        const message = `테스트 메시지 ${Date.now()}`;
        await sendMessageAction(page, message);
        await page.waitForTimeout(ACTION_TIMEOUT_SHORT);

        const messageElement = page.getByTestId('message-content').filter({ hasText: message });
        await expect(messageElement).toBeVisible();

        vuContext.vars.chatRoomUrl = page.url();
    } catch (error) {
        console.error('Chat room creation scenario failed:', error.message);
        throw error;
    }
}

/**
 * Artillery 메시지 대량 전송 시나리오
 */
async function massMessageScenario(page, vuContext) {
    try {
        // 1. 랜덤 채팅방 입장
        await joinRandomChatRoomAction(page);
        await expect(page).toHaveURL(new RegExp(`${BASE_URL}/chat/\\w+`));

        // 2. 여러 메시지 연속 전송 (10개)
        console.log(`Sending ${MASS_MESSAGE_COUNT} messages...`);
        await sendMultipleMessagesAction(page, MASS_MESSAGE_COUNT);
    } catch (error) {
        console.error('Mass message scenario failed:', error.message);
        throw error;
    }
}

/**
 * Artillery 파일 업로드 시나리오
 */
async function fileUploadScenario(page, vuContext) {
    try {
        // 1. 랜덤 채팅방 입장
        await joinRandomChatRoomAction(page);
        await expect(page).toHaveURL(new RegExp(`${BASE_URL}/chat/\\w+`));

        // 2. 이미지 파일 업로드
        const filePath = path.resolve(__dirname, '../../fixtures/images/profile.jpg');
        const message = `파일 업로드 부하 테스트 ${Date.now()}`;

        const uploadPromise = page.waitForResponse(
            response => response.url().includes('/api/files/upload') && response.status() === 200,
            { timeout: 15000 }
        );

        await uploadFileAction(page, filePath, message);
        await uploadPromise;

        await page.waitForTimeout(ACTION_TIMEOUT);

        const fileMessageContainer = page.getByTestId('file-message-container').filter({ hasText: message });
        await expect(fileMessageContainer).toBeVisible({ timeout: 10000 });
    } catch (error) {
        console.error('File upload scenario failed:', error.message);
        throw error;
    }
}

/**
 * Artillery 금칙어 처리 시나리오
 */
async function forbiddenWordScenario(page, vuContext) {
    const testUser = vuContext.vars.testUser;
    // NOTE: 환경변수에서 금칙어 목록을 가져오거나 기본값 사용
    const FORBIDDEN_WORDS = process.env.FORBIDDEN_WORDS
        ? process.env.FORBIDDEN_WORDS
            .replace(/^"|"$/g, '') // Remove leading/trailing double quotes
            .split(',')
            .map(word => word.trim().replace(/^"|"$/g, '')) // Remove quotes from each word
        : ['b3sig78jv', '9c0hej6x', 'lbl276sz'];

    try {
        // 1. 랜덤 채팅방 입장
        await joinRandomChatRoomAction(page);
        await expect(page).toHaveURL(new RegExp(`${BASE_URL}/chat/\\w+`));

        // 2. 금칙어 메시지 전송 시도
        const forbiddenWord = FORBIDDEN_WORDS[Math.floor(Math.random() * FORBIDDEN_WORDS.length)];
        await sendMessageAction(page, forbiddenWord);

        // 3. 에러 토스트 확인
        const errorToast = page.getByTestId('toast-error');
        await expect(errorToast).toBeVisible({ timeout: 5000 });

        // 4. 메시지가 전송되지 않았는지 확인
        const sentMessage = page.getByTestId('message-content').filter({ hasText: forbiddenWord });
        await expect(sentMessage).not.toBeVisible();

        vuContext.vars.testUser = testUser;
    } catch (error) {
        console.error('Forbidden word scenario failed:', error.message);
        throw error;
    }
}

module.exports = {
    gotoChatPage,
    chatRoomCreationScenario,
    massMessageScenario,
    fileUploadScenario,
    forbiddenWordScenario,
};
