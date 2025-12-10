#!/bin/bash
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"
LOADTEST_DIR="$PROJECT_ROOT/loadtest"

source "$SCRIPT_DIR/config.sh"

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 사용법
usage() {
  echo "Usage: $0 <scenario> [options]"
  echo ""
  echo "Examples:"
  echo "  $0 load-test --users=1000 --api-url=https://api.example.com --socket-url=https://socket.example.com"
  echo "  $0 load-test --nodes=3 --users=600 --messages=50"
  echo ""
  echo "Options:"
  echo "  --nodes=N          Number of nodes to use (default: all in hosts.txt)"
  echo "  --skip-deploy      Skip deployment step (use existing files on EC2)"
  echo "  --ssh-key=PATH     SSH key path (default: $SSH_KEY)"
  echo "  --api-url=URL      Target API URL (required)"
  echo "  --socket-url=URL   Target Socket.IO URL (required)"
  echo "  --*                Other options passed to the scenario script"
  echo ""
  echo "Available scenarios:"
  ls -1 "$LOADTEST_DIR" | grep ".js$" | sed 's/.js$//' | sed 's/^/  - /'
  exit 1
}

# 인자 파싱
if [ $# -eq 0 ]; then
  usage
fi

SCENARIO=$1
shift

NODES=""
SKIP_DEPLOY=false
API_URL=""
SOCKET_URL=""
EXTRA_OPTS=()

while [[ $# -gt 0 ]]; do
  case $1 in
    --nodes=*)
      NODES="${1#*=}"
      shift
      ;;
    --skip-deploy)
      SKIP_DEPLOY=true
      shift
      ;;
    --ssh-key=*)
      SSH_KEY="${1#*=}"
      shift
      ;;
    --api-url=*)
      API_URL="${1#*=}"
      shift
      ;;
    --socket-url=*)
      SOCKET_URL="${1#*=}"
      shift
      ;;
    --help)
      usage
      ;;
    --*)
      EXTRA_OPTS+=("$1")
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# 검증
HOSTS_FILE="$SCRIPT_DIR/hosts.txt"

if [ ! -f "$HOSTS_FILE" ]; then
  echo -e "${RED}Error: hosts.txt not found at $HOSTS_FILE${NC}"
  echo "Create EC2 instances with: ./setup-ec2.sh <count>"
  exit 1
fi

if [ ! -f "$SSH_KEY" ]; then
  echo -e "${RED}Error: SSH key not found at $SSH_KEY${NC}"
  echo "Use --ssh-key=PATH to specify the key, or update config.sh"
  exit 1
fi

# hosts.txt에서 IP 읽기 (주석 제외)
HOSTS=($(grep -v '^#' "$HOSTS_FILE" | grep -v '^$'))

if [ ${#HOSTS[@]} -eq 0 ]; then
  echo -e "${RED}Error: No hosts found in $HOSTS_FILE${NC}"
  echo "Add EC2 public IPs to hosts.txt or run: ./setup-ec2.sh <count>"
  exit 1
fi

# 노드 수 제한
if [ -n "$NODES" ]; then
  HOSTS=("${HOSTS[@]:0:$NODES}")
fi

# 스크립트 파일 확인
SCRIPT_FILE="$LOADTEST_DIR/${SCENARIO}.js"
if [ ! -f "$SCRIPT_FILE" ]; then
  echo -e "${RED}Error: Script not found: $SCRIPT_FILE${NC}"
  echo ""
  echo "Available scripts:"
  ls -1 "$LOADTEST_DIR" | grep ".js$"
  exit 1
fi

RUN_ID="$(date +%Y%m%d_%H%M%S)_${SCENARIO}"

# 헤더
echo -e "${BLUE}=========================================="
echo "Distributed Load Test"
echo "==========================================${NC}"
echo "Scenario:     $SCENARIO"
echo "Script:       $SCRIPT_FILE"
echo "Nodes:        ${#HOSTS[@]}"
echo "IPs:          ${HOSTS[@]}"
echo "SSH Key:      $SSH_KEY"
echo "Run ID:       $RUN_ID"
echo "API URL:      ${API_URL:-<not set>}"
echo "Socket URL:   ${SOCKET_URL:-<not set>}"
echo -e "${BLUE}==========================================${NC}"
echo ""

# ============================================
# STEP 1: 배포
# ============================================
if [ "$SKIP_DEPLOY" = false ]; then
  echo -e "${YELLOW}[1/4] 📦 Deploying to ${#HOSTS[@]} nodes...${NC}"
  echo ""

  for HOST in "${HOSTS[@]}"; do
    echo -e "${BLUE}  → Syncing to $HOST...${NC}"

    # rsync로 빠른 동기화
    rsync -az --delete \
      --exclude 'node_modules' \
      --exclude '.git' \
      --exclude 'distributed' \
      --exclude '*.log' \
      --exclude '/tmp' \
      -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10 -o BatchMode=yes" \
      "$LOADTEST_DIR/" \
      ${SSH_USER}@${HOST}:${REMOTE_DIR}/ 2>&1 | sed 's/^/    /' || {
        echo -e "${RED}    ✗ Failed to sync to $HOST${NC}"
        echo -e "${RED}    Check SSH key and connectivity${NC}"
        exit 1
      }

    echo -e "${GREEN}    ✓ Synced to $HOST${NC}"
  done

  echo ""
  echo -e "${YELLOW}  Installing dependencies...${NC}"

  # 병렬로 npm install
  PIDS=()
  for HOST in "${HOSTS[@]}"; do
    (
      ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o BatchMode=yes ${SSH_USER}@${HOST} \
        "cd ${REMOTE_DIR} && npm install --production" > /tmp/npm-${HOST}.log 2>&1
      if [ $? -eq 0 ]; then
        echo -e "${GREEN}    ✓ $HOST - npm install complete${NC}"
      else
        echo -e "${RED}    ✗ $HOST - npm install failed${NC}"
        cat /tmp/npm-${HOST}.log | sed 's/^/      /'
      fi
    ) &
    PIDS+=($!)
  done

  # 모든 npm install 완료 대기
  for PID in "${PIDS[@]}"; do
    wait $PID
  done

  echo ""
  echo -e "${GREEN}  ✅ Deployment complete!${NC}"
  echo ""
else
  echo -e "${YELLOW}[1/4] ⏭️  Skipping deployment (using existing files)${NC}"
  echo ""
fi

# ============================================
# STEP 2: 로드테스트 실행
# ============================================
echo -e "${YELLOW}[2/4] 🚀 Running load test on ${#HOSTS[@]} nodes...${NC}"
echo ""

# 스크립트 옵션 빌드
SCRIPT_OPTS=""
if [ -n "$API_URL" ]; then
  SCRIPT_OPTS="$SCRIPT_OPTS --api-url=$API_URL"
fi
if [ -n "$SOCKET_URL" ]; then
  SCRIPT_OPTS="$SCRIPT_OPTS --socket-url=$SOCKET_URL"
fi
for opt in "${EXTRA_OPTS[@]}"; do
  SCRIPT_OPTS="$SCRIPT_OPTS $opt"
done

# 각 노드에서 백그라운드로 실행
for i in "${!HOSTS[@]}"; do
  HOST="${HOSTS[$i]}"
  NODE_NUM=$((i + 1))

  echo -e "${BLUE}  → Starting on $HOST (node-$NODE_NUM)...${NC}"

  # SSH로 백그라운드 실행 (완전히 detach)
  ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o BatchMode=yes ${SSH_USER}@${HOST} \
    "cd ${REMOTE_DIR} && (nohup node ${SCENARIO}.js ${SCRIPT_OPTS} > /tmp/loadtest-${RUN_ID}.log 2>&1 < /dev/null &) && sleep 1" || {
      echo -e "${RED}    ✗ Failed to start on $HOST${NC}"
    }

  sleep 0.5
done

echo ""
echo -e "${GREEN}  ✅ All nodes started!${NC}"
echo ""

# ============================================
# STEP 3: 모니터링
# ============================================
echo -e "${YELLOW}[3/4] 📊 Monitoring progress...${NC}"
echo "  (Press Ctrl+C to stop monitoring, tests will continue)"
echo ""

bash "$SCRIPT_DIR/monitor.sh" "$RUN_ID" "${HOSTS[@]}"

# ============================================
# STEP 4: 결과 수집
# ============================================
echo ""
echo -e "${YELLOW}[4/4] 📥 Collecting results...${NC}"
echo ""

RESULT_DIR="/tmp/loadtest-results-${RUN_ID}"
mkdir -p "$RESULT_DIR"

for i in "${!HOSTS[@]}"; do
  HOST="${HOSTS[$i]}"
  NODE_NUM=$((i + 1))

  echo -e "${BLUE}  → Downloading from $HOST (node-$NODE_NUM)...${NC}"

  scp -i $SSH_KEY -o StrictHostKeyChecking=no -o BatchMode=yes \
    ${SSH_USER}@${HOST}:/tmp/loadtest-${RUN_ID}.log \
    "$RESULT_DIR/node-${NODE_NUM}.log" 2>&1 | sed 's/^/    /' || {
      echo -e "${RED}    ✗ Failed to download from $HOST${NC}"
      continue
    }

  echo -e "${GREEN}    ✓ Downloaded from $HOST${NC}"
done

echo ""
echo -e "${YELLOW}  Aggregating results...${NC}"

# Python 스크립트로 결과 집계
if command -v python3 &> /dev/null; then
  python3 "$SCRIPT_DIR/collect.py" "$RESULT_DIR" > "$RESULT_DIR/summary.txt" 2>/dev/null || {
    echo -e "${YELLOW}  Note: Could not aggregate results (collect.py failed)${NC}"
  }

  if [ -f "$RESULT_DIR/summary.txt" ]; then
    echo ""
    cat "$RESULT_DIR/summary.txt"
  fi
else
  echo -e "${YELLOW}  Note: Python3 not found, skipping aggregation${NC}"
  echo "  Total nodes: ${#HOSTS[@]}"
  echo "  Result files:"
  ls -lh "$RESULT_DIR"
fi

# 결과 요약
echo ""
echo -e "${GREEN}=========================================="
echo "✅ Test completed!"
echo "==========================================${NC}"
echo "Run ID:       $RUN_ID"
echo "Results dir:  $RESULT_DIR"
echo ""
echo "View individual logs:"
for i in "${!HOSTS[@]}"; do
  NODE_NUM=$((i + 1))
  if [ -f "$RESULT_DIR/node-${NODE_NUM}.log" ]; then
    echo "  Node $NODE_NUM: cat $RESULT_DIR/node-${NODE_NUM}.log"
  fi
done
echo -e "${GREEN}==========================================${NC}"