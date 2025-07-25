// scheduler.js
const redis = require('../utils/redisClient');
const mongoose = require('mongoose');
const cron = require('node-cron');

// Mongoose 모델 import
const User = require('../models/User');
const Room = require('../models/Room');
const Message = require('../models/Message');

// 1. 채팅 메시지 동기화
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

function fixParticipantsField(participantsRaw) {
    if (!participantsRaw) return [];
    // participantsRaw가 JSON 문자열로 감싸진 한 개짜리 배열인 경우
    if (Array.isArray(participantsRaw) && participantsRaw.length === 1) {
        try {
            // participantsRaw[0]이 JSON 배열 문자열이면 파싱
            const arr = JSON.parse(participantsRaw[0]);
            // ObjectId로 변환될 수 있는 값만 필터
            return arr.filter(isValidObjectId);
        } catch (e) {
            // 파싱 실패시 원본에서 ObjectId만 추림
            return participantsRaw.filter(isValidObjectId);
        }
    }
    // 정상 배열일 때 ObjectId만 필터
    if (Array.isArray(participantsRaw)) {
        return participantsRaw.filter(isValidObjectId);
    }
    // participantsRaw가 문자열(JSON 배열 문자열)인 경우
    if (typeof participantsRaw === 'string') {
        try {
            const arr = JSON.parse(participantsRaw);
            if (Array.isArray(arr)) return arr.filter(isValidObjectId);
        } catch (e) {
            // 파싱 실패시 빈 배열
            return [];
        }
    }
    return [];
}

// reactions 변환 함수
function fixReactionsField(reactionsRaw) {
    if (!reactionsRaw || typeof reactionsRaw !== 'object') return new Map();

    // Map 또는 일반 객체 지원
    const reactionsFixed = {};
    for (const [emoji, arr] of Object.entries(reactionsRaw)) {
        let usersArr = arr;
        // string 타입이면 JSON 파싱 시도
        if (typeof usersArr === 'string') {
            try {
                usersArr = JSON.parse(usersArr);
            } catch {
                usersArr = [];
            }
        }
        // 배열화 + ObjectId로 변환 가능한 값만 필터
        if (!Array.isArray(usersArr)) usersArr = [usersArr];
        reactionsFixed[emoji] = usersArr.filter(isValidObjectId);
    }
    return reactionsFixed;
}

async function syncMessages() {
    await mongoose.connect(process.env.MONGO_URI);
    const roomKeys = await redis.keys('room:*');

    for (const roomKey of roomKeys) {
        const roomId = roomKey.split(':')[1];
        const messageListKey = `chat:messages:${roomId}`;
        const messages = await redis.lRange(messageListKey, 0, -1);
        if (messages.length > 0) {
            for (const msgRaw of messages) {
                try {
                    const msg = JSON.parse(msgRaw);

                    // 2. sender 값 처리
                    if (msg.sender && !isValidObjectId(msg.sender)) {
                        let userQuery = null;
                        if (/^\d+$/.test(msg.sender)) {
                            // 숫자면 userId로
                            userQuery = { userId: msg.sender };
                        } else if (msg.sender.includes('@')) {
                            // email이면
                            userQuery = { email: msg.sender };
                        }
                        if (userQuery) {
                            let user = await User.findOne(userQuery).select('id');
                            if (!user) {
                                msg.sender = undefined;
                            } else {
                                msg.sender = user.id;
                            }
                        }
                    }

                    if (msg.reactions) {
                        msg.reactions = fixReactionsField(msg.reactions);
                    }

                    await Message.updateOne(
                        { id: msg.id },
                        { $set: msg },
                        { upsert: true }
                    );
                } catch (e) {
                    console.error('메시지 JSON 파싱 오류:', e, msgRaw);
                }
            }
        }
    }
}


// 2. 유저 동기화
async function syncUsers() {
    const userKeys = await redis.keys('user:*');
    const processed = new Set();

    for (const userKey of userKeys) {
        const userData = await redis.hGetAll(userKey);
        // userId, email 등으로 중복 확인
        const uniqueKey = userData.id || userData.email;
        if (!uniqueKey || processed.has(uniqueKey)) continue;
        processed.add(uniqueKey);

        if (Object.keys(userData).length) {
            // 먼저 DB에 이미 있는지 확인 (id 또는 email 기준)
            let exists = null;
            if (userData.id) {
                exists = await User.findOne({ id: userData.id });
            }
            // id 기준으로 없으면 email 기준으로 한 번 더 체크
            if (!exists && userData.email) {
                exists = await User.findOne({ email: userData.email });
            }

            // DB에 없을 때만 새로 저장
            if (!exists) {
                await User.create(userData);
            }
        }
    }
}


// 3. 방 동기화
async function syncRooms() {
    await mongoose.connect(process.env.MONGO_URI);

    const roomKeys = await redis.keys('room:*');
    for (const roomKey of roomKeys) {
        const roomData = await redis.hGetAll(roomKey);

        // id -> _id 변환
        if (roomData.id && !roomData._id) roomData._id = roomData.id;
        delete roomData.id;

        // participants 보정
        if (roomData.participants) {
            // 보통 Redis에서 가져온 값은 string일 수 있으므로, JSON 파싱 필요
            roomData.participants = fixParticipantsField(roomData.participants);
        } else {
            roomData.participants = [];
        }

        // creator(방장)도 ObjectId 타입이면 변환 필요
        if (roomData.creator && !isValidObjectId(roomData.creator)) {
            // creator가 숫자/이메일 등일 때 User에서 ObjectId 찾아 변환(생략 가능)
            // roomData.creator = ... (User 조회 후 변환 로직 추가 가능)
            roomData.creator = undefined;
        }

        // Room 저장/업데이트
        await Room.updateOne(
            { id: roomData.id || roomKey.split(':')[1] },
            { $set: roomData },
            { upsert: true }
        );
    }
}

// 주기적 실행 (3분마다)
cron.schedule('*/3 * * * *', async () => {
    try {
        console.log('=== [스케쥴러] 동기화 시작 ===');
        await Promise.all([
            syncUsers(),
            syncRooms(),
            syncMessages()
        ]);
        console.log('=== [스케쥴러] 동기화 완료 ===');
    } catch (e) {
        console.error('스케쥴러 동기화 실패:', e);
    }
});

// DB 연결 예시
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('MongoDB connected');
    }).catch(console.error);
