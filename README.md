# 실시간 채팅 애플리케이션

이 프로젝트는 실시간 채팅을 위한 웹 애플리케이션으로, Node.js, Next.js, Redis, MongoDB를 활용하여 구현되었습니다.

## 주요 기능

### 인증 및 사용자 관리

- 이메일 기반의 사용자 인증 시스템
- 세션 관리 및 중복 로그인 처리
- 프로필 이미지 업로드 및 관리
- 비밀번호 암호화 및 보안 처리

### 채팅 기능

- 실시간 채팅 (Socket.IO)
- 마크다운 형식 지원
- 이모지 리액션
- 멘션 기능 (@사용자)
- AI 챗봇 연동 (@wayneAI, @consultingAI)
- 메시지 읽음 상태 표시
- 파일 첨부 및 공유 기능

### 채팅방 관리

- 비밀번호 설정 가능한 채팅방 생성
- 참여자 관리
- 실시간 참여자 상태 표시

### 파일 처리

- 이미지, 비디오, 오디오, PDF 등 다양한 파일 형식 지원
- 파일 미리보기 기능
- 안전한 파일 업로드 및 다운로드
- 파일 형식별 크기 제한

## 설치 및 실행 가이드

### 1. 사전 요구사항 설치

```bash
# Node.js 설치 (v18 이상)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# MongoDB 설치 (v7.0)
sudo apt-get install -y mongodb

# Redis 설치
sudo apt-get install -y redis-server

# PM2 전역 설치
npm install -g pm2
```

### 2. 프로젝트 클론 및 패키지 설치

```bash
# 프로젝트 클론
git clone [repository-url]
cd bootcampchat

# 백엔드 패키지 설치
cd backend
npm install

# 프론트엔드 패키지 설치
cd ../frontend
npm install
```

### 3. 환경 변수 설정

#### 로컬 환경 설정

**backend/.env**

```env
MONGO_URI=mongodb://localhost:27017/bootcampchat
JWT_SECRET=your_jwt_secret
REDIS_HOST=localhost
REDIS_PORT=6379
OPENAI_API_KEY=your_openai_key
ENCRYPTION_KEY=your_encryption_key
PASSWORD_SALT=your_password_salt
```

**frontend/.env.local**

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_ENCRYPTION_KEY=your_encryption_key
NEXT_PUBLIC_PASSWORD_SALT=your_password_salt
```

#### goormIDE 환경 설정

**backend/.env**

```env
MONGO_URI=mongodb://0.0.0.0:27017/bootcampchat
JWT_SECRET=your_jwt_secret
REDIS_HOST=0.0.0.0
REDIS_PORT=6379
OPENAI_API_KEY=your_openai_key
ENCRYPTION_KEY=your_encryption_key
PASSWORD_SALT=your_password_salt
NEXT_PUBLIC_API_URL=https://bootcampchat-be.run.goorm.site
```

**frontend/.env.local**

```env
NEXT_PUBLIC_API_URL=https://bootcampchat-be.run.goorm.site
NEXT_PUBLIC_ENCRYPTION_KEY=your_encryption_key
NEXT_PUBLIC_PASSWORD_SALT=your_password_salt
```

#### AWS 환경 설정

**backend/.env**

```env
MONGO_URI=mongodb://your-mongodb-uri
JWT_SECRET=your_jwt_secret
REDIS_HOST=your-redis-host
REDIS_PORT=6379
OPENAI_API_KEY=your_openai_key
ENCRYPTION_KEY=your_encryption_key
PASSWORD_SALT=your_password_salt
NEXT_PUBLIC_API_URL=https://api.your-domain.com
```

**frontend/.env.local**

```env
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_ENCRYPTION_KEY=your_encryption_key
NEXT_PUBLIC_PASSWORD_SALT=your_password_salt
```

### 4. 실행 스크립트 설정 및 실행

```bash
# 실행 스크립트 권한 설정
chmod +x run.sh

# 모든 서비스 시작
./run.sh start

# 서비스 상태 확인
./run.sh status

# 서비스 중지
./run.sh stop

# 서비스 재시작
./run.sh restart
```

## 서비스 접속 방법

### 로컬 환경

```
http://localhost:3000
```

- 로컬 개발 환경에서 실행 시 자동으로 해당 포트로 접속
- 환경 변수 설정: `NEXT_PUBLIC_API_URL=http://localhost:5000`

### goormIDE

1. 상단 메뉴의 "프로젝트" → "실행 URL과 포트" 클릭
2. 자동으로 생성된 URL 확인 (예: `https://chat.goorm-kdt-001.goorm.team`)
3. 터미널에서 실행:
   ```bash
   ./run.sh start
   ```

### AWS 배포

1. EC2 인스턴스의 퍼블릭 IP나 도메인 사용
   ```
   https://your-domain.com
   http://your-ec2-public-ip
   ```
2. EC2 보안그룹 설정:
   - 인바운드 규칙: TCP 3000(프론트엔드), 5000(백엔드) 포트 개방
   - HTTPS 사용 시 443 포트 개방

### 주의사항

1. **로컬 개발 환경**

   - Node.js, MongoDB, Redis가 로컬에 설치되어 있어야 함
   - 방화벽 설정에서 해당 포트 허용 필요

2. **goormIDE**

   - 컨테이너 생성 시 Node.js 템플릿 선택
   - 외부 접속을 위한 포트 설정 필요
   - CORS 설정 확인

3. **AWS 배포**
   - SSL 인증서 설정 권장
   - 로드밸런서 사용 시 웹소켓 설정 필요
   - MongoDB Atlas 사용 권장
   - Redis ElastiCache 고려

## 사용 방법 가이드

### 1. 회원가입 및 로그인

1. 서비스에 접속
2. 회원가입 버튼 클릭
3. 이름, 이메일, 비밀번호 입력하여 계정 생성
4. 생성된 계정으로 로그인

### 2. 프로필 설정

1. 상단 네비게이션 바의 프로필 아이콘 클릭
2. 프로필 설정 메뉴 선택
3. 프로필 이미지 업로드 및 이름 변경 가능
4. 필요시 비밀번호 변경 가능

### 3. 채팅방 생성 및 참여

1. 채팅방 목록에서 '새 채팅방' 버튼 클릭
2. 채팅방 이름 입력 (필수)
3. 필요시 비밀번호 설정 (선택)
4. 채팅방 생성 후 자동으로 입장
5. 기존 채팅방 참여시 비밀번호가 있는 경우 입력 필요

### 4. 채팅 기능 활용

#### 기본 채팅

- 하단 입력창에 메시지 입력 후 Enter 키로 전송
- Shift + Enter로 줄바꿈 가능

#### 마크다운 사용

- **굵게**: `**텍스트**` 또는 Ctrl+B
- _기울임_: `*텍스트*` 또는 Ctrl+I
- 코드 블록: ```언어명 또는 Ctrl+Shift+C
- 링크: `[텍스트](URL)` 또는 Ctrl+K

#### 멘션 기능

- '@' 입력 후 사용자 이름 입력
- AI 챗봇 멘션: @wayneAI 또는 @consultingAI
- 방향키로 멘션할 사용자 선택

#### 파일 공유

1. 클립 아이콘 클릭 또는 파일 드래그 앤 드롭
2. 지원 형식:
   - 이미지: jpg, jpeg, png, gif, webp (최대 10MB)
   - 비디오: mp4, webm, mov (최대 50MB)
   - 오디오: mp3, wav, ogg (최대 20MB)
   - 문서: pdf (최대 20MB)

#### 이모지 및 리액션

- 이모지 버튼 클릭하여 이모지 선택
- 메시지에 마우스 오버 시 리액션 추가 가능

### 5. 채팅방 관리

- 채팅방 참여자 목록 확인
- 이전 메시지 스크롤하여 로드
- 파일 및 미디어 미리보기
- 메시지 읽음 상태 확인

### 6. 보안 및 개인정보

- 주기적인 비밀번호 변경 권장
- 민감한 정보는 파일로 공유하지 않도록 주의
- 로그아웃 시 반드시 '로그아웃' 버튼 사용

### 7. 문제 해결

**채팅이 연결되지 않는 경우**

1. 네트워크 연결 상태 확인
2. 페이지 새로고침
3. 재로그인 시도

**파일 업로드 실패 시**

1. 파일 크기 및 형식 확인
2. 네트워크 상태 확인
3. 페이지 새로고침 후 재시도

**성능 최적화 팁**

- 대용량 파일은 압축하여 업로드
- 오래된 채팅방은 주기적으로 정리
- 불필요한 채팅방은 나가기 처리

## 기술 스택

### 프론트엔드

- Next.js
- React
- Socket.IO Client
- Vapor Components (@goorm-dev/vapor)
- Markdown 렌더링
- 모바일 최적화 UI

### 백엔드

- Node.js
- Express.js
- Socket.IO
- MongoDB & Mongoose
- Redis
- JWT 기반 인증

### 데이터베이스

- MongoDB: 사용자 정보, 채팅방, 메시지 저장
- Redis: 세션 관리, 실시간 상태 관리

### 인프라

- PM2: 프로세스 관리
- Docker 지원
- 환경 변수 기반 설정

123
