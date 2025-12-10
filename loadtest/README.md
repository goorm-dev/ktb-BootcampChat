# KTB Chat Load Testing Suite

Socket.IO 기반 채팅 애플리케이션의 부하 테스트를 위한 커스텀 Node.js 스크립트입니다.

## 테스트 유형 선택 가이드

### 📊 Batch Load Test (`load-test.js`)
**목적**: 순간적인 피크 부하 및 배치 접속 테스트

사용 시나리오:
- 많은 사용자가 동시에 접속하는 상황 (이벤트 시작, 공지사항 등)
- 서버의 순간 부하 처리 능력 측정
- 짧은 시간 내 많은 메시지 전송 테스트

```bash
npm run test:medium  # 200명, 배치 접속
```

### 📈 Ramp-Up Load Test (`ramp-up-test.js`)
**목적**: 점진적인 사용자 및 채팅방 증가로 시스템 임계점 테스트

사용 시나리오:
- **시스템 임계점 발견** (사용자 + 채팅방 수 동시 증가)
- 실제 서비스의 사용자 증가 패턴 시뮬레이션
- 장시간 안정성 테스트
- 지속적인 메시지 트래픽 부하 테스트
- 다중 채팅방 환경에서의 부하 테스트

```bash
npm run test:rampup  # 500명, ~70개 방까지 점진적 증가, 3분 유지
```

## 주요 기능

- ✅ Socket.IO 클라이언트 기반 실제 연결 시뮬레이션
- ✅ JWT + Session 인증 플로우 자동 처리
- ✅ 점진적 부하 증가 (Ramp-up)
- ✅ 실시간 메트릭 대시보드 (고정 화면, 스크롤 없음)
- ✅ 메시지 읽음 처리 자동화 (message → markMessagesAsRead → messagesRead)
- ✅ 메시지 전송 지연시간 측정 (Avg, P95, P99)
- ✅ 연결 성공률 및 에러 추적
- ✅ 최근 활동 로그 표시 (최근 10개 항목)
- ✅ 커맨드라인 인터페이스로 유연한 설정

## 시스템 요구사항

- Node.js 18+
- 실행 중인 KTB Chat 백엔드 서버
  - REST API (기본: http://localhost:3000)
  - Socket.IO (기본: http://localhost:5002)

## 설치

```bash
cd loadtest
npm install
```

## 사용법

### 1. 백엔드 서버 구동

```bash
cd ../apps/backend
make dev
```

### 2. 테스트 유저 사전 생성 (선택사항)

부하 테스트는 자동으로 유저를 생성하지만, 사전에 생성해두면 더 빠릅니다.

```bash
# 100명의 테스트 유저 생성
npm run create-users

# 커스텀 설정
node create-test-users.js --count=1000 --api-url=http://localhost:3000
```

### 3. 부하 테스트 실행

#### 사전 정의된 시나리오

```bash
# 가벼운 테스트 (50명, 10명씩 배치, 1초 간격)
npm run test:light

# 중간 테스트 (200명, 20명씩 배치, 1초 간격)
npm run test:medium

# 무거운 테스트 (1000명, 50명씩 배치, 0.5초 간격)
npm run test:heavy
```

#### 커스텀 설정

```bash
# 기본 실행
node load-test.js

# 모든 옵션 지정
node load-test.js \
  --users=500 \
  --batch-size=25 \
  --batch-delay=1000 \
  --messages=50 \
  --api-url=http://localhost:3000 \
  --socket-url=http://localhost:5002 \
  --room-id=your-room-id
```

## 커맨드라인 옵션

| 옵션 | 별칭 | 설명 | 기본값 |
|------|------|------|--------|
| `--users` | `-u` | 시뮬레이션할 총 유저 수 | 100 |
| `--rampup` | `-r` | Ramp-up 시간 (초) | 30 |
| `--batch-size` | `-b` | 배치당 동시 접속 유저 수 | 10 |
| `--batch-delay` | - | 배치 간 대기 시간 (밀리초) | 1000 |
| `--messages` | `-m` | 유저당 메시지 수 | 20 |
| `--api-url` | - | REST API URL | http://localhost:3000 |
| `--socket-url` | - | Socket.IO URL | http://localhost:5002 |
| `--room-id` | - | 채팅방 ID (없으면 자동 생성) | null |
| `--help` | `-h` | 도움말 표시 | - |

## 메트릭 설명

테스트 실행 중 2초마다 화면이 업데이트되며 다음 메트릭이 표시됩니다:

### 연결 메트릭
- **Users Created**: 생성/로그인된 유저 수
- **Connected**: 성공적으로 Socket.IO 연결된 유저 수
- **Disconnected**: 연결 해제된 유저 수

### 메시지 메트릭
- **Messages Sent**: 전송된 총 메시지 수
- **Messages Received**: 수신된 총 메시지 수 (브로드캐스트)
- **Messages Marked Read**: 읽음 처리 요청을 보낸 메시지 수
- **Read Acks Received**: 서버로부터 받은 읽음 확인 응답 수
- **Messages/sec**: 초당 메시지 전송률

### 성능 메트릭
- **Avg Message Latency**: 평균 메시지 전송 지연시간
- **P95 Message Latency**: 95 백분위수 지연시간
- **P99 Message Latency**: 99 백분위수 지연시간
- **Avg Connection Time**: 평균 연결 소요 시간

### 에러 메트릭
- **Auth Errors**: 인증/로그인 실패 수
- **Connection Errors**: Socket.IO 연결 실패 수
- **Message Errors**: 메시지 전송 실패 수

### 최근 활동 로그
화면 하단에 최근 10개의 활동 로그가 컬러로 표시됩니다:
- 🔵 파란색: 일반 정보
- 🟢 초록색: 성공 메시지
- 🟡 노란색: 경고
- 🔴 빨간색: 에러

## 동작 원리

### 1. 테스트 방 생성
```
테스트 시작
  ↓
Admin 유저 생성 및 로그인
  ↓
공통 테스트 방 생성 (모든 유저가 이 방 사용)
  ↓
방 ID 획득
```

### 2. 인증 플로우
```
사용자 생성/로그인
  ↓
JWT 토큰 + Session ID 획득
  ↓
Socket.IO 연결 (auth 객체에 토큰 전달)
  ↓
연결 성공
  ↓
테스트 방에 참여
```

### 3. 메시지 전송 및 읽음 처리
- 각 유저는 1-5초 랜덤 간격으로 메시지 전송
- 지정된 메시지 수만큼 전송 후 자동 연결 해제
- 실제 사용자 행동 패턴 시뮬레이션
- 모든 유저가 같은 방에서 채팅하므로 브로드캐스트 테스트 가능

**메시지 읽음 처리 플로우**:
```
서버에서 message 이벤트 수신
  ↓
메시지 ID 추출 (data._id)
  ↓
markMessagesAsRead 이벤트 전송
  ↓
서버에서 messagesRead 이벤트 수신
  ↓
Read Acks Received 카운터 증가
```

### 4. 배치 처리 전략
- 유저를 배치 단위로 동시에 생성하여 빠른 접속
- 기본값: 10명씩 배치, 1초 간격
- 예: 100명/10명 배치 = 10개 배치, 각 배치 간 1초 대기
- 서버에 급격한 부하를 방지하면서도 빠른 접속 가능

**배치 처리 플로우**:
```
배치 1: 유저 0-9 동시 생성
  ↓ (1초 대기)
배치 2: 유저 10-19 동시 생성
  ↓ (1초 대기)
배치 3: 유저 20-29 동시 생성
  ...
```

**커스터마이징**:
- `--batch-size=20`: 배치당 20명씩
- `--batch-delay=500`: 배치 간 0.5초 대기

## 테스트 시나리오 예시

### 시나리오 1: 빠른 대규모 접속 테스트
```bash
node load-test.js --users=1000 --batch-size=50 --batch-delay=500 --messages=5
```
- 1000명을 50명씩 배치로 접속 (20개 배치)
- 각 배치 간 0.5초 대기 (총 10초 소요)
- 각 유저는 5개 메시지 전송
- 피크 부하 테스트에 최적

### 시나리오 2: 안정적인 중규모 테스트
```bash
node load-test.js --users=500 --batch-size=10 --batch-delay=1000 --messages=50
```
- 500명을 10명씩 배치로 접속 (50개 배치)
- 각 배치 간 1초 대기 (총 50초 소요)
- 각 유저는 50개 메시지 전송
- 장시간 안정성 테스트

### 시나리오 3: 소규모 검증 테스트
```bash
node load-test.js --users=20 --batch-size=5 --batch-delay=2000 --messages=10
```
- 20명을 5명씩 배치로 접속 (4개 배치)
- 각 배치 간 2초 대기 (총 6초 소요)
- 각 유저는 10개 메시지 전송
- 기능 검증 및 디버깅용

### 시나리오 4: 극한 동시 접속 테스트
```bash
node load-test.js --users=500 --batch-size=500 --messages=3
```
- 500명을 한 번에 동시 접속
- 배치 간 대기 없음
- 서버의 순간 부하 처리 능력 테스트

## 주의사항

### Rate Limiting
- 백엔드에 Rate Limiting이 설정되어 있다면 테스트 전 비활성화 필요
- 기본: IP당 60 req/min

### 세션 TTL
- 세션 만료 시간: 30분
- 장시간 테스트 시 재인증 로직 필요

### MongoDB 성능
- 매 메시지마다 세션 검증을 위한 DB 조회 발생
- 대규모 테스트 시 MongoDB가 병목이 될 수 있음
- 적절한 인덱스 설정 확인 필요

### 메모리 사용량
- 1000+ 동시 연결 시 Node.js 메모리 사용량 증가
- 필요 시 `--max-old-space-size` 옵션 사용:
  ```bash
  node --max-old-space-size=4096 load-test.js --users=5000
  ```

## 트러블슈팅

### "Connection refused" 에러
- 백엔드 서버가 실행 중인지 확인
- URL이 올바른지 확인 (`--api-url`, `--socket-url`)

### "Authentication failed" 에러
- 백엔드 서버의 JWT 설정 확인
- 테스트 유저가 정상적으로 생성되는지 확인

### 메시지가 전송되지 않음
- 방 ID가 유효한지 확인
- 유저가 방 멤버로 추가되었는지 확인
- 백엔드 로그에서 에러 확인

### 성능이 예상보다 낮음
- MongoDB 연결 풀 크기 확인
- 네트워크 지연시간 확인
- 서버 리소스 (CPU, 메모리) 확인

## Ramp-Up Load Test (점진적 부하 테스트)

`ramp-up-test.js`는 **사용자와 채팅방이 동시에 지속적으로 증가**하는 실제 서비스 시나리오를 시뮬레이션합니다.

### 주요 특징

- **1초마다 새로운 채팅방 1개 생성**
- 각 채팅방에 5-10명(설정 가능)의 사용자가 랜덤하게 로그인
- 각 사용자는 방에 입장하자마자 메시지 전송 시작
- 최대 사용자 수(기본 500명)까지 지속적으로 증가
- **결과: ~50-100개의 채팅방에 500명 분산** (임계점 테스트에 최적)
- 최대 도달 후 설정된 시간(기본 3분) 동안 부하 유지
- 유지 시간 종료 후 모든 사용자 일시 종료

### 사용법

```bash
# 기본 실행 (최대 500명, 3분 유지)
node ramp-up-test.js

# 커스텀 설정
node ramp-up-test.js \
  --max-users=1000 \
  --min-users-per-second=5 \
  --max-users-per-second=10 \
  --sustain-duration=180 \
  --message-interval-min=2000 \
  --message-interval-max=5000

# npm 스크립트 사용
npm run test:rampup         # 기본 설정
npm run test:rampup:small   # 작은 규모 (200명)
npm run test:rampup:large   # 대규모 (1000명)
```

### 커맨드라인 옵션

| 옵션 | 별칭 | 설명 | 기본값 |
|------|------|------|--------|
| `--max-users` | `-u` | 최대 동시 접속 사용자 수 | 500 |
| `--min-users-per-second` | - | 초당 추가할 최소 사용자 수 | 5 |
| `--max-users-per-second` | - | 초당 추가할 최대 사용자 수 | 10 |
| `--sustain-duration` | `-s` | 최대 부하 유지 시간 (초) | 180 |
| `--message-interval-min` | - | 메시지 전송 최소 간격 (밀리초) | 2000 |
| `--message-interval-max` | - | 메시지 전송 최대 간격 (밀리초) | 5000 |
| `--api-url` | - | REST API URL | http://localhost:5001 |
| `--socket-url` | - | Socket.IO URL | http://localhost:5002 |
| `--room-id` | - | 채팅방 ID (없으면 자동 생성) | null |

### 테스트 시나리오 예시

#### 시나리오 1: 빠른 증가 테스트 (임계점 빠른 발견)
```bash
node ramp-up-test.js --max-users=500 --min-users-per-second=10 --max-users-per-second=20
```
- 초당 10-20명씩 빠르게 증가
- 약 25-50초 내에 500명, ~40개 방 도달
- 급격한 트래픽 증가 대응 능력 테스트
- **빠르게 시스템 임계점 확인**

#### 시나리오 2: 느린 증가, 장시간 유지 (안정성 테스트)
```bash
node ramp-up-test.js --max-users=1000 --min-users-per-second=3 --max-users-per-second=7 --sustain-duration=600
```
- 초당 3-7명씩 천천히 증가
- 약 2-5분에 걸쳐 1000명, ~200개 방 도달
- 10분간 최대 부하 유지
- **장시간 안정성 및 메모리 누수 테스트**

#### 시나리오 3: 실제 서비스 패턴 (현실적 임계점)
```bash
node ramp-up-test.js --max-users=300 --min-users-per-second=5 --max-users-per-second=10 --sustain-duration=300
```
- 실제 서비스의 점진적 사용자 증가 패턴 시뮬레이션
- 300명, ~40개 방 생성
- 5분간 부하 유지
- **실제 운영 환경에서의 임계점 검증**

### 동작 원리

```
시작
  ↓
Admin 사용자 생성 (방 생성용)
  ↓
[Ramp-Up Phase - 1초마다 반복]
  ├─ 새로운 채팅방 1개 생성 (Room #1, #2, #3, ...)
  ├─ 5-10명 랜덤 로그인
  ├─ 그 사용자들 모두 → 같은 새 방 입장
  ├─ 각 사용자 즉시 메시지 전송 시작
  ├─ 모든 사용자는 계속해서 메시지 전송 (2-5초 간격)
  └─ 최대 사용자 수 도달까지 반복
  ↓
[Sustain Phase]
  ├─ 모든 방에서 모든 사용자 계속 메시지 전송
  └─ 설정된 시간(기본 3분) 동안 유지
  ↓
[Shutdown Phase]
  └─ 모든 사용자 동시 종료
```

**예시 (500명 목표):**
- 0초: Room #1 생성 → 7명 로그인 → Room #1 입장 (총: 1방, 7명)
- 1초: Room #2 생성 → 6명 로그인 → Room #2 입장 (총: 2방, 13명)
- 2초: Room #3 생성 → 9명 로그인 → Room #3 입장 (총: 3방, 22명)
- ...
- 약 60-100초 후: ~70개 방, 500명 도달
- 3분간 유지 후 일시 종료

### 기존 load-test.js와의 차이점

| 특징 | load-test.js | ramp-up-test.js |
|------|--------------|-----------------|
| 채팅방 | 1개 방에 모든 사용자 | 1초마다 새 방 생성, 사용자 분산 |
| 사용자 추가 방식 | 배치 단위로 동시 추가 | 1초마다 랜덤 수만큼 추가 |
| 메시지 전송 | 정해진 개수 전송 후 종료 | 테스트 종료까지 계속 전송 |
| 테스트 종료 | 각 사용자가 개별 종료 | 모든 사용자 동시 종료 |
| 적합한 시나리오 | 피크 부하, 배치 접속 | 점진적 증가, 임계점 테스트 |
| 테스트 대상 | 단일 방 부하 | 다중 방 + 전체 시스템 부하 |

### 메트릭 추가 사항

Ramp-Up 테스트에서는 다음 추가 메트릭이 표시됩니다:

- **Rooms Created**: 생성된 채팅방 개수
- **Test Phase**: 현재 테스트 단계 (Ramping Up / Sustaining / Completed)
- **Active Users**: 현재 활성 사용자 수
- **Time Remaining**: Sustain 단계에서 남은 시간
- **Room Errors**: 방 생성 실패 건수

## 향후 개선 계획

- [ ] Grafana/Prometheus 메트릭 연동
- [ ] 파일 업로드 시뮬레이션
- [ ] AI 멘션 시뮬레이션
- [ ] 복수 방 시뮬레이션
- [ ] 리액션 및 읽음 처리 시뮬레이션
- [ ] 분산 테스트 지원 (여러 머신에서 동시 실행)

## 라이센스

MIT
