#!/bin/bash

RUN_ID=$1
shift
HOSTS=("$@")

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "$SCRIPT_DIR/config.sh"

# 색상
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ -z "$RUN_ID" ] || [ ${#HOSTS[@]} -eq 0 ]; then
  echo "Usage: $0 <run-id> <host1> <host2> ..."
  exit 1
fi

echo "Monitoring load test progress..."
echo "Run ID: $RUN_ID"
echo ""

# 모니터링 루프
FIRST_RUN=true
while true; do
  if [ "$FIRST_RUN" = false ]; then
    clear
  fi
  FIRST_RUN=false

  echo -e "${YELLOW}=== Load Test Progress ($(date '+%H:%M:%S')) ===${NC}"
  echo ""

  RUNNING=0
  COMPLETED=0
  FAILED=0

  for i in "${!HOSTS[@]}"; do
    HOST="${HOSTS[$i]}"
    NODE_NUM=$((i + 1))

    # 로그 파일 존재 여부 확인
    LOG_EXISTS=$(ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=5 -o BatchMode=yes \
      ${SSH_USER}@${HOST} \
      "[ -f /tmp/loadtest-${RUN_ID}.log ] && echo 'yes' || echo 'no'" 2>/dev/null || echo "no")

    if [ "$LOG_EXISTS" = "no" ]; then
      echo -e "${RED}Node $NODE_NUM ($HOST): NOT STARTED${NC}"
      echo ""
      FAILED=$((FAILED + 1))
      continue
    fi

    # 로그 파일이 최근 10초 이내에 업데이트 되었는지 확인 (프로세스 실행 중 판단)
    LOG_MODIFIED=$(ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o BatchMode=yes \
      ${SSH_USER}@${HOST} \
      "stat -c %Y /tmp/loadtest-${RUN_ID}.log 2>/dev/null" 2>/dev/null || echo "0")
    CURRENT_TIME=$(date +%s)
    TIME_DIFF=$((CURRENT_TIME - LOG_MODIFIED))

    if [ "$TIME_DIFF" -lt 10 ]; then
      # 로그 마지막 줄 가져오기
      LAST_LINE=$(ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o BatchMode=yes \
        ${SSH_USER}@${HOST} \
        "tail -1 /tmp/loadtest-${RUN_ID}.log 2>/dev/null" 2>/dev/null || echo "No log yet")

      # 백프레셔 또는 중단 메시지 확인
      BACKPRESSURE_STATUS=$(ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o BatchMode=yes \
        ${SSH_USER}@${HOST} \
        "tail -20 /tmp/loadtest-${RUN_ID}.log 2>/dev/null | grep -o 'Backpressure #[0-9]*/[0-9]*' | tail -1" 2>/dev/null || echo "")

      if [ -n "$BACKPRESSURE_STATUS" ]; then
        echo -e "${YELLOW}Node $NODE_NUM ($HOST): RUNNING (⚠️ $BACKPRESSURE_STATUS)${NC}"
      else
        echo -e "${GREEN}Node $NODE_NUM ($HOST): RUNNING${NC}"
      fi
      echo "  $(echo $LAST_LINE | cut -c1-100)"
      RUNNING=$((RUNNING + 1))
    else
      # 로그 파일이 10초 이상 업데이트되지 않음 - 프로세스 종료됨
      # 로그에서 완료 또는 중단 메시지 확인
      COMPLETED_CHECK=$(ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o BatchMode=yes \
        ${SSH_USER}@${HOST} \
        "grep -q 'Load test completed\|Ramp-up load test completed' /tmp/loadtest-${RUN_ID}.log 2>/dev/null && echo 'yes' || echo 'no'" 2>/dev/null || echo "no")

      ABORTED_CHECK=$(ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o BatchMode=yes \
        ${SSH_USER}@${HOST} \
        "grep -q 'Test aborted\|Backpressure limit exceeded' /tmp/loadtest-${RUN_ID}.log 2>/dev/null && echo 'yes' || echo 'no'" 2>/dev/null || echo "no")

      if [ "$COMPLETED_CHECK" = "yes" ]; then
        echo -e "${GREEN}Node $NODE_NUM ($HOST): COMPLETED ✓${NC}"
        COMPLETED=$((COMPLETED + 1))
      elif [ "$ABORTED_CHECK" = "yes" ]; then
        echo -e "${RED}Node $NODE_NUM ($HOST): ABORTED ✗ (connection failures)${NC}"
        FAILED=$((FAILED + 1))
      else
        echo -e "${YELLOW}Node $NODE_NUM ($HOST): STOPPED (check logs)${NC}"
        FAILED=$((FAILED + 1))
      fi
    fi
    echo ""
  done

  echo -e "${YELLOW}─────────────────────────────────────${NC}"
  echo -e "Running: ${GREEN}$RUNNING${NC} | Completed: ${GREEN}$COMPLETED${NC} | Failed: ${RED}$FAILED${NC}"
  echo -e "${YELLOW}─────────────────────────────────────${NC}"

  # 모두 완료되면 종료
  if [ $RUNNING -eq 0 ]; then
    if [ $COMPLETED -gt 0 ]; then
      echo ""
      echo -e "${GREEN}All tests completed!${NC}"
    else
      echo ""
      echo -e "${RED}All tests stopped. Check logs for errors.${NC}"
    fi
    break
  fi

  sleep 5
done
