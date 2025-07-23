# 백엔드 CI/CD 가이드

이 문서는 백엔드 애플리케이션의 CI/CD 파이프라인 설정 및 사용 방법을 설명합니다.

## 📋 개요

백엔드 CI/CD 파이프라인은 다음 작업을 자동화합니다:
- 코드 품질 검사 (린팅, 테스트)
- Docker 이미지 빌드
- S3에 이미지 업로드
- 빌드 정보 관리

## 🏗️ 아키텍처

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GitHub Push   │ → │  GitHub Actions │ → │   S3 Storage    │
│                 │    │                 │    │                 │
│  main/develop   │    │  1. 테스트      │    │  Docker Images  │
│  backend/**     │    │  2. 빌드        │    │  Build Info     │
│                 │    │  3. 업로드      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 설정 방법

### 1. GitHub Secrets 설정

GitHub 리포지토리의 Settings > Secrets and variables > Actions에서 다음 시크릿을 추가하세요:

#### 필수 AWS 자격증명
```
AWS_ACCESS_KEY_ID        # AWS 액세스 키 ID
AWS_SECRET_ACCESS_KEY    # AWS 시크릿 액세스 키
```

#### AWS IAM 권한 설정
CI/CD가 작동하려면 다음 권한이 필요합니다:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::s3-8-ktb-chat-backend",
                "arn:aws:s3:::s3-8-ktb-chat-backend/*"
            ]
        }
    ]
}
```

### 2. S3 버킷 생성

AWS CLI나 콘솔에서 다음 버킷을 생성하세요:

```bash
# AWS CLI로 버킷 생성
aws s3 mb s3://s3-8-ktb-chat-backend --region ap-northeast-2

# 버킷 버전 관리 활성화 (선택사항)
aws s3api put-bucket-versioning \
    --bucket s3-8-ktb-chat-backend \
    --versioning-configuration Status=Enabled
```

## 🔄 CI 파이프라인 동작

### 트리거 조건
CI 파이프라인은 다음 경우에 실행됩니다:

1. **Push 이벤트**:
   - `main` 또는 `develop` 브랜치
   - `backend/` 폴더 내 파일 변경
   - `.github/workflows/backend-ci.yml` 파일 변경

2. **Pull Request**:
   - `main` 브랜치 대상
   - `backend/` 폴더 내 파일 변경

### 실행 단계

#### 1단계: 테스트 (test job)
```bash
# 의존성 설치
npm ci

# 코드 린팅 (ESLint가 있는 경우)
npm run lint

# 단위 테스트 (test 스크립트가 있는 경우)
npm test
```

#### 2단계: 빌드 및 업로드 (build-and-upload job)
```bash
# Docker 이미지 빌드
docker build --target production \
  --tag ktb-chat-backend:latest \
  --tag ktb-chat-backend:20241201-120000-abc1234 .

# 이미지 테스트 실행
docker run --name test-container -d ktb-chat-backend:latest

# TAR 파일로 저장
docker save ktb-chat-backend:latest | gzip > backend-20241201-120000-abc1234.tar.gz

# S3에 업로드
aws s3 cp backend-20241201-120000-abc1234.tar.gz \
  s3://s3-8-ktb-chat-backend/images/
```

## 📦 결과물

### S3 구조
```
s3://s3-8-ktb-chat-backend/
├── images/
│   ├── backend-latest.tar.gz                    # 최신 이미지 (main 브랜치)
│   ├── backend-20241201-120000-abc1234.tar.gz   # 버전별 이미지
│   └── backend-develop-def5678.tar.gz           # 개발 브랜치 이미지
└── build-info/
    ├── backend-latest.json                      # 최신 빌드 정보
    ├── backend-20241201-120000-abc1234.json     # 버전별 빌드 정보
    └── backend-develop-def5678.json             # 개발 브랜치 빌드 정보
```

### 빌드 정보 예시
```json
{
  "buildTimestamp": "20241201-120000",
  "commitSha": "abc1234567890...",
  "shortSha": "abc1234",
  "branch": "main",
  "tag": "latest",
  "versionTag": "20241201-120000-abc1234",
  "repository": "username/8-ktb-chat",
  "workflow": "Backend CI",
  "runId": "123456789",
  "imageName": "ktb-chat-backend",
  "imageSize": "245760000 bytes"
}
```

## 🔧 Docker 이미지 사용 방법

### 1. S3에서 이미지 다운로드
```bash
# 최신 이미지 다운로드
aws s3 cp s3://s3-8-ktb-chat-backend/images/backend-latest.tar.gz ./

# 특정 버전 다운로드
aws s3 cp s3://s3-8-ktb-chat-backend/images/backend-20241201-120000-abc1234.tar.gz ./
```

### 2. Docker 이미지 로드
```bash
# TAR 파일에서 이미지 로드
docker load < backend-latest.tar.gz

# 이미지 확인
docker images | grep ktb-chat-backend
```

### 3. 컨테이너 실행
```bash
# 환경변수를 포함하여 컨테이너 실행
docker run -d \
  --name ktb-chat-backend \
  -p 5000:5000 \
  -e NODE_ENV=production \
  -e MONGO_URI=mongodb://your-mongo-host:27017/bootcampchat \
  -e JWT_SECRET=your-jwt-secret \
  -e REDIS_HOST=your-redis-host \
  -e REDIS_PORT=6379 \
  -e OPENAI_API_KEY=your-openai-key \
  -e ENCRYPTION_KEY=your-encryption-key \
  -e PASSWORD_SALT=your-password-salt \
  ktb-chat-backend:latest
```

## 🐛 문제 해결

### 일반적인 문제들

#### 1. AWS 자격증명 오류
```
Error: Could not load credentials from any providers
```
**해결책**: GitHub Secrets에 `AWS_ACCESS_KEY_ID`와 `AWS_SECRET_ACCESS_KEY`가 올바르게 설정되었는지 확인

#### 2. S3 버킷 접근 권한 오류
```
AccessDenied: User is not authorized to perform s3:PutObject
```
**해결책**: IAM 사용자에게 S3 버킷 접근 권한이 있는지 확인

#### 3. Docker 빌드 실패
```
ERROR: failed to solve: failed to compute cache key
```
**해결책**: 
- `backend/.dockerignore` 파일 확인
- `backend/package.json` 파일이 존재하는지 확인
- 의존성 설치 중 오류가 없는지 로그 확인

#### 4. 컨테이너 실행 실패
```
Container exited with code 1
```
**해결책**:
- Docker 로그 확인: `docker logs container-name`
- 환경변수가 올바르게 설정되었는지 확인
- 필요한 외부 서비스(MongoDB, Redis)가 실행 중인지 확인

### 디버깅 방법

#### 1. GitHub Actions 로그 확인
- GitHub 리포지토리 > Actions 탭
- 실패한 워크플로우 클릭
- 각 단계별 로그 확인

#### 2. 로컬에서 Docker 빌드 테스트
```bash
cd backend
docker build --target production -t test-backend .
docker run --rm test-backend npm --version
```

#### 3. S3 버킷 내용 확인
```bash
# S3 버킷 리스트 확인
aws s3 ls s3://s3-8-ktb-chat-backend/images/

# 특정 파일 정보 확인
aws s3api head-object \
  --bucket s3-8-ktb-chat-backend \
  --key images/backend-latest.tar.gz
```

## 📈 모니터링 및 알림

### GitHub Actions 상태 배지
README에 다음 배지를 추가할 수 있습니다:

```markdown
![Backend CI](https://github.com/username/8-ktb-chat/workflows/Backend%20CI/badge.svg)
```

### 슬랙 알림 (선택사항)
워크플로우 실패 시 슬랙 알림을 받으려면 다음 단계를 추가하세요:

```yaml
- name: 슬랙 알림
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: failure
    webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## 🔮 다음 단계

1. **CD 파이프라인 구성**: EC2에 자동 배포
2. **프론트엔드 CI 파이프라인**: 별도 워크플로우 생성
3. **환경별 배포**: staging, production 환경 분리
4. **모니터링**: 애플리케이션 상태 모니터링 추가

## 📞 문의

CI/CD 파이프라인 관련 문의사항이 있으시면 이슈를 생성해 주세요. 