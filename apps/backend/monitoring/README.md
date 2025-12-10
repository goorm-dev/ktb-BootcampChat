# Monitoring Stack

> **Last Updated**: 2025-11-25

이 디렉토리는 KTB Chat Backend 애플리케이션의 모니터링을 위한 Prometheus와 Grafana 설정을 포함합니다.

## 구성 요소

### Prometheus (v3.1.0)
- 메트릭 수집 및 저장
- 포트: 9090
- 데이터 보관 기간: 30일
- 다음 소스에서 메트릭 수집:
  - Spring Boot Actuator (`/actuator/prometheus`)
  - MongoDB Exporter (포트 9216)
  - Redis Exporter (포트 9121)
  - Node Exporter (포트 9100) - 서버 리소스 모니터링

### Grafana (v11.4.0)
- 메트릭 시각화 및 대시보드
- 포트: 3000
- 기본 계정: admin / admin
- 자동 프로비저닝된 대시보드 및 데이터소스

### MongoDB Exporter (v0.42.0)
- MongoDB 메트릭 수집
- 포트: 9216
- 연결, 작업, 메모리, 락 상태 모니터링

### Redis Exporter (v1.66.0)
- Redis 메트릭 수집
- 포트: 9121
- 메모리, 키, 명령어, 캐시 히트율 모니터링

### Node Exporter (v1.8.2)
- 서버 하드웨어 및 OS 메트릭 수집
- 포트: 9100
- CPU, 메모리, 디스크, 네트워크 사용량 모니터링
- File-based Service Discovery로 동적 타겟 관리

## 시작하기

### 1. Makefile 명령어로 실행 (권장)

```bash
# 모니터링 스택 시작
make o11y-up

# 모니터링 스택 종료
make o11y-down

# 로그 확인
make o11y-logs

# 재시작
make o11y-restart

# 서버에 배포
make deploy-o11y
```

### 2. Docker Compose로 직접 실행

```bash
# 로컬 환경
cd ~/workspace/ktb-chat/apps/backend
docker-compose -f docker-compose.o11y.yaml up -d

# 서버 환경
cd ~/ktb-chat/apps/backend
docker-compose -f docker-compose.o11y.yaml up -d
```

### 3. 서비스 확인

**웹 인터페이스**:
- Prometheus UI: http://localhost:9090
- Grafana UI: http://localhost:3000
- Spring Boot Actuator: http://localhost:5001/actuator
- Prometheus Metrics: http://localhost:5001/actuator/prometheus

**타겟 상태 확인**:
- Prometheus Targets: http://localhost:9090/targets
- Grafana Datasources: http://localhost:3000/connections/datasources

### 4. Grafana 대시보드

Grafana에 로그인하면 자동으로 프로비저닝된 대시보드를 확인할 수 있습니다. 상황에 따라 적합한 대시보드를 선택하세요:

## 배포 시 주의사항

- **보안**: Grafana 기본 비밀번호를 반드시 변경하세요 (기본값: admin/admin)
- **네트워크**: EC2 보안 그룹에서 포트 9090(Prometheus), 3000(Grafana) 개방 확인
- **백업**: Prometheus 데이터는 `prometheus_data` 볼륨에 저장되므로 정기 백업 권장

## Node Exporter 타겟 관리

### File-based Service Discovery

Node Exporter는 파일 기반 서비스 디스커버리를 사용하여 동적으로 타겟을 관리합니다.
**장점**: 파일만 수정하면 자동으로 반영되며 Prometheus 재시작이 불필요합니다 (30초마다 자동 리로드).

### 타겟 파일 구조

```
monitoring/prometheus/targets/
└── node-exporters.prod.yml  # 프로덕션 환경 (실제 서버 IP)
```

**참고**: 개발 환경에서는 별도의 Node Exporter 타겟 파일이 필요하지 않습니다. 로컬에서는 Spring Boot 애플리케이션 메트릭만 수집합니다.

### 새 서버 추가하기

1. **타겟 파일 편집**

```bash
# 로컬에서 편집
vi monitoring/prometheus/targets/node-exporters.prod.yml

# 서버에서 편집
ssh ktb-o11y
vi ~/ktb-chat/apps/backend/monitoring/prometheus/targets/node-exporters.prod.yml
```

2. **새 타겟 추가**

```yaml
# Backend Cluster
- targets:
    - '10.0.1.10:9100'  # ktb-be01
    - '10.0.1.11:9100'  # ktb-be02
    - '10.0.1.12:9100'  # ktb-be03
    - '10.0.1.13:9100'  # ktb-be04 <- 새로 추가
  labels:
    environment: 'production'
    region: 'ap-northeast-2'
    cluster: 'backend'
    service: 'api'
```

3. **저장하면 30초 이내 자동 반영** (Prometheus 재시작 불필요!)

### 서버 그룹별 관리

역할별로 그룹을 나누어 관리할 수 있습니다:

```yaml
# Backend Cluster
- targets:
    - '10.0.1.10:9100'
    - '10.0.1.11:9100'
  labels:
    cluster: 'backend'
    service: 'api'

# Database Cluster
- targets:
    - '10.0.2.10:9100'
  labels:
    cluster: 'database'
    service: 'mongodb'

# Cache Cluster
- targets:
    - '10.0.3.10:9100'
  labels:
    cluster: 'cache'
    service: 'redis'
```

### 타겟 확인하기

Prometheus UI에서 타겟 상태를 확인할 수 있습니다:

1. http://localhost:9090/targets 접속
2. `node-exporter` job 섹션에서 모든 타겟 확인
3. 상태가 `UP`이면 정상, `DOWN`이면 연결 불가

### 배포 워크플로우

```bash
# 1. 로컬에서 타겟 파일 수정
vi monitoring/prometheus/targets/node-exporters.prod.yml

# 2. Git 커밋 및 푸시
git add monitoring/prometheus/targets/
git commit -m "feat: Add new backend server to monitoring"
git push

# 3. 서버에서 Git pull 및 재시작
ssh ktb-o11y
cd ~/ktb-chat
git pull

# 4. 모니터링 스택 재시작 (Makefile 사용)
cd apps/backend
make o11y-restart

# Prometheus가 자동으로 새 타겟 감지 (30초 이내)
```

### 라벨 활용하기

라벨을 사용하여 Grafana에서 필터링할 수 있습니다:

```yaml
- targets:
    - '10.0.1.10:9100'
  labels:
    environment: 'production'   # 환경 구분
    region: 'ap-northeast-2'    # 리전
    cluster: 'backend'          # 클러스터
    service: 'api'              # 서비스 타입
    team: 'platform'            # 담당 팀
    tier: 'critical'            # 중요도
```

Grafana 쿼리 예시:
```promql
# Backend 클러스터의 CPU 사용률
node_cpu_seconds_total{cluster="backend"}

# Critical tier 서버만 조회
node_memory_MemAvailable_bytes{tier="critical"}

# 특정 팀 담당 서버
up{team="platform"}
```

## 디렉토리 구조

```
monitoring/
├── README.md                    # 이 문서
├── prometheus/
│   ├── prometheus.dev.yml       # 개발 환경 Prometheus 설정
│   ├── prometheus.prod.yml      # 프로덕션 환경 Prometheus 설정
│   ├── rules.yml                # 알림 규칙
│   └── targets/
│       └── node-exporters.prod.yml  # Node Exporter 타겟 (프로덕션)
└── grafana/
    └── provisioning/
        ├── datasources/
        │   ├── prometheus.dev.yml   # 개발 환경 데이터소스
        │   └── prometheus.prod.yml  # 프로덕션 환경 데이터소스
        └── dashboards/
            ├── dashboard.yml        # 대시보드 프로비저닝 설정
            └── *.json               # 대시보드 정의 파일들
```


## 메트릭 엔드포인트

Spring Boot Actuator가 제공하는 주요 엔드포인트:

- `/actuator/health` - 애플리케이션 상태
- `/actuator/info` - 애플리케이션 정보
- `/actuator/metrics` - 사용 가능한 메트릭 목록
- `/actuator/prometheus` - Prometheus 형식의 메트릭

## 커스터마이징

### Prometheus 스크랩 간격 변경

`prometheus/prometheus.yml` 파일에서 `scrape_interval`을 수정하세요.

### 새로운 대시보드 추가

`grafana/provisioning/dashboards/` 디렉토리에 JSON 형식의 대시보드 파일을 추가하면 자동으로 프로비저닝됩니다.

### Grafana 관리자 비밀번호 변경

`docker-compose.o11y.yaml` 파일에서 Grafana 서비스의 환경 변수를 수정하세요:

```yaml
environment:
  - GF_SECURITY_ADMIN_PASSWORD=새로운_비밀번호
```

## 문제 해결

### Prometheus가 Spring Boot 앱에서 메트릭을 수집하지 못하는 경우

1. Spring Boot 애플리케이션이 실행 중인지 확인
2. `http://localhost:5001/actuator/prometheus`에서 메트릭이 노출되는지 확인
3. Docker 네트워크 설정 확인 (host.docker.internal)

### Grafana 대시보드가 표시되지 않는 경우

1. Grafana 로그 확인: `docker logs grafana-ktb`
2. 데이터소스가 올바르게 설정되었는지 확인
3. Prometheus에서 데이터가 수집되고 있는지 확인

## 데이터 볼륨

메트릭 데이터는 Docker 볼륨에 영구 저장됩니다:

- `prometheus_data` - Prometheus 시계열 데이터
- `grafana_data` - Grafana 설정 및 대시보드

볼륨 삭제 시 모든 데이터가 손실됩니다:
```bash
docker-compose down -v
```
