# Chat App Frontend

Next.js 기반의 실시간 채팅 애플리케이션 프론트엔드입니다.

## 기술 스택

- **Framework**: Next.js 15.0.2
- **UI Library**: React 18.3.1
- **Styling**: Tailwind CSS 4.0, Vapor UI Design System
- **Real-time Communication**: Socket.IO Client 4.7.2

## 사전 요구사항

- Node.js 18.x 이상
- npm 또는 yarn

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.example` 파일을 참고하여 `.env.local` 파일을 생성합니다:

```bash
cp .env.example .env.local
```

`.env.local` 파일 내용:

```env
NEXT_PUBLIC_API_URL=http://localhost:5001
NEXT_PUBLIC_SOCKET_URL=http://localhost:5002
```

**환경 변수 설명:**
- `NEXT_PUBLIC_API_URL`: 백엔드 REST API 서버 주소
- `NEXT_PUBLIC_SOCKET_URL`: Socket.IO 서버 주소

서버환경에서 실행시 Route 53 에 등록한 도메인을 입력하세요. 예: `https://chat.goorm-ktb-[번호].goorm.team`

### 3. 개발 서버 실행

```bash
npm run dev
```

개발 서버가 [http://localhost:3000](http://localhost:3000)에서 실행됩니다.

### 4. 프로덕션 빌드

```bash
# 빌드
npm run build

# 프로덕션 서버 실행
npm run start
```

## 빌드 및 배포

### Makefile을 사용한 배포

프로젝트는 `Makefile`을 통해 빌드 및 배포를 자동화합니다.

#### 로컬 빌드

로컬에서 프로덕션 빌드를 생성합니다:

```bash
make build-local
```

이 명령은 다음을 수행합니다:
- `npm run build:production` 실행
- Next.js standalone 빌드 생성

#### 원격 서버 배포

빌드된 애플리케이션을 원격 서버에 배포합니다:

```bash
make deploy
```

**기본 설정:**
- 배포 대상 서버: `ktb-fe01`
- 배포 경로: `/home/ubuntu/ktb-chat-frontend`

**커스텀 배포 설정:**

```bash
# 여러 서버에 동시 배포
make deploy DEPLOY_SERVERS="ktb-fe01 ktb-fe02 ktb-fe03"

# 다른 경로에 배포
make deploy DEPLOY_PATH=/opt/ktb-chat-frontend


## Docker로 실행

### Docker 이미지 빌드

```bash
docker build -t chat-app-frontend .
```

> **참고**: `NEXT_PUBLIC_*` 환경 변수는 빌드 시점에 코드에 인라인됩니다.
> - 로컬 개발: `.env.local` 파일 사용
> - 프로덕션: `.env.production` 파일 사용
>
> 다른 환경 변수를 사용하려면 빌드 전에 `.env.production` 파일을 수정하세요.

### Docker 컨테이너 실행

```bash
docker run -p 3000:3000 chat-app-frontend
```

또는 docker-compose 사용 시:

```bash
docker-compose up
```

## 프로젝트 구조

```
frontend/
├── components/        # 재사용 가능한 React 컴포넌트
│   ├── ChatHeader.js
│   ├── ChatInput.js
│   ├── ChatMessages.js
│   └── ...
├── contexts/          # React Context (전역 상태)
│   └── AuthContext.js
├── hooks/             # 커스텀 React 훅
│   ├── useChatRoom.js
│   ├── useSocketHandling.js
│   └── ...
├── pages/             # Next.js 페이지 (라우팅)
│   ├── chat/
│   │   ├── [room].js  # 동적 채팅방 페이지
│   │   ├── index.js   # 채팅방 목록
│   │   └── new.js     # 새 채팅방 생성
│   ├── index.js       # 로그인 페이지
│   ├── register.js    # 회원가입 페이지
│   └── profile.js     # 프로필 페이지
├── public/            # 정적 파일
│   └── images/
├── services/          # API 및 외부 서비스
│   ├── authService.js
│   ├── fileService.js
│   └── socket.js
├── styles/            # 전역 스타일
│   └── globals.css
└── utils/             # 유틸리티 함수
    └── colorUtils.js
```

## 주요 기능

- **실시간 채팅**: Socket.IO를 통한 실시간 메시지 송수신
- **파일 공유**: 이미지 및 파일 업로드/다운로드
- **이모지 반응**: 메시지에 이모지 반응 추가
- **멘션 기능**: @username으로 사용자 멘션
- **읽음 상태**: 메시지 읽음/안 읽음 표시
- **프로필 관리**: 사용자 프로필 이미지 및 정보 수정
- **채팅방 관리**: 채팅방 생성, 참여, 나가기

## 페이지 라우팅

- `/` - 로그인 페이지
- `/register` - 회원가입
- `/profile` - 사용자 프로필
- `/chat` - 채팅방 목록
- `/chat/new` - 새 채팅방 생성
- `/chat/[room]` - 개별 채팅방 (동적 라우팅)
