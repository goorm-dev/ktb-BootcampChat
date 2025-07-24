
// e2e/test/chatrooms/chatrooms.spec.ts
import { test, expect } from '@playwright/test';
import { TestHelpers } from '../helpers/test-helpers';

test.describe('Chat Rooms Page Features', () => {
  const helpers = new TestHelpers();

  test('should display a list of chat rooms and allow creation', async ({ page }) => {
    const credentials = helpers.getTestUser(Math.floor(Math.random() * 1001));
    await helpers.registerUser(page, credentials);

    // 1. Verify the user is on the chat rooms page
    await expect(page).toHaveURL('/chat-rooms', { timeout: 30000 });
    await expect(page.locator('h5')).toContainText('채팅방 목록');

    // 2. Create a new room to ensure the list is not empty
    const roomName = `E2E-List-Test-${new Date().getTime()}`;
    await helpers.createRoom(page, roomName);

    // 3. Go back to the list and verify the created room is present
    await page.goto('/chat-rooms');
    await page.waitForLoadState('networkidle');
    await expect(page.locator(`tr:has-text("${roomName}")`)).toBeVisible({ timeout: 30000 });
  });

  test('should allow a user to navigate to the new chat room page', async ({ page }) => {
    const credentials = helpers.getTestUser(Math.floor(Math.random() * 1001));
    await helpers.registerUser(page, credentials);

    await page.goto('/chat-rooms');
    await page.waitForLoadState('networkidle');

    // Find and click the "Create New Chat Room" button
    await page.locator('a:has-text("새 채팅방 만들기")').click();

    // Verify the URL is for creating a new room
    await expect(page).toHaveURL('/chat-rooms/new', { timeout: 30000 });
    await expect(page.locator('h2')).toContainText('새로운 채팅방 만들기');
  });

  test('should allow a user to join a chat room from the list', async ({ page }) => {
    // User 1 creates a room
    const user1Credentials = helpers.getTestUser(Math.floor(Math.random() * 1001));
    await helpers.registerUser(page, user1Credentials);
    const roomName = `E2E-Join-From-List-${new Date().getTime()}`;
    await helpers.createRoom(page, roomName);
    await helpers.logout(page);

    // User 2 logs in and joins the room
    const user2Credentials = helpers.getTestUser(Math.floor(Math.random() * 1002));
    await helpers.registerUser(page, user2Credentials);
    
    await page.goto('/chat-rooms');
    await page.waitForLoadState('networkidle');

    // Find the room in the list and click the "Enter" button
    await page.locator(`tr:has-text("${roomName}") button:has-text("입장")`).click();

    // Verify the user is in the correct chat room
    await expect(page).toHaveURL(new RegExp(`/chat\?room=.*`), { timeout: 30000 });
    await expect(page.locator('.chat-room-title')).toHaveText(roomName, { timeout: 30000 });
  });
});
