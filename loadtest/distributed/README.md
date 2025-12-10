# Distributed Load Testing with SSH/rsync

다수의 EC2 인스턴스에서 로드테스트를 분산 실행하는 도구입니다.

## 특징

- ✅ **간단한 설정**: AWS CLI만으로 EC2 생성
- ✅ **빠른 배포**: rsync로 변경된 파일만 동기화
- ✅ **실시간 모니터링**: 각 노드의 진행 상황 확인
- ✅ **자동 집계**: 모든 노드의 결과를 자동으로 합산
- ✅ **SSH 기반**: IAM 권한 최소화, 전통적인 도구 사용

## 사전 요구사항

### 로컬 환경 (맥북)

- AWS CLI 설치 및 설정
- SSH 키 페어 (EC2 접근용)
- Python 3 (결과 집계용, 선택사항)

### AWS

- EC2 인스턴스 생성 권한
- SSH 키 페어 (이미 생성되어 있어야 함)
- Security Group (SSH 포트 22 허용)

## 디렉토리 구조

```
distributed/
├── config.sh           # 설정 (SSH 키, AWS 리전 등)
├── hosts.txt           # EC2 IP 목록 (자동 생성됨)
│
├── setup-ec2.sh        # EC2 인스턴스 생성
├── update-hosts.sh     # hosts.txt 업데이트
├── manage-ec2.sh       # 인스턴스 관리 (start/stop/terminate)
│
├── run.sh              # 메인 실행 스크립트 ⭐
├── deploy.sh           # 배포만 실행
├── monitor.sh          # 모니터링
├── exec.sh             # 유틸리티 (모든 노드에서 명령 실행)
└── collect.py          # 결과 집계
```

## 빠른 시작

### 1. 설정 파일 수정

```bash
cd loadtest/distributed
vim config.sh
```

다음 항목 확인:
- `SSH_KEY`: SSH 키 파일 경로 (예: `~/.ssh/loadtest-key.pem`)
- `DEFAULT_KEY_NAME`: AWS에 등록된 키 이름 (예: `loadtest-key`)
- `AWS_REGION`: 리전 (기본: `ap-northeast-2`)

### 2. EC2 인스턴스 생성

```bash
# 5대의 t3.medium 인스턴스 생성
./setup-ec2.sh 5 t3.medium loadtest-key

# 또는 보안 그룹 지정
./setup-ec2.sh 5 t3.medium loadtest-key my-security-group
```

**참고:**
- 보안 그룹을 지정하지 않으면 SSH(22) 포트가 열린 기존 보안 그룹을 자동으로 찾습니다
- `hosts.txt`가 자동으로 생성됩니다

### 3. 초기 설정 완료 대기

```bash
# 1분 정도 대기 (User Data 스크립트 실행 완료)
sleep 60

# 설정 확인
./exec.sh 'cat /tmp/setup-done'
```

### 4. 로드테스트 실행

```bash
./run.sh load-test \
  --users=1000 \
  --messages=50 \
  --api-url=https://api.example.com \
  --socket-url=https://socket.example.com
```

## 사용 방법

### EC2 관리

```bash
# 인스턴스 목록 확인
./manage-ec2.sh list

# 인스턴스 중지 (비용 절약)
./manage-ec2.sh stop

# 인스턴스 시작
./manage-ec2.sh start
# → hosts.txt가 자동으로 업데이트됨 (Public IP 변경 반영)

# 인스턴스 완전 삭제
./manage-ec2.sh terminate
```

### 로드테스트 실행

#### 기본 실행

```bash
./run.sh load-test \
  --users=1000 \
  --api-url=https://api.example.com \
  --socket-url=https://socket.example.com
```

#### 노드 수 지정

```bash
# 3개 노드만 사용
./run.sh load-test \
  --nodes=3 \
  --users=600 \
  --api-url=https://api.example.com
```

#### 배포 스킵 (빠른 재실행)

```bash
# 첫 실행: 배포 + 실행
./run.sh load-test --users=100 --api-url=https://api.example.com

# 옵션만 바꿔서 재실행 (배포 스킵)
./run.sh load-test --users=200 --skip-deploy --api-url=https://api.example.com
./run.sh load-test --users=500 --skip-deploy --api-url=https://api.example.com
```

#### 추가 옵션

```bash
./run.sh load-test \
  --users=1000 \
  --messages=100 \
  --batch-size=20 \
  --batch-delay=500 \
  --api-url=https://api.example.com \
  --socket-url=https://socket.example.com
```

### 배포만 실행

```bash
# 모든 노드에 배포
./deploy.sh

# 특정 개수 노드만
./deploy.sh 3
```

### 유틸리티

```bash
# 모든 노드에서 명령 실행
./exec.sh 'uptime'
./exec.sh 'node --version'
./exec.sh 'df -h'
./exec.sh 'free -m'

# 특정 로그 확인
./exec.sh 'tail -20 /tmp/loadtest-*.log'
```

## 개발 워크플로우

### 시나리오 1: 스크립트 수정 후 테스트

```bash
# 1. 맥북에서 스크립트 수정
vim ../load-test.js

# 2. 로컬 테스트 (선택)
node ../load-test.js --users=5 --api-url=http://localhost:5001

# 3. 분산 테스트
./run.sh load-test --users=1000 --api-url=https://api.example.com
```

### 시나리오 2: 여러 옵션 빠르게 테스트

```bash
# 한 번만 배포
./deploy.sh

# 여러 설정으로 연속 테스트
./run.sh load-test --skip-deploy --users=100 --api-url=https://api.example.com
./run.sh load-test --skip-deploy --users=500 --api-url=https://api.example.com
./run.sh load-test --skip-deploy --users=1000 --api-url=https://api.example.com
```

### 시나리오 3: 사용 후 리소스 정리

```bash
# 일시 중지 (나중에 다시 사용)
./manage-ec2.sh stop

# 다음에 다시 시작
./manage-ec2.sh start

# 완전 삭제 (더 이상 사용 안 함)
./manage-ec2.sh terminate
```

## 결과 확인

로드테스트가 완료되면 `/tmp/loadtest-results-<RUN_ID>/` 디렉토리에 결과가 저장됩니다.

```
/tmp/loadtest-results-20241120_143000/
├── node-1.log          # 노드 1 로그
├── node-2.log          # 노드 2 로그
├── node-3.log          # 노드 3 로그
├── node-4.log          # 노드 4 로그
├── node-5.log          # 노드 5 로그
└── summary.txt         # 집계 결과
```

### 집계 결과 보기

```bash
cat /tmp/loadtest-results-20241120_143000/summary.txt
```

### 개별 노드 로그 보기

```bash
# 노드 1 로그
cat /tmp/loadtest-results-20241120_143000/node-1.log

# 로그에서 에러만 검색
grep -i error /tmp/loadtest-results-20241120_143000/node-*.log
```

## 트러블슈팅

### SSH 접속 안 됨

```bash
# 1. SSH 키 권한 확인
ls -l ~/.ssh/loadtest-key.pem
# -r-------- 여야 함

chmod 400 ~/.ssh/loadtest-key.pem

# 2. 수동 접속 테스트
ssh -i ~/.ssh/loadtest-key.pem ec2-user@<IP>

# 3. Security Group 확인
# AWS 콘솔 → EC2 → Security Groups
# Inbound rules에 SSH (22) 있는지 확인
```

### hosts.txt가 비어있음

```bash
# EC2 인스턴스 확인
./manage-ec2.sh list

# 실행 중인 인스턴스가 있으면
./update-hosts.sh

# 없으면 새로 생성
./setup-ec2.sh 5
```

### 배포가 느림

```bash
# rsync는 첫 배포가 느리고, 2번째부터는 변경된 파일만 전송
# node_modules가 제외되는지 확인:
cat deploy.sh | grep exclude

# 수동으로 빠르게 배포하려면
./exec.sh 'rm -rf /opt/loadtest/node_modules'
./deploy.sh
```

### Python3 없음 (결과 집계 안 됨)

```bash
# Python 설치 (맥북)
brew install python3

# 또는 수동으로 로그 확인
ls -lh /tmp/loadtest-results-*/
cat /tmp/loadtest-results-*/node-*.log
```

### 로드테스트 프로세스가 죽음

```bash
# 노드에서 로그 확인
./exec.sh 'tail -50 /tmp/loadtest-*.log'

# 일반적인 원인:
# - 메모리 부족: 인스턴스 타입 업그레이드 (t3.large 등)
# - 네트워크 문제: 타겟 서버 URL 확인
# - 스크립트 에러: 로컬에서 먼저 테스트
```

## 비용 관리

### EC2 비용 (ap-northeast-2 기준)

| Instance Type | vCPU | RAM | 시간당 | 5대 × 1시간 |
|---------------|------|-----|--------|-------------|
| t3.micro      | 2    | 1GB | $0.0132| $0.07       |
| t3.small      | 2    | 2GB | $0.0264| $0.13       |
| t3.medium     | 2    | 4GB | $0.0528| $0.26       |
| t3.large      | 2    | 8GB | $0.1056| $0.53       |

### 비용 절감 팁

1. **사용 후 중지**
   ```bash
   ./manage-ec2.sh stop
   ```

2. **테스트 후 삭제**
   ```bash
   ./manage-ec2.sh terminate
   ```

3. **적절한 인스턴스 타입 선택**
   - 소규모 테스트: t3.micro
   - 중규모 테스트: t3.medium
   - 대규모 테스트: t3.large

## 고급 사용

### SSH Config 활용

`~/.ssh/config`에 설정 추가:

```
Host loadtest-*
  User ec2-user
  IdentityFile ~/.ssh/loadtest-key.pem
  StrictHostKeyChecking no
```

그러면 더 간단하게:
```bash
ssh loadtest-node-1  # IP 대신 이름으로
```

### Elastic IP 사용

Public IP가 계속 바뀌는 게 불편하면:

1. AWS 콘솔 → EC2 → Elastic IPs
2. "Allocate Elastic IP address" 클릭
3. 각 인스턴스에 Associate
4. `hosts.txt`에 Elastic IP 입력

장점: 인스턴스 재시작해도 IP 유지

### 여러 시나리오 연속 실행

```bash
# 배포 한 번
./deploy.sh

# 여러 시나리오 자동 실행
for users in 100 500 1000 2000; do
  echo "Testing with $users users..."
  ./run.sh load-test \
    --skip-deploy \
    --users=$users \
    --api-url=https://api.example.com
  sleep 60  # 시나리오 간 1분 대기
done
```

## 문의 및 기여

문제가 발생하면 GitHub Issues에 등록해주세요.
