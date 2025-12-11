const { loginScenario, failedLoginScenario } = require('./scenarios/auth.scenario.js');
const {
    chatRoomCreationScenario,
    massMessageScenario,
    fileUploadScenario,
    forbiddenWordScenario,
} = require('./scenarios/chat.scenario.js');
const {
    fullProfileUpdateScenario,
} = require('./scenarios/profile.scenario.js');

function generateUserSchema() {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);

    // 고유한 테스트 사용자 생성
    const testUser = {
        email: `loadtest_${timestamp}_${randomId}@example.com`,
        password: 'Password123!',
        passwordConfirm: 'Password123!',
        name: `Load Test User ${randomId}`,
    };
    return testUser;
}

const allScenariosFlat = [
    // auth Scenarios
    failedLoginScenario,
    loginScenario,

    // chat Scenarios
    chatRoomCreationScenario,
    massMessageScenario,
    fileUploadScenario,
    forbiddenWordScenario,

    // profile Scenarios
    fullProfileUpdateScenario,
];


/**
 * 통합 시나리오 순차 실행
 * 모든 개별 시나리오를 순서대로 실행
 */
async function allScenarios(page, vuContext) {
    const testUser = generateUserSchema();
    vuContext.vars.testUser = testUser;

    for (const scenario of allScenariosFlat) {
        await scenario(page, vuContext);
    }
}

module.exports = {
    allScenarios,
};
