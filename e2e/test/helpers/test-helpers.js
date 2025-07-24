"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var dotenv = require("dotenv");
dotenv.config();
var Page = require('@playwright/test').Page;
var AIService = require('../services/ai-service').AIService;
var MessageService = require('../services/message-service').MessageService;
var TEST_PROMPTS = require('../data/ai-prompts').TEST_PROMPTS;
var MESSAGE_PROMPTS = require('../data/message-prompts').MESSAGE_PROMPTS;
var _a = require('../data/credentials'), TEST_USERS = _a.TEST_USERS, AI_TEST_USERS = _a.AI_TEST_USERS;
var TestHelpers = /** @class */ (function () {
    function TestHelpers() {
        var apiKey = process.env.OPENAI_API_KEY || '';
        this.aiService = new AIService({
            apiKey: apiKey,
            model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        });
        this.messageService = new MessageService(apiKey);
        this.existingRooms = new Set();
    }
    TestHelpers.prototype.generateRoomName = function (prefix) {
        if (prefix === void 0) { prefix = 'Test'; }
        var randomId = Math.random().toString(36).substring(2, 6);
        return "".concat(prefix, "-").concat(randomId);
    };
    TestHelpers.prototype.getTestUser = function (index) {
        return TEST_USERS[index % TEST_USERS.length];
    };
    TestHelpers.prototype.getAITestUser = function (type) {
        return type === 'gpt' ? AI_TEST_USERS[0] : AI_TEST_USERS[1];
    };
    TestHelpers.prototype.generateUserCredentials = function (index) {
        var timestamp = Date.now();
        return {
            name: "Test User ".concat(index),
            email: "testuser".concat(index, "_").concat(timestamp, "@example.com"),
            password: 'testPassword123!'
        };
    };
    TestHelpers.prototype.loginAndEnterRoom = function (page) {
        return __awaiter(this, void 0, void 0, function () {
            var credentials, roomName;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        credentials = this.generateUserCredentials(1);
                        return [4 /*yield*/, this.registerUser(page, credentials)];
                    case 1:
                        _a.sent();
                        roomName = this.generateRoomName();
                        return [4 /*yield*/, this.joinOrCreateRoom(page, roomName)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, { credentials: credentials, roomName: roomName }];
                }
            });
        });
    };
    TestHelpers.prototype.registerUser = function (page, credentials) {
        return __awaiter(this, void 0, void 0, function () {
            var errorMessage, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 13, , 14]);
                        return [4 /*yield*/, page.goto('/register')];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, page.waitForLoadState('networkidle')];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, Promise.all([
                                page.waitForSelector('input[name="name"]'),
                                page.waitForSelector('input[name="email"]'),
                                page.waitForSelector('input[name="password"]'),
                                page.waitForSelector('input[name="confirmPassword"]')
                            ])];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, page.fill('input[name="name"]', credentials.name)];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, page.fill('input[name="email"]', credentials.email)];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, page.fill('input[name="password"]', credentials.password)];
                    case 6:
                        _a.sent();
                        return [4 /*yield*/, page.fill('input[name="confirmPassword"]', credentials.password)];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, Promise.all([
                                page.click('button[type="submit"]'),
                                Promise.race([
                                    page.waitForURL('/chat-rooms', { timeout: 20000 }).catch(function () { return null; }),
                                    page.waitForSelector('.alert-danger', { timeout: 20000 }).catch(function () { return null; })
                                ])
                            ])];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, page.locator('.alert-danger').isVisible()];
                    case 9:
                        errorMessage = _a.sent();
                        if (!errorMessage) return [3 /*break*/, 11];
                        console.log('회원가입 실패, 로그인 시도 중...');
                        return [4 /*yield*/, this.login(page, {
                                email: credentials.email,
                                password: credentials.password
                            })];
                    case 10:
                        _a.sent();
                        _a.label = 11;
                    case 11: return [4 /*yield*/, page.waitForURL('/chat-rooms', { timeout: 20000 })];
                    case 12:
                        _a.sent();
                        return [3 /*break*/, 14];
                    case 13:
                        error_1 = _a.sent();
                        console.error('Registration/Login process failed:', error_1);
                        throw new Error("\uD68C\uC6D0\uAC00\uC785/\uB85C\uADF8\uC778 \uC2E4\uD328: ".concat(error_1.message));
                    case 14: return [2 /*return*/];
                }
            });
        });
    };
    TestHelpers.prototype.login = function (page, credentials) {
        return __awaiter(this, void 0, void 0, function () {
            var error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 7, , 8]);
                        return [4 /*yield*/, page.goto('/')];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, page.waitForLoadState('networkidle')];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, Promise.all([
                                page.waitForSelector('input[name="email"]'),
                                page.waitForSelector('input[name="password"]')
                            ])];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, page.fill('input[name="email"]', credentials.email)];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, page.fill('input[name="password"]', credentials.password)];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, Promise.all([
                                page.click('button[type="submit"]'),
                                page.waitForURL('/chat-rooms', { timeout: 10000 })
                            ])];
                    case 6:
                        _a.sent();
                        return [3 /*break*/, 8];
                    case 7:
                        error_2 = _a.sent();
                        console.error('Login failed:', error_2);
                        throw new Error("\uB85C\uADF8\uC778 \uC2E4\uD328: ".concat(error_2.message));
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    TestHelpers.prototype.logout = function (page) {
        return __awaiter(this, void 0, void 0, function () {
            var error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 7, , 9]);
                        return [4 /*yield*/, page.waitForSelector('[data-toggle="dropdown"]', {
                                state: 'visible',
                                timeout: 10000
                            })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, page.click('[data-toggle="dropdown"]')];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, page.waitForSelector('.dropdown-menu', {
                                state: 'visible',
                                timeout: 10000
                            })];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, page.waitForTimeout(1000)];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, page.click('text=로그아웃')];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, page.waitForURL('/', { waitUntil: 'networkidle' })];
                    case 6:
                        _a.sent();
                        return [3 /*break*/, 9];
                    case 7:
                        error_3 = _a.sent();
                        console.error('Logout failed:', error_3);
                        return [4 /*yield*/, page.screenshot({
                                path: "test-results/logout-error-".concat(Date.now(), ".png")
                            })];
                    case 8:
                        _a.sent();
                        throw error_3;
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    TestHelpers.prototype.findSimilarRoom = function (page, prefix) {
        return __awaiter(this, void 0, void 0, function () {
            var previousHeight, maxScrollAttempts, scrollAttempts, allFoundRooms, currentRooms, _i, currentRooms_1, roomName, currentHeight, selectedRoom, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 11, , 13]);
                        return [4 /*yield*/, page.goto('/chat-rooms')];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, page.waitForLoadState('networkidle')];
                    case 2:
                        _a.sent();
                        previousHeight = 0;
                        maxScrollAttempts = 3;
                        scrollAttempts = 0;
                        allFoundRooms = [];
                        console.log("Finding rooms with prefix:", prefix);
                        // 채팅방 테이블이 로드될 때까지 대기
                        return [4 /*yield*/, page.waitForLoadState('networkidle')];
                    case 3:
                        // 채팅방 테이블이 로드될 때까지 대기
                        _a.sent();
                        return [4 /*yield*/, page.waitForSelector('table tbody tr', {
                                state: 'visible',
                                timeout: 30000
                            })];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5:
                        if (!(scrollAttempts < maxScrollAttempts)) return [3 /*break*/, 10];
                        return [4 /*yield*/, page.$$eval('span._3U8yo._32yag.font-medium', function (elements, searchPrefix) {
                                return elements
                                    .map(function (el) { return el.textContent || ''; })
                                    .filter(function (name) { return name.startsWith(searchPrefix); });
                            }, prefix)];
                    case 6:
                        currentRooms = _a.sent();
                        // 새로 발견된 방들을 중복 제거하여 추가
                        for (_i = 0, currentRooms_1 = currentRooms; _i < currentRooms_1.length; _i++) {
                            roomName = currentRooms_1[_i];
                            if (!allFoundRooms.includes(roomName)) {
                                console.log("Found room: ".concat(roomName));
                                allFoundRooms.push(roomName);
                            }
                        }
                        return [4 /*yield*/, page.evaluate(function () {
                                var container = document.querySelector('.chat-rooms-table');
                                return (container === null || container === void 0 ? void 0 : container.scrollHeight) || 0;
                            })];
                    case 7:
                        currentHeight = _a.sent();
                        // 더 이상 스크롤이 되지 않으면 종료
                        if (currentHeight === previousHeight) {
                            return [3 /*break*/, 10];
                        }
                        // 스크롤 다운
                        return [4 /*yield*/, page.evaluate(function () {
                                var container = document.querySelector('.chat-rooms-table');
                                if (container) {
                                    container.scrollTop = container.scrollHeight;
                                }
                            })];
                    case 8:
                        // 스크롤 다운
                        _a.sent();
                        // 새로운 컨텐츠 로딩 대기
                        return [4 /*yield*/, page.waitForTimeout(1000)];
                    case 9:
                        // 새로운 컨텐츠 로딩 대기
                        _a.sent();
                        previousHeight = currentHeight;
                        scrollAttempts++;
                        console.log("Scroll attempt ".concat(scrollAttempts, "/").concat(maxScrollAttempts, ": Found ").concat(allFoundRooms.length, " rooms"));
                        return [3 /*break*/, 5];
                    case 10:
                        // 발견된 방들 중에서 랜덤하게 하나 선택
                        if (allFoundRooms.length > 0) {
                            selectedRoom = allFoundRooms[Math.floor(Math.random() * allFoundRooms.length)];
                            console.log("Selected room: ".concat(selectedRoom));
                            return [2 /*return*/, selectedRoom];
                        }
                        console.log("No rooms found with prefix:", prefix);
                        return [2 /*return*/, null];
                    case 11:
                        error_4 = _a.sent();
                        console.error('Finding similar room failed:', error_4);
                        return [4 /*yield*/, page.screenshot({
                                path: "test-results/find-room-error-".concat(Date.now(), ".png"),
                                fullPage: true
                            })];
                    case 12:
                        _a.sent();
                        return [2 /*return*/, null];
                    case 13: return [2 /*return*/];
                }
            });
        });
    };
    TestHelpers.prototype.joinOrCreateRoom = function (page, prefix) {
        return __awaiter(this, void 0, void 0, function () {
            var shouldJoinExisting, existingRoom, currentUrl, urlRoomParam, rows, _i, rows_1, row, roomNameElement, roomName, enterButton, newRoomName, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 14, , 16]);
                        shouldJoinExisting = Math.random() < 0.9;
                        return [4 /*yield*/, this.findSimilarRoom(page, prefix)];
                    case 1:
                        existingRoom = _a.sent();
                        console.log('Found existing room:', existingRoom);
                        console.log('Should join existing:', shouldJoinExisting);
                        if (!(existingRoom && shouldJoinExisting)) return [3 /*break*/, 12];
                        currentUrl = page.url();
                        urlRoomParam = new URLSearchParams(new URL(currentUrl).search).get('room');
                        if (urlRoomParam === existingRoom) {
                            console.log('Already in the selected room');
                            return [2 /*return*/, existingRoom];
                        }
                        // 채팅방 테이블이 로드될 때까지 대기
                        return [4 /*yield*/, page.waitForSelector('table tbody tr', {
                                state: 'visible',
                                timeout: 30000
                            })];
                    case 2:
                        // 채팅방 테이블이 로드될 때까지 대기
                        _a.sent();
                        return [4 /*yield*/, page.$$('tbody tr')];
                    case 3:
                        rows = _a.sent();
                        _i = 0, rows_1 = rows;
                        _a.label = 4;
                    case 4:
                        if (!(_i < rows_1.length)) return [3 /*break*/, 11];
                        row = rows_1[_i];
                        return [4 /*yield*/, row.$('span._3U8yo._32yag.font-medium')];
                    case 5:
                        roomNameElement = _a.sent();
                        return [4 /*yield*/, (roomNameElement === null || roomNameElement === void 0 ? void 0 : roomNameElement.textContent())];
                    case 6:
                        roomName = _a.sent();
                        if (!(roomName === existingRoom)) return [3 /*break*/, 10];
                        return [4 /*yield*/, row.$('button:has-text("입장")')];
                    case 7:
                        enterButton = _a.sent();
                        if (!enterButton) return [3 /*break*/, 10];
                        console.log('Found enter button for room:', existingRoom);
                        // 버튼 클릭 및 페이지 이동 대기
                        return [4 /*yield*/, Promise.all([
                                page.waitForURL('**/chat?room=**', {
                                    timeout: 30000,
                                    waitUntil: 'networkidle'
                                }),
                                enterButton.click()
                            ])];
                    case 8:
                        // 버튼 클릭 및 페이지 이동 대기
                        _a.sent();
                        // 채팅방 UI 로드 대기
                        return [4 /*yield*/, Promise.all([
                                page.waitForSelector('.chat-input-textarea', {
                                    state: 'visible',
                                    timeout: 30000
                                }),
                                page.waitForSelector('.chat-room-title', {
                                    state: 'visible',
                                    timeout: 30000
                                })
                            ])];
                    case 9:
                        // 채팅방 UI 로드 대기
                        _a.sent();
                        console.log('Successfully joined room:', existingRoom);
                        return [2 /*return*/, existingRoom];
                    case 10:
                        _i++;
                        return [3 /*break*/, 4];
                    case 11:
                        console.log('Could not find enter button, creating new room instead');
                        _a.label = 12;
                    case 12:
                        newRoomName = this.generateRoomName(prefix);
                        console.log('Creating new room:', newRoomName);
                        return [4 /*yield*/, this.createRoom(page, newRoomName)];
                    case 13:
                        _a.sent();
                        this.existingRooms.add(newRoomName);
                        return [2 /*return*/, newRoomName];
                    case 14:
                        error_5 = _a.sent();
                        console.error('Join or create room failed:', error_5);
                        return [4 /*yield*/, this.takeErrorScreenshot(page, 'join-or-create-room')];
                    case 15:
                        _a.sent();
                        throw new Error("\uCC44\uD305\uBC29 \uCC38\uC5EC/\uC0DD\uC131 \uC2E4\uD328: ".concat(error_5.message));
                    case 16: return [2 /*return*/];
                }
            });
        });
    };
    TestHelpers.prototype.createRoom = function (page, roomName, password) {
        return __awaiter(this, void 0, void 0, function () {
            var nameInput, passwordSwitch, passwordInput, createButton, finalUrl, error_6, timestamp, pageState;
            var _a;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 14, , 19]);
                        console.log('Creating new room:', roomName);
                        // 새 채팅방 페이지로 이동
                        return [4 /*yield*/, page.goto('/chat-rooms/new')];
                    case 1:
                        // 새 채팅방 페이지로 이동
                        _b.sent();
                        return [4 /*yield*/, page.waitForLoadState('networkidle')];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, page.waitForSelector('input[name="name"]', {
                                state: 'visible',
                                timeout: 30000
                            })];
                    case 3:
                        nameInput = _b.sent();
                        // 이름 검증
                        if (!(roomName === null || roomName === void 0 ? void 0 : roomName.trim())) {
                            throw new Error('방 이름이 비어있습니다.');
                        }
                        // 기본 정보 입력
                        return [4 /*yield*/, nameInput.fill(roomName)];
                    case 4:
                        // 기본 정보 입력
                        _b.sent();
                        console.log('Room name filled:', roomName);
                        if (!password) return [3 /*break*/, 9];
                        return [4 /*yield*/, page.waitForSelector('#hasPassword', {
                                state: 'visible',
                                timeout: 5000
                            })];
                    case 5:
                        passwordSwitch = _b.sent();
                        return [4 /*yield*/, passwordSwitch.click()];
                    case 6:
                        _b.sent();
                        return [4 /*yield*/, page.waitForSelector('input[name="password"]', {
                                state: 'visible',
                                timeout: 5000
                            })];
                    case 7:
                        passwordInput = _b.sent();
                        return [4 /*yield*/, passwordInput.fill(password)];
                    case 8:
                        _b.sent();
                        _b.label = 9;
                    case 9: return [4 /*yield*/, page.waitForSelector('button:has-text("채팅방 만들기")', {
                            state: 'visible',
                            timeout: 5000
                        })];
                    case 10:
                        createButton = _b.sent();
                        // 버튼 활성화 대기
                        return [4 /*yield*/, createButton.waitForElementState('enabled', { timeout: 5000 })];
                    case 11:
                        // 버튼 활성화 대기
                        _b.sent();
                        // 방 생성 시도
                        return [4 /*yield*/, Promise.all([
                                // 네트워크 idle 상태 대기
                                page.waitForLoadState('networkidle', { timeout: 30000 }),
                                // URL 변경 대기 (여러 방식으로 시도)
                                Promise.race([
                                    page.waitForURL('**/chat?room=*', { timeout: 30000 }),
                                    page.waitForURL(function (url) { return url.pathname === '/chat' && url.searchParams.has('room'); }, { timeout: 30000 })
                                ]),
                                // 버튼 클릭
                                createButton.click()
                            ])];
                    case 12:
                        // 방 생성 시도
                        _b.sent();
                        // 채팅방 UI 로드 대기 (여러 요소 동시 대기)
                        return [4 /*yield*/, Promise.all([
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
                            ]).catch(function (error) { return __awaiter(_this, void 0, void 0, function () {
                                var currentUrl, elements;
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            console.error('UI elements load error:', error);
                                            currentUrl = page.url();
                                            _a = {};
                                            return [4 /*yield*/, page.$('.chat-input-textarea').catch(function () { return null; })];
                                        case 1:
                                            _a.input = _b.sent();
                                            return [4 /*yield*/, page.$('.chat-room-title').catch(function () { return null; })];
                                        case 2:
                                            _a.title = _b.sent();
                                            return [4 /*yield*/, page.$('.message-list').catch(function () { return null; })];
                                        case 3:
                                            elements = (_a.messageList = _b.sent(),
                                                _a);
                                            console.log('Current page state:', {
                                                url: currentUrl,
                                                elements: Object.entries(elements).reduce(function (acc, _a) {
                                                    var key = _a[0], value = _a[1];
                                                    acc[key] = !!value;
                                                    return acc;
                                                }, {})
                                            });
                                            if (!(currentUrl.includes('/chat') && currentUrl.includes('room='))) return [3 /*break*/, 6];
                                            console.log('Attempting page reload...');
                                            return [4 /*yield*/, page.reload({ waitUntil: 'networkidle' })];
                                        case 4:
                                            _b.sent();
                                            // 리로드 후 다시 UI 요소 대기
                                            return [4 /*yield*/, Promise.all([
                                                    page.waitForSelector('.chat-input-textarea', { timeout: 30000 }),
                                                    page.waitForSelector('.chat-room-title', { timeout: 30000 }),
                                                    page.waitForSelector('.message-list', { timeout: 30000 })
                                                ])];
                                        case 5:
                                            // 리로드 후 다시 UI 요소 대기
                                            _b.sent();
                                            return [3 /*break*/, 7];
                                        case 6: throw new Error('채팅방 UI 로드 실패');
                                        case 7: return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 13:
                        // 채팅방 UI 로드 대기 (여러 요소 동시 대기)
                        _b.sent();
                        finalUrl = page.url();
                        if (!finalUrl.includes('/chat') || !finalUrl.includes('room=')) {
                            throw new Error('최종 URL 검증 실패');
                        }
                        console.log('Room created and loaded successfully:', {
                            roomName: roomName,
                            url: finalUrl
                        });
                        return [3 /*break*/, 19];
                    case 14:
                        error_6 = _b.sent();
                        console.error('Room creation error:', error_6);
                        if (!!page.isClosed()) return [3 /*break*/, 18];
                        timestamp = Date.now();
                        return [4 /*yield*/, page.screenshot({
                                path: "test-results/create-room-error-".concat(timestamp, ".png"),
                                fullPage: true
                            })];
                    case 15:
                        _b.sent();
                        _a = {
                            url: page.url()
                        };
                        return [4 /*yield*/, page.content().catch(function () { return null; })];
                    case 16:
                        _a.content = _b.sent();
                        return [4 /*yield*/, page.evaluate(function () {
                                return window.consoleLog || [];
                            }).catch(function () { return []; })];
                    case 17:
                        pageState = (_a.console = _b.sent(),
                            _a);
                        console.error('Failed page state:', pageState);
                        _b.label = 18;
                    case 18: throw new Error("\uCC44\uD305\uBC29 \uC0DD\uC131 \uC2E4\uD328: ".concat(error_6.message));
                    case 19: return [2 /*return*/];
                }
            });
        });
    };
    // 비밀번호 처리 개선
    TestHelpers.prototype._handleRoomPasswordWithTimeout = function (page, password, timeout) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, page.waitForSelector('input[name="password"]', {
                            state: 'visible',
                            timeout: timeout
                        })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, Promise.all([
                                page.waitForNavigation({
                                    timeout: timeout,
                                    waitUntil: ['load', 'domcontentloaded', 'networkidle']
                                }),
                                page.fill('input[name="password"]', password),
                                page.click('button:has-text("입장")')
                            ])];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    // 연결 상태 확인 메서드
    TestHelpers.prototype._waitForConnection = function (page, timeout) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, page.waitForFunction(function () {
                                var socket = (window).io;
                                return socket && socket.connected;
                            }, { timeout: timeout })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/, true];
                    case 2:
                        _a = _b.sent();
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // 채팅방 UI 검증
    TestHelpers.prototype._verifyRoomLoaded = function (page, timeout) {
        return __awaiter(this, void 0, void 0, function () {
            var elements;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        elements = [
                            '.chat-room-title',
                            '.chat-messages',
                            '.chat-input-textarea:not([disabled])'
                        ];
                        return [4 /*yield*/, Promise.all(elements.map(function (selector) {
                                return page.waitForSelector(selector, {
                                    state: 'visible',
                                    timeout: timeout
                                });
                            }))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    TestHelpers.prototype.joinRoomByURLParam = function (page, roomId, password) {
        return __awaiter(this, void 0, void 0, function () {
            var currentUrl, currentRoomId, LOAD_TIMEOUT_1, passwordInput, needsPassword, requiredElements, finalUrl, finalRoomId, error_7, _a, _b, _c, timestamp, screenshotError_1;
            var _d;
            var _this = this;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 10, , 17]);
                        currentUrl = page.url();
                        currentRoomId = new URLSearchParams(new URL(currentUrl).search).get('room');
                        // 이미 같은 방에 있으면 스킵
                        if (currentRoomId === roomId) {
                            return [2 /*return*/];
                        }
                        LOAD_TIMEOUT_1 = 60000;
                        // 1. 페이지 로드
                        return [4 /*yield*/, page.goto("/chat?room=".concat(encodeURIComponent(roomId)), {
                                waitUntil: 'networkidle',
                                timeout: LOAD_TIMEOUT_1
                            })];
                    case 1:
                        // 1. 페이지 로드
                        _e.sent();
                        // 2. Socket 연결 대기
                        return [4 /*yield*/, page.waitForFunction(function () {
                                var socket = window.io;
                                return socket && socket.connected;
                            }, { timeout: LOAD_TIMEOUT_1 }).catch(function () {
                                console.warn('Socket connection check timed out');
                            })];
                    case 2:
                        // 2. Socket 연결 대기
                        _e.sent();
                        return [4 /*yield*/, page.locator('input[name="password"]')];
                    case 3:
                        passwordInput = _e.sent();
                        return [4 /*yield*/, passwordInput.isVisible().catch(function () { return false; })];
                    case 4:
                        needsPassword = _e.sent();
                        if (!needsPassword) return [3 /*break*/, 8];
                        if (!password) {
                            throw new Error('비밀번호가 필요한 채팅방입니다.');
                        }
                        return [4 /*yield*/, passwordInput.fill(password)];
                    case 5:
                        _e.sent();
                        return [4 /*yield*/, page.click('button:has-text("입장")')];
                    case 6:
                        _e.sent();
                        // 비밀번호 입력 후 페이지 로드 대기
                        return [4 /*yield*/, page.waitForLoadState('networkidle', { timeout: LOAD_TIMEOUT_1 })];
                    case 7:
                        // 비밀번호 입력 후 페이지 로드 대기
                        _e.sent();
                        _e.label = 8;
                    case 8:
                        requiredElements = [
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
                        return [4 /*yield*/, Promise.all(requiredElements.map(function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                                var error_8;
                                var selector = _b.selector, description = _b.description;
                                return __generator(this, function (_c) {
                                    switch (_c.label) {
                                        case 0:
                                            _c.trys.push([0, 2, , 3]);
                                            return [4 /*yield*/, page.waitForSelector(selector, {
                                                    state: 'visible',
                                                    timeout: LOAD_TIMEOUT_1
                                                })];
                                        case 1:
                                            _c.sent();
                                            console.log("".concat(description, " \uB85C\uB4DC\uB428"));
                                            return [3 /*break*/, 3];
                                        case 2:
                                            error_8 = _c.sent();
                                            throw new Error("".concat(description, " \uB85C\uB4DC \uC2E4\uD328: ").concat(error_8.message));
                                        case 3: return [2 /*return*/];
                                    }
                                });
                            }); }))];
                    case 9:
                        // 모든 필수 요소가 로드될 때까지 대기
                        _e.sent();
                        finalUrl = page.url();
                        finalRoomId = new URLSearchParams(new URL(finalUrl).search).get('room');
                        if (finalRoomId !== roomId) {
                            throw new Error("\uCC44\uD305\uBC29 \uC785\uC7A5 \uC2E4\uD328: \uC608\uC0C1\uB41C \uBC29 ID ".concat(roomId, ", \uC2E4\uC81C \uBC29 ID ").concat(finalRoomId));
                        }
                        return [3 /*break*/, 17];
                    case 10:
                        error_7 = _e.sent();
                        _b = (_a = console).error;
                        _c = ['URL 파라미터로 채팅방 입장 실패:'];
                        _d = {
                            error: error_7,
                            roomId: roomId,
                            currentUrl: page.url()
                        };
                        return [4 /*yield*/, this.getPageState(page)];
                    case 11:
                        _b.apply(_a, _c.concat([(_d.pageState = _e.sent(),
                                _d)]));
                        _e.label = 12;
                    case 12:
                        _e.trys.push([12, 15, , 16]);
                        if (!!page.isClosed()) return [3 /*break*/, 14];
                        timestamp = Date.now();
                        return [4 /*yield*/, page.screenshot({
                                path: "test-results/room-join-url-error-".concat(timestamp, ".png"),
                                fullPage: true
                            })];
                    case 13:
                        _e.sent();
                        _e.label = 14;
                    case 14: return [3 /*break*/, 16];
                    case 15:
                        screenshotError_1 = _e.sent();
                        console.error('스크린샷 촬영 실패:', screenshotError_1);
                        return [3 /*break*/, 16];
                    case 16: throw new Error("\uCC44\uD305\uBC29 \uC785\uC7A5 \uC2E4\uD328 (URL \uD30C\uB77C\uBBF8\uD130\uB85C \uC811\uADFC): ".concat(error_7.message));
                    case 17: return [2 /*return*/];
                }
            });
        });
    };
    // 페이지 상태 정보 수집을 위한 헬퍼 메서드
    TestHelpers.prototype.getPageState = function (page) {
        return __awaiter(this, void 0, void 0, function () {
            var error_9;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, page.evaluate(function () {
                                var _a;
                                return ({
                                    url: window.location.href,
                                    readyState: document.readyState,
                                    socketConnected: !!((_a = (window).io) === null || _a === void 0 ? void 0 : _a.connected),
                                    elements: {
                                        title: !!document.querySelector('.chat-room-title'),
                                        messages: !!document.querySelector('.chat-messages'),
                                        input: !!document.querySelector('.chat-input-textarea')
                                    }
                                });
                            })];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_9 = _a.sent();
                        return [2 /*return*/, {
                                error: 'Failed to get page state',
                                message: error_9.message
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    TestHelpers.prototype.sendMessage = function (page, message, parameters) {
        return __awaiter(this, void 0, void 0, function () {
            var finalMessage, inputSelector, error_10;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 8, , 10]);
                        return [4 /*yield*/, this.messageService.generateMessage(message, parameters)];
                    case 1:
                        finalMessage = _a.sent();
                        inputSelector = '.chat-input-textarea';
                        // 입력 필드가 나타날 때까지 대기
                        return [4 /*yield*/, page.waitForSelector(inputSelector, {
                                state: 'visible',
                                timeout: 30000
                            })];
                    case 2:
                        // 입력 필드가 나타날 때까지 대기
                        _a.sent();
                        // 네트워크 요청이 완료될 때까지 대기
                        return [4 /*yield*/, page.waitForLoadState('networkidle')];
                    case 3:
                        // 네트워크 요청이 완료될 때까지 대기
                        _a.sent();
                        // 입력 필드가 활성화될 때까지 대기
                        return [4 /*yield*/, page.waitForSelector("".concat(inputSelector, ":not([disabled])"), {
                                timeout: 30000
                            })];
                    case 4:
                        // 입력 필드가 활성화될 때까지 대기
                        _a.sent();
                        // 메시지 입력
                        return [4 /*yield*/, page.fill(inputSelector, finalMessage)];
                    case 5:
                        // 메시지 입력
                        _a.sent();
                        // Enter 키 입력 전 잠시 대기
                        return [4 /*yield*/, page.waitForTimeout(500)];
                    case 6:
                        // Enter 키 입력 전 잠시 대기
                        _a.sent();
                        // 메시지 전송
                        return [4 /*yield*/, page.keyboard.press('Enter')];
                    case 7:
                        // 메시지 전송
                        _a.sent();
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
                        return [2 /*return*/, finalMessage];
                    case 8:
                        error_10 = _a.sent();
                        console.error('Message send error:', error_10);
                        return [4 /*yield*/, this.takeErrorScreenshot(page, 'message-send')];
                    case 9:
                        _a.sent();
                        throw error_10;
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    TestHelpers.prototype.sendAIMessage = function (page_1, message_1) {
        return __awaiter(this, arguments, void 0, function (page, message, aiType) {
            var mentionMessage, error_11;
            if (aiType === void 0) { aiType = 'wayneAI'; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 7]);
                        return [4 /*yield*/, page.waitForSelector('.chat-input-textarea', {
                                state: 'visible',
                                timeout: 20000
                            })];
                    case 1:
                        _a.sent();
                        mentionMessage = "@".concat(aiType, " ").concat(message);
                        return [4 /*yield*/, page.fill('.chat-input-textarea', mentionMessage)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, page.keyboard.press('Enter')];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, page.waitForSelector('.message-ai', {
                                timeout: 30000,
                                state: 'visible'
                            })];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 7];
                    case 5:
                        error_11 = _a.sent();
                        console.error('AI message interaction failed:', error_11);
                        return [4 /*yield*/, this.takeErrorScreenshot(page, 'ai-message')];
                    case 6:
                        _a.sent();
                        throw new Error("AI \uBA54\uC2DC\uC9C0 \uC804\uC1A1 \uC2E4\uD328: ".concat(error_11.message));
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    TestHelpers.prototype.addReaction = function (page_1, messageSelector_1) {
        return __awaiter(this, arguments, void 0, function (page, messageSelector, emojiIndex) {
            var error_12;
            if (emojiIndex === void 0) { emojiIndex = 0; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 6, , 8]);
                        return [4 /*yield*/, page.hover(messageSelector)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, page.click('.action-button')];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, page.waitForSelector('.emoji-picker-container')];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, page.click(".emoji-picker-container button >> nth=".concat(emojiIndex))];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, page.waitForSelector('.reaction-badge')];
                    case 5:
                        _a.sent();
                        return [3 /*break*/, 8];
                    case 6:
                        error_12 = _a.sent();
                        console.error('Add reaction failed:', error_12);
                        return [4 /*yield*/, this.takeErrorScreenshot(page, 'reaction')];
                    case 7:
                        _a.sent();
                        throw new Error("\uB9AC\uC561\uC158 \uCD94\uAC00 \uC2E4\uD328: ".concat(error_12.message));
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    TestHelpers.prototype.uploadFile = function (page, filePath, fileType) {
        return __awaiter(this, void 0, void 0, function () {
            var fileInput, submitButton, error_13;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 10, , 12]);
                        return [4 /*yield*/, page.waitForSelector('input[type="file"]', {
                                timeout: 30000,
                                state: 'visible'
                            })];
                    case 1:
                        fileInput = _a.sent();
                        return [4 /*yield*/, fileInput.setInputFiles(filePath)];
                    case 2:
                        _a.sent();
                        if (!(fileType === 'image')) return [3 /*break*/, 4];
                        return [4 /*yield*/, page.waitForSelector('.file-preview-item img', {
                                timeout: 30000,
                                state: 'visible'
                            })];
                    case 3:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 4:
                        if (!(fileType === 'pdf')) return [3 /*break*/, 6];
                        return [4 /*yield*/, page.waitForSelector('.file-preview-item .file-icon', {
                                timeout: 30000,
                                state: 'visible'
                            })];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6: return [4 /*yield*/, page.waitForSelector('.chat-input-actions button[type="submit"]', {
                            timeout: 30000,
                            state: 'visible'
                        })];
                    case 7:
                        submitButton = _a.sent();
                        return [4 /*yield*/, submitButton.click()];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, page.waitForSelector('.message-content .file-message', {
                                timeout: 30000,
                                state: 'visible'
                            })];
                    case 9:
                        _a.sent();
                        return [3 /*break*/, 12];
                    case 10:
                        error_13 = _a.sent();
                        console.error('File upload failed:', error_13);
                        return [4 /*yield*/, this.takeErrorScreenshot(page, 'file-upload')];
                    case 11:
                        _a.sent();
                        throw new Error("\uD30C\uC77C \uC5C5\uB85C\uB4DC \uC2E4\uD328: ".concat(error_13.message));
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    TestHelpers.prototype.simulateConversation = function (pages_1, messages_1) {
        return __awaiter(this, arguments, void 0, function (pages, messages, delayMin, delayMax) {
            var _i, messages_2, message, randomPage, delay, error_14;
            if (delayMin === void 0) { delayMin = 1000; }
            if (delayMax === void 0) { delayMax = 3000; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _i = 0, messages_2 = messages;
                        _a.label = 1;
                    case 1:
                        if (!(_i < messages_2.length)) return [3 /*break*/, 7];
                        message = messages_2[_i];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 5, , 6]);
                        randomPage = pages[Math.floor(Math.random() * pages.length)];
                        return [4 /*yield*/, this.sendMessage(randomPage, message)];
                    case 3:
                        _a.sent();
                        delay = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
                        return [4 /*yield*/, randomPage.waitForTimeout(delay)];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        error_14 = _a.sent();
                        console.error('Conversation simulation failed:', error_14);
                        throw new Error("\uB300\uD654 \uC2DC\uBBAC\uB808\uC774\uC158 \uC2E4\uD328: ".concat(error_14.message));
                    case 6:
                        _i++;
                        return [3 /*break*/, 1];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    TestHelpers.prototype.getConversationHistory = function (page) {
        return __awaiter(this, void 0, void 0, function () {
            var error_15;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 5]);
                        return [4 /*yield*/, page.waitForSelector('.message-content', {
                                timeout: 30000,
                                state: 'visible'
                            })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, page.$$eval('.message-content', function (elements) {
                                return elements.map(function (el) {
                                    var _a, _b, _c, _d, _e, _f, _g;
                                    return ({
                                        text: ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || '',
                                        timestamp: (_d = (_c = (_b = el.closest('.message-group')) === null || _b === void 0 ? void 0 : _b.querySelector('.message-time')) === null || _c === void 0 ? void 0 : _c.textContent) === null || _d === void 0 ? void 0 : _d.trim(),
                                        sender: ((_g = (_f = (_e = el.closest('.message-group')) === null || _e === void 0 ? void 0 : _e.querySelector('.message-sender')) === null || _f === void 0 ? void 0 : _f.textContent) === null || _g === void 0 ? void 0 : _g.trim()) || 'Unknown'
                                    });
                                });
                            })];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        error_15 = _a.sent();
                        console.error('Getting conversation history failed:', error_15);
                        return [4 /*yield*/, this.takeErrorScreenshot(page, 'conversation-history')];
                    case 4:
                        _a.sent();
                        throw new Error("\uB300\uD654 \uB0B4\uC5ED \uC870\uD68C \uC2E4\uD328: ".concat(error_15.message));
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    TestHelpers.prototype.waitForMessageDelivery = function (page_1, messageContent_1) {
        return __awaiter(this, arguments, void 0, function (page, messageContent, timeout) {
            var error_16;
            if (timeout === void 0) { timeout = 30000; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 4]);
                        return [4 /*yield*/, page.waitForFunction(function (text) {
                                var messages = document.querySelectorAll('.message-content');
                                return Array.from(messages).some(function (msg) { var _a; return (_a = msg.textContent) === null || _a === void 0 ? void 0 : _a.includes(text); });
                            }, messageContent, { timeout: timeout })];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 2:
                        error_16 = _a.sent();
                        console.error('Message delivery verification failed:', error_16);
                        return [4 /*yield*/, this.takeErrorScreenshot(page, 'message-delivery')];
                    case 3:
                        _a.sent();
                        throw new Error("\uBA54\uC2DC\uC9C0 \uC804\uC1A1 \uD655\uC778 \uC2E4\uD328: ".concat(error_16.message));
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    TestHelpers.prototype.verifyRoomState = function (page) {
        return __awaiter(this, void 0, void 0, function () {
            var state, error_17;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 5, , 7]);
                        _a = {};
                        return [4 /*yield*/, page.locator('.chat-room-title').textContent()];
                    case 1:
                        _a.title = _b.sent();
                        return [4 /*yield*/, page.locator('.participants-count').textContent()];
                    case 2:
                        _a.participantCount = _b.sent();
                        return [4 /*yield*/, page.locator('.message-content').count()];
                    case 3:
                        // isConnected: await page.locator('.connection-status .text-success').isVisible(),
                        _a.hasMessages = (_b.sent()) > 0;
                        return [4 /*yield*/, page.locator('.chat-input-textarea').isEnabled()];
                    case 4:
                        state = (_a.inputEnabled = _b.sent(),
                            _a);
                        return [2 /*return*/, state];
                    case 5:
                        error_17 = _b.sent();
                        console.error('Room state verification failed:', error_17);
                        return [4 /*yield*/, this.takeErrorScreenshot(page, 'room-state')];
                    case 6:
                        _b.sent();
                        throw new Error("\uCC44\uD305\uBC29 \uC0C1\uD0DC \uD655\uC778 \uC2E4\uD328: ".concat(error_17.message));
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    // 비밀번호 처리를 위한 헬퍼 메서드
    TestHelpers.prototype.handleRoomPassword = function (page, password) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!password) return [3 /*break*/, 4];
                        return [4 /*yield*/, page.waitForSelector('input[name="password"]', {
                                state: 'visible',
                                timeout: 30000
                            })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, page.fill('input[name="password"]', password)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, page.click('button:has-text("입장")')];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // 채팅방 로드 대기를 위한 헬퍼 메서드
    TestHelpers.prototype.waitForRoomLoad = function (page) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: 
                    // 채팅방 UI 로드 확인
                    return [4 /*yield*/, page.waitForSelector('.chat-container', {
                            state: 'visible',
                            timeout: 30000
                        })];
                    case 1:
                        // 채팅방 UI 로드 확인
                        _a.sent();
                        // 채팅 입력창 활성화 확인
                        return [4 /*yield*/, page.waitForSelector('.chat-input-textarea:not([disabled])', {
                                state: 'visible',
                                timeout: 30000
                            })];
                    case 2:
                        // 채팅 입력창 활성화 확인
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    // 에러 스크린샷을 위한 헬퍼 메서드
    TestHelpers.prototype.takeErrorScreenshot = function (page, prefix) {
        return __awaiter(this, void 0, void 0, function () {
            var screenshotError_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, page.screenshot({
                                path: "test-results/".concat(prefix, "-error-").concat(Date.now(), ".png"),
                                fullPage: true
                            })];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        screenshotError_2 = _a.sent();
                        console.error('Screenshot failed:', screenshotError_2);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return TestHelpers;
}());
module.exports = {
    TestHelpers: TestHelpers
};
