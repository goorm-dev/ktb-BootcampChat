import * as dotenv from 'dotenv';
dotenv.config();

const { Page } = require('@playwright/test');
const { AIService } = require('../services/ai-service');
const { MessageService } = require('../services/message-service');
const { TEST_PROMPTS } = require('../data/ai-prompts');
const { MESSAGE_PROMPTS } = require('../data/message-prompts');
const { TEST_USERS, AI_TEST_USERS } = require('../data/credentials');


class TestHelpers {
  constructor() {
    const apiKey = process.env.OPENAI_API_KEY || '';
    this.aiService = new AIService({
      apiKey,
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    });
    this.messageService = new MessageService(apiKey);
    this.existingRooms = new Set();
  }

  generateRoomName(prefix = 'Test') {
    const randomId = Math.random().toString(36).substring(2, 6);
    return `${prefix}-${randomId}`;
  }

  getTestUser(index) {
    return TEST_USERS[index % TEST_USERS.length];
  }

  getAITestUser(type) {
    return type === 'gpt' ? AI_TEST_USERS[0] : AI_TEST_USERS[1];
  }

  generateUserCredentials(index) {
    const timestamp = Date.now();
    return {
      name: `Test User ${index}`,
      email: `testuser${index}_${timestamp}@example.com`,
      password: 'testPassword123!'
    };
  }

  async loginAndEnterRoom(page) {
    const credentials = this.generateUserCredentials(1);
    await this.registerUser(page, credentials);
    const roomName = this.generateRoomName();
    await this.joinOrCreateRoom(page, roomName);
    return { credentials, roomName };
  }

  async registerUser(page, credentials) {
    try {
      await page.goto('/register');
      await page.waitForLoadState('networkidle');

      await Promise.all([
        page.waitForSelector('input[name="name"]'),
        page.waitForSelector('input[name="email"]'),
        page.waitForSelector('input[name="password"]'),
        page.waitForSelector('input[name="confirmPassword"]')
      ]);

      await page.fill('input[name="name"]', credentials.name);
      await page.fill('input[name="email"]', credentials.email);
      await page.fill('input[name="password"]', credentials.password);
      await page.fill('input[name="confirmPassword"]', credentials.password);

      await Promise.all([
        page.click('button[type="submit"]'),
        Promise.race([
          page.waitForURL('/chat-rooms', { timeout: 20000 }).catch(() => null),
          page.waitForSelector('.alert-danger', { timeout: 20000 }).catch(() => null)
        ])
      ]);

      const errorMessage = await page.locator('.alert-danger').isVisible();
      if (errorMessage) {
        console.log('회원가입 실패, 로그인 시도 중...');
        await this.login(page, {
          email: credentials.email,
          password: credentials.password
        });
      }

      await page.waitForURL('/chat-rooms', { timeout: 20000 });

    } catch (error) {
      console.error('Registration/Login process failed:', error);
      throw new Error(`회원가입/로그인 실패: ${error.message}`);
    }
  }

  async login(page, credentials) {
    try {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await Promise.all([
        page.waitForSelector('input[name="email"]'),
        page.waitForSelector('input[name="password"]')
      ]);

      await page.fill('input[name="email"]', credentials.email);
      await page.fill('input[name="password"]', credentials.password);

      await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForURL('/chat-rooms', { timeout: 10000 })
      ]);

    } catch (error) {
      console.error('Login failed:', error);
      throw new Error(`로그인 실패: ${error.message}`);
    }
  }

  async logout(page) {
    try {
      await page.waitForSelector('[data-toggle="dropdown"]', { 
        state: 'visible',
        timeout: 10000 
      });

      await page.click('[data-toggle="dropdown"]');

      await page.waitForSelector('.dropdown-menu', { 
        state: 'visible',
        timeout: 10000 
      });

      await page.waitForTimeout(1000);

      await page.click('text=로그아웃');

      await page.waitForURL('/', { waitUntil: 'networkidle' });

    } catch (error) {
      console.error('Logout failed:', error);
      await page.screenshot({ 
        path: `test-results/logout-error-${Date.now()}.png` 
      });
      throw error;
    }
  }

  async findSimilarRoom(page, prefix) {
    try {
      await page.goto('/chat-rooms');
      await page.waitForLoadState('networkidle');

      let previousHeight = 0;
      let maxScrollAttempts = 3;
      let scrollAttempts = 0;
      let allFoundRooms: string[] = [];

      console.log("Finding rooms with prefix:", prefix);

      // 채팅방 테이블이 로드될 때까지 대기
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('table tbody tr', {
        state: 'visible',
        timeout: 30000
      });

      while (scrollAttempts < maxScrollAttempts) {
        // 현재 화면에서 보이는 모든 채팅방 이름 가져오기
        const currentRooms = await page.$$eval(
          'span._3U8yo._32yag.font-medium', 
          (elements, searchPrefix) => {
            return elements
              .map(el => el.textContent || '')
              .filter(name => name.startsWith(searchPrefix));
          }, 
          prefix
        );

        // 새로 발견된 방들을 중복 제거하여 추가
        for (const roomName of currentRooms) {
          if (!allFoundRooms.includes(roomName)) {
            console.log(`Found room: ${roomName}`);
            allFoundRooms.push(roomName);
          }
        }

        // 현재 스크롤 높이 확인
        const currentHeight = await page.evaluate(() => {
          const container = document.querySelector('.chat-rooms-table');
          return container?.scrollHeight || 0;
        });

        // 더 이상 스크롤이 되지 않으면 종료
        if (currentHeight === previousHeight) {
          break;
        }

        // 스크롤 다운
        await page.evaluate(() => {
          const container = document.querySelector('.chat-rooms-table');
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        });

        // 새로운 컨텐츠 로딩 대기
        await page.waitForTimeout(1000);

        previousHeight = currentHeight;
        scrollAttempts++;

        console.log(`Scroll attempt ${scrollAttempts}/${maxScrollAttempts}: Found ${allFoundRooms.length} rooms`);
      }

      // 발견된 방들 중에서 랜덤하게 하나 선택
      if (allFoundRooms.length > 0) {
        const selectedRoom = allFoundRooms[Math.floor(Math.random() * allFoundRooms.length)];
        console.log(`Selected room: ${selectedRoom}`);
        return selectedRoom;
      }

      console.log("No rooms found with prefix:", prefix);
      return null;

    } catch (error) {
      console.error('Finding similar room failed:', error);
      await page.screenshot({ 
        path: `test-results/find-room-error-${Date.now()}.png`,
        fullPage: true 
      });
      return null;
    }
  }

  async joinOrCreateRoom(page, prefix) {
    try {
      // 90% vs 10% 확률 결정
      const shouldJoinExisting = Math.random() < 0.9;

      // 기존 채팅방 찾기 시도
      const existingRoom = await this.findSimilarRoom(page, prefix);

      console.log('Found existing room:', existingRoom);
      console.log('Should join existing:', shouldJoinExisting);

      // 기존 채팅방이 있고 90% 확률에 해당하는 경우 기존 방 입장
      if (existingRoom && shouldJoinExisting) {
        const currentUrl = page.url();
        const urlRoomParam = new URLSearchParams(new URL(currentUrl).search).get('room');

        if (urlRoomParam === existingRoom) {
          console.log('Already in the selected room');
          return existingRoom;
        }

        // 채팅방 테이블이 로드될 때까지 대기
        await page.waitForSelector('table tbody tr', {
          state: 'visible',
          timeout: 30000
        });

        // tr 요소들을 순회하면서 해당 방 찾기
        const rows = await page.$$('tbody tr');

        for (const row of rows) {
          const roomNameElement = await row.$('span._3U8yo._32yag.font-medium');
          const roomName = await roomNameElement?.textContent();

          if (roomName === existingRoom) {
            // 같은 row에서 입장 버튼 찾기
            const enterButton = await row.$('button:has-text("입장")');
            if (enterButton) {
              console.log('Found enter button for room:', existingRoom);

              // 버튼 클릭 및 페이지 이동 대기
              await Promise.all([
                page.waitForURL('**/chat?room=**', { 
                  timeout: 30000,
                  waitUntil: 'networkidle'
                }),
                enterButton.click()
              ]);

              // 채팅방 UI 로드 대기
              await Promise.all([
                page.waitForSelector('.chat-input-textarea', {
                  state: 'visible',
                  timeout: 30000
                }),
                page.waitForSelector('.chat-room-title', {
                  state: 'visible',
                  timeout: 30000
                })
              ]);

              console.log('Successfully joined room:', existingRoom);
              return existingRoom;
            }
          }
        }

        console.log('Could not find enter button, creating new room instead');
      }

      // 새 채팅방 생성 (10% 확률이거나 기존 채팅방이 없는 경우)
      const newRoomName = this.generateRoomName(prefix);
      console.log('Creating new room:', newRoomName);

      await this.createRoom(page, newRoomName);
      this.existingRooms.add(newRoomName);
      return newRoomName;

    } catch (error) {
      console.error('Join or create room failed:', error);
      await this.takeErrorScreenshot(page, 'join-or-create-room');
      throw new Error(`채팅방 참여/생성 실패: ${error.message}`);
    }
  }

  async createRoom(page, roomName, password) {
    try {
      console.log('Creating new room:', roomName);

      // 새 채팅방 페이지로 이동
      await page.goto('/chat-rooms/new');
      await page.waitForLoadState('networkidle');

      // 폼이 완전히 로드될 때까지 대기
      const nameInput = await page.waitForSelector('input[name="name"]', {
        state: 'visible',
        timeout: 30000
      });

      // 이름 검증
      if (!roomName?.trim()) {
        throw new Error('방 이름이 비어있습니다.');
      }

      // 기본 정보 입력
      await nameInput.fill(roomName);
      console.log('Room name filled:', roomName);

      // 비밀번호 설정
      if (password) {
        const passwordSwitch = await page.waitForSelector('#hasPassword', { 
          state: 'visible',
          timeout: 5000 
        });
        await passwordSwitch.click();

        const passwordInput = await page.waitForSelector('input[name="password"]', { 
          state: 'visible',
          timeout: 5000 
        });
        await passwordInput.fill(password);
      }

      // 생성 버튼 찾기
      const createButton = await page.waitForSelector('button:has-text("채팅방 만들기")', {
        state: 'visible',
        timeout: 5000
      });

      // 버튼 활성화 대기
      await createButton.waitForElementState('enabled', { timeout: 5000 });

      // 방 생성 시도
      await Promise.all([
        // 네트워크 idle 상태 대기
        page.waitForLoadState('networkidle', { timeout: 30000 }),

        // URL 변경 대기 (여러 방식으로 시도)
        Promise.race([
          page.waitForURL('**/chat?room=*', { timeout: 30000 }),
          page.waitForURL(url => url.pathname === '/chat' && url.searchParams.has('room'), { timeout: 30000 })
        ]),

        // 버튼 클릭
        createButton.click()
      ]);

      // 채팅방 UI 로드 대기 (여러 요소 동시 대기)
      await Promise.all([
        page.waitForSelector('.chat-input-textarea', {
          state: 'visible',
          timeout: 30000
        }),
        page.waitForSelector('.chat-room-title', {
          state: 'visible',
          timeout: 30000
        }),
        page.waitForSelector('.message-list', {
          state: 'visible',
          timeout: 30000
        })
      ]).catch(async (error) => {
        console.error('UI elements load error:', error);

        // 현재 URL과 페이지 상태 확인
        const currentUrl = page.url();
        const elements = {
          input: await page.$('.chat-input-textarea').catch(() => null),
          title: await page.$('.chat-room-title').catch(() => null),
          messageList: await page.$('.message-list').catch(() => null)
        };

        console.log('Current page state:', {
          url: currentUrl,
          elements: Object.entries(elements).reduce((acc, [key, value]) => {
            acc[key] = !!value;
            return acc;
          }, {})
        });

        // URL이 올바르지만 UI 요소가 없는 경우 리로드 시도
        if (currentUrl.includes('/chat') && currentUrl.includes('room=')) {
          console.log('Attempting page reload...');
          await page.reload({ waitUntil: 'networkidle' });

          // 리로드 후 다시 UI 요소 대기
          await Promise.all([
            page.waitForSelector('.chat-input-textarea', { timeout: 30000 }),
            page.waitForSelector('.chat-room-title', { timeout: 30000 }),
            page.waitForSelector('.message-list', { timeout: 30000 })
          ]);
        } else {
          throw new Error('채팅방 UI 로드 실패');
        }
      });

      // // Socket.IO 연결 상태 확인
      // await page.waitForFunction(
      //   () => {
      //     const socket = (window as any).io;
      //     return socket && socket.connected;
      //   },
      //   { timeout: 30000 }
      // ).catch((error) => {
      //   console.warn('Socket connection check warning:', error);
      // });

      // 최종 URL 및 채팅방 상태 검증
      const finalUrl = page.url();
      if (!finalUrl.includes('/chat') || !finalUrl.includes('room=')) {
        throw new Error('최종 URL 검증 실패');
      }

      console.log('Room created and loaded successfully:', {
        roomName,
        url: finalUrl
      });

    } catch (error) {
      console.error('Room creation error:', error);

      // 스크린샷 촬영
      if (!page.isClosed()) {
        const timestamp = Date.now();
        await page.screenshot({
          path: `test-results/create-room-error-${timestamp}.png`,
          fullPage: true
        });

        // 페이지 상태 저장
        const pageState = {
          url: page.url(),
          content: await page.content().catch(() => null),
          console: await page.evaluate(() => {
            return (window as any).consoleLog || [];
          }).catch(() => [])
        };

        console.error('Failed page state:', pageState);
      }

      throw new Error(`채팅방 생성 실패: ${error.message}`);
    }
  }

  // 비밀번호 처리 개선
  async _handleRoomPasswordWithTimeout(page, password, timeout) {
    await page.waitForSelector('input[name="password"]', {
      state: 'visible',
      timeout
    });

    await Promise.all([
      page.waitForNavigation({
        timeout,
        waitUntil: ['load', 'domcontentloaded', 'networkidle']
      }),
      page.fill('input[name="password"]', password),
      page.click('button:has-text("입장")')
    ]);
  }

  // 연결 상태 확인 메서드
  async _waitForConnection(page, timeout) {
    try {
      await page.waitForFunction(
        () => {
          const socket = (window).io;
          return socket && socket.connected;
        },
        { timeout }
      );
      return true;
    } catch {
      return false;
    }
  }

  // 채팅방 UI 검증
  async _verifyRoomLoaded(page, timeout) {
    const elements = [
      '.chat-room-title',
      '.chat-messages',
      '.chat-input-textarea:not([disabled])'
    ];

    await Promise.all(
      elements.map(selector =>
        page.waitForSelector(selector, {
          state: 'visible',
          timeout
        })
      )
    );
  }
  
  async joinRoomByURLParam(page, roomId, password) {
    try {
      const currentUrl = page.url();
      const currentRoomId = new URLSearchParams(new URL(currentUrl).search).get('room');

      // 이미 같은 방에 있으면 스킵
      if (currentRoomId === roomId) {
        return;
      }

      // 로드 타임아웃 설정
      const LOAD_TIMEOUT = 60000;

      // 1. 페이지 로드
      await page.goto(`/chat?room=${encodeURIComponent(roomId)}`, {
        waitUntil: 'networkidle',
        timeout: LOAD_TIMEOUT
      });

      // 2. Socket 연결 대기
      await page.waitForFunction(
        () => {
          const socket = (window as any).io;
          return socket && socket.connected;
        },
        { timeout: LOAD_TIMEOUT }
      ).catch(() => {
        console.warn('Socket connection check timed out');
      });

      // 3. 비밀번호 처리
      const passwordInput = await page.locator('input[name="password"]');
      const needsPassword = await passwordInput.isVisible().catch(() => false);

      if (needsPassword) {
        if (!password) {
          throw new Error('비밀번호가 필요한 채팅방입니다.');
        }

        await passwordInput.fill(password);
        await page.click('button:has-text("입장")');

        // 비밀번호 입력 후 페이지 로드 대기
        await page.waitForLoadState('networkidle', { timeout: LOAD_TIMEOUT });
      }

      // 4. UI 로드 대기
      const requiredElements = [
        {
          selector: '.chat-room-title',
          description: '채팅방 제목'
        },
        {
          selector: '.chat-messages',
          description: '메시지 영역'
        },
        {
          selector: '.chat-input-textarea:not([disabled])',
          description: '채팅 입력창'
        }
      ];

      // 모든 필수 요소가 로드될 때까지 대기
      await Promise.all(
        requiredElements.map(async ({ selector, description }) => {
          try {
            await page.waitForSelector(selector, {
              state: 'visible',
              timeout: LOAD_TIMEOUT
            });
            console.log(`${description} 로드됨`);
          } catch (error) {
            throw new Error(`${description} 로드 실패: ${error.message}`);
          }
        })
      );

      // 5. 연결 상태 최종 확인
      // const isConnected = await page
      //   .waitForSelector('.status-indicator.connected', {
      //     state: 'visible',
      //     timeout: LOAD_TIMEOUT
      //   })
      //   .then(() => true)
      //   .catch(() => false);

      // if (!isConnected) {
      //   throw new Error('채팅 서버 연결 실패');
      // }

      // 6. 최종 URL 검증
      const finalUrl = page.url();
      const finalRoomId = new URLSearchParams(new URL(finalUrl).search).get('room');

      if (finalRoomId !== roomId) {
        throw new Error(`채팅방 입장 실패: 예상된 방 ID ${roomId}, 실제 방 ID ${finalRoomId}`);
      }

    } catch (error) {
      console.error('URL 파라미터로 채팅방 입장 실패:', {
        error,
        roomId,
        currentUrl: page.url(),
        pageState: await this.getPageState(page)
      });

      // 스크린샷 촬영 시도
      try {
        if (!page.isClosed()) {
          const timestamp = Date.now();
          await page.screenshot({
            path: `test-results/room-join-url-error-${timestamp}.png`,
            fullPage: true
          });
        }
      } catch (screenshotError) {
        console.error('스크린샷 촬영 실패:', screenshotError);
      }

      throw new Error(`채팅방 입장 실패 (URL 파라미터로 접근): ${error.message}`);
    }
  }

  // 페이지 상태 정보 수집을 위한 헬퍼 메서드
  async getPageState(page) {
    try {
      return await page.evaluate(() => ({
        url: window.location.href,
        readyState: document.readyState,
        socketConnected: !!(window).io?.connected,
        elements: {
          title: !!document.querySelector('.chat-room-title'),
          messages: !!document.querySelector('.chat-messages'),
          input: !!document.querySelector('.chat-input-textarea')
        }
      }));
    } catch (error) {
      return {
        error: 'Failed to get page state',
        message: error.message
      };
    }
  }
  
  async sendMessage(page, message, parameters) {
    try {
      const finalMessage = await this.messageService.generateMessage(message, parameters);
      const inputSelector = '.chat-input-textarea';
      
      // 입력 필드가 나타날 때까지 대기
      await page.waitForSelector(inputSelector, {
        state: 'visible',
        timeout: 30000
      });

      // 네트워크 요청이 완료될 때까지 대기
      await page.waitForLoadState('networkidle');

      // 입력 필드가 활성화될 때까지 대기
      await page.waitForSelector(`${inputSelector}:not([disabled])`, {
        timeout: 30000
      });

      // 메시지 입력
      await page.fill(inputSelector, finalMessage);
      
      // Enter 키 입력 전 잠시 대기
      await page.waitForTimeout(500);
      
      // 메시지 전송
      await page.keyboard.press('Enter');

      // 메시지 전송 확인
      // try {
      //   await page.waitForLoadState('networkidle');
      //   await page.waitForSelector('.message-content');

      //   const messages = await page.locator('.message-content').all();
      //   const lastMessage = messages[messages.length - 1];
        
      //   if (lastMessage) {
      //     const messageText = await lastMessage.textContent();
      //     if (!messageText?.includes(finalMessage.substring(0, 20))) {
      //       throw new Error('Message content verification failed');
      //     }
      //   } else {
      //     throw new Error('No messages found after sending');
      //   }
      // } catch (error) {
      //   console.error('Message verification failed:', error);
      //   throw new Error(`Message sending verification failed: ${error.message}`);
      // }

      return finalMessage;

    } catch (error) {
      console.error('Message send error:', error);
      await this.takeErrorScreenshot(page, 'message-send');
      throw error;
    }
  }

  async sendAIMessage(page, message, aiType = 'wayneAI') {
    try {
      await page.waitForSelector('.chat-input-textarea', {
        state: 'visible',
        timeout: 20000
      });
      
      const mentionMessage = `@${aiType} ${message}`;
      await page.fill('.chat-input-textarea', mentionMessage);
      await page.keyboard.press('Enter');

      await page.waitForSelector('.message-ai', {
        timeout: 30000,
        state: 'visible'
      });

    } catch (error) {
      console.error('AI message interaction failed:', error);
      await this.takeErrorScreenshot(page, 'ai-message');
      throw new Error(`AI 메시지 전송 실패: ${error.message}`);
    }
  }

  async addReaction(page, messageSelector, emojiIndex = 0) {
    try {
      await page.hover(messageSelector);
      await page.click('.action-button');
      await page.waitForSelector('.emoji-picker-container');
      await page.click(`.emoji-picker-container button >> nth=${emojiIndex}`);
      await page.waitForSelector('.reaction-badge');
    } catch (error) {
      console.error('Add reaction failed:', error);
      await this.takeErrorScreenshot(page, 'reaction');
      throw new Error(`리액션 추가 실패: ${error.message}`);
    }
  }

  async uploadFile(page, filePath, fileType) {
    try {
      const fileInput = await page.waitForSelector('input[type="file"]', {
        timeout: 30000,
        state: 'visible'
      });
      
      await fileInput.setInputFiles(filePath);
      
      if (fileType === 'image') {
        await page.waitForSelector('.file-preview-item img', {
          timeout: 30000,
          state: 'visible'
        });
      } else if (fileType === 'pdf') {
        await page.waitForSelector('.file-preview-item .file-icon', {
          timeout: 30000,
          state: 'visible'
        });
      }

      const submitButton = await page.waitForSelector('.chat-input-actions button[type="submit"]', {
        timeout: 30000,
        state: 'visible'
      });
      await submitButton.click();
      
      await page.waitForSelector('.message-content .file-message', {
        timeout: 30000,
        state: 'visible'
      });

    } catch (error) {
      console.error('File upload failed:', error);
      await this.takeErrorScreenshot(page, 'file-upload');
      throw new Error(`파일 업로드 실패: ${error.message}`);
    }
  }

  async simulateConversation(pages, messages, delayMin = 1000, delayMax = 3000) {
    for (const message of messages) {
      try {
        const randomPage = pages[Math.floor(Math.random() * pages.length)];
        await this.sendMessage(randomPage, message);
        
        const delay = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
        await randomPage.waitForTimeout(delay);
      } catch (error) {
        console.error('Conversation simulation failed:', error);
        throw new Error(`대화 시뮬레이션 실패: ${error.message}`);
      }
    }
  }

  async getConversationHistory(page) {
    try {
      await page.waitForSelector('.message-content', {
        timeout: 30000,
        state: 'visible'
      });
      
      return await page.$$eval('.message-content', elements => 
        elements.map(el => ({
          text: el.textContent?.trim() || '',
          timestamp: el.closest('.message-group')?.querySelector('.message-time')?.textContent?.trim(),
          sender: el.closest('.message-group')?.querySelector('.message-sender')?.textContent?.trim() || 'Unknown'
        }))
      );
    } catch (error) {
      console.error('Getting conversation history failed:', error);
      await this.takeErrorScreenshot(page, 'conversation-history');
      throw new Error(`대화 내역 조회 실패: ${error.message}`);
    }
  }

  async waitForMessageDelivery(page, messageContent, timeout = 30000) {
    try {
      await page.waitForFunction(
        (text) => {
          const messages = document.querySelectorAll('.message-content');
          return Array.from(messages).some(msg => msg.textContent?.includes(text));
        },
        messageContent,
        { timeout }
      );
    } catch (error) {
      console.error('Message delivery verification failed:', error);
      await this.takeErrorScreenshot(page, 'message-delivery');
      throw new Error(`메시지 전송 확인 실패: ${error.message}`);
    }
  }

  async verifyRoomState(page) {
    try {
      const state = {
        title: await page.locator('.chat-room-title').textContent(),
        participantCount: await page.locator('.participants-count').textContent(),
        // isConnected: await page.locator('.connection-status .text-success').isVisible(),
        hasMessages: await page.locator('.message-content').count() > 0,
        inputEnabled: await page.locator('.chat-input-textarea').isEnabled()
      };

      return state;
    } catch (error) {
      console.error('Room state verification failed:', error);
      await this.takeErrorScreenshot(page, 'room-state');
      throw new Error(`채팅방 상태 확인 실패: ${error.message}`);
    }
  }

  // 비밀번호 처리를 위한 헬퍼 메서드
  async handleRoomPassword(page, password) {
    if (password) {
      await page.waitForSelector('input[name="password"]', {
        state: 'visible',
        timeout: 30000
      });
      await page.fill('input[name="password"]', password);
      await page.click('button:has-text("입장")');
    }
  }

  // 채팅방 로드 대기를 위한 헬퍼 메서드
  async waitForRoomLoad(page) {
    // 채팅방 UI 로드 확인
    await page.waitForSelector('.chat-container', {
      state: 'visible',
      timeout: 30000
    });

    // 채팅 입력창 활성화 확인
    await page.waitForSelector('.chat-input-textarea:not([disabled])', {
      state: 'visible',
      timeout: 30000
    });
  }

  // 에러 스크린샷을 위한 헬퍼 메서드
  async takeErrorScreenshot(page, prefix) {
    try {
      await page.screenshot({
        path: `test-results/${prefix}-error-${Date.now()}.png`,
        fullPage: true
      });
    } catch (screenshotError) {
      console.error('Screenshot failed:', screenshotError);
    }
  }
}

module.exports = {
  TestHelpers
};