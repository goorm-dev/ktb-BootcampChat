#!/bin/bash

# 색상 코드 정의
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# PID 파일과 리포트 디렉토리 경로 설정
PID_FILE="/tmp/playwright-report.pid"
REPORT_DIR="playwright-report"
COMBINED_REPORT_DIR="combined-report"
TEST_RESULTS_DIR="test-results"

# 중단 처리를 위한 변수들
CURRENT_BROWSER=""
CURRENT_TIMESTAMP=""
INTERRUPTED=0

# 브라우저 타입 정의
declare -A BROWSERS=(
  ["chromium"]="Chromium"
  ["firefox"]="Firefox"
  ["webkit"]="WebKit (Safari)"
  ["all"]="모든 브라우저"
)

# 테스트 모듈 및 시나리오 정의
declare -A TEST_MODULES=(
  ["인증"]="auth/auth.spec.ts"
  ["프로필"]="profile/profile.spec.ts"
  ["채팅방"]="chatrooms/chatrooms.spec.ts"
  ["메시징"]="messaging/messaging.spec.ts"
  ["고급 메시징"]="messaging/advanced-messaging.spec.ts"
  ["이미지"]="files/image-upload.spec.ts"
  ["PDF"]="files/pdf-upload.spec.ts"
  ["비디오"]="files/video-upload.spec.ts"
  ["AI 기본"]="ai/ai.spec.ts"
  ["AI 대화"]="ai/ai-conversation.spec.ts"
  ["AI 논쟁"]="debate/debate.spec.ts"
  ["실시간"]="realtime/realtime.spec.ts"
  ["실시간 상태"]="realtime/presence.spec.ts"
  ["에러처리"]="error/error-handling.spec.ts"
  ["부하테스트"]="load/load-testing.spec.ts"
)

# 테스트 결과와 리포트 저장을 위한 배열
declare -A test_results
declare -A test_summaries
declare -A browser_reports

# 임시 디렉토리 정리 함수
cleanup_reports() {
  echo -e "\n${BLUE}임시 리포트 파일 정리 중...${NC}"
  find . -maxdepth 1 -type d -name "playwright-report*" -exec rm -rf {} +
  rm -rf "$TEST_RESULTS_DIR"
  echo -e "${GREEN}정리 완료${NC}"
}

# 중단 처리 함수
cleanup() {
  if [ $INTERRUPTED -eq 0 ]; then
    INTERRUPTED=1
    echo -e "\n${YELLOW}테스트가 중단되었습니다. 지금까지의 결과를 저장합니다...${NC}"
    
    if [ -n "$CURRENT_BROWSER" ] && [ -n "$CURRENT_TIMESTAMP" ]; then
      generate_combined_report "$CURRENT_TIMESTAMP"
      cleanup_reports
      start_report_server
    fi
    
    exit 1
  fi
}

# 중단 신호 처리 설정
trap cleanup SIGINT SIGTERM

# 브라우저 선택 메뉴 표시 함수
show_browser_menu() {
  echo -e "\n${BLUE}사용할 브라우저를 선택하세요:${NC}"
  local count=1
  for browser in "${!BROWSERS[@]}"; do
    echo -e "${count}) ${browser} - ${BROWSERS[$browser]}"
    ((count++))
  done
  read -p "선택 (기본: chromium): " selection
  
  case "$selection" in
    2) echo "firefox" ;;
    3) echo "webkit" ;;
    4) echo "all" ;;
    *) echo "chromium" ;;
  esac
}

# 테스트 실행 함수
run_tests() {
  local selected_browser="$1"
  CURRENT_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  START_TIME=$(date +%s)
  local test_exit_code=0
  local failed_tests=()

  mkdir -p "$COMBINED_REPORT_DIR/data"
  mkdir -p "$TEST_RESULTS_DIR"
  
  echo -e "${BLUE}=== BootcampChat E2E 테스트 시작 ===${NC}"

  if [ "$selected_browser" = "all" ]; then
    local browsers=("chromium" "firefox" "webkit")
  else
    local browsers=("$selected_browser")
  fi

  # 의존성 설치
  echo -e "\n${BLUE}1. 의존성 설치 중...${NC}"
  if npm install; then
    echo -e "${GREEN}✓ 의존성 설치 완료${NC}"
  else
    echo -e "${RED}✗ 의존성 설치 실패${NC}"
    exit 1
  fi

  # Playwright 브라우저 설치
  echo -e "\n${BLUE}2. Playwright 브라우저 설치 중...${NC}"
  if npx playwright install; then
    echo -e "${GREEN}✓ 브라우저 설치 완료${NC}"
  else
    echo -e "${RED}✗ 브라우저 설치 실패${NC}"
    exit 1
  fi

  # 실행 중인 리포트 서버 종료
  stop_report_server

  # 브라우저별 테스트 실행
  for browser in "${browsers[@]}"; do
    CURRENT_BROWSER=$browser
    echo -e "\n${BLUE}브라우저 [${BROWSERS[$browser]}] 테스트 시작${NC}"
    
    # 브라우저별 결과/리포트 디렉토리 설정
    local browser_results_dir="${TEST_RESULTS_DIR}/${browser}_${CURRENT_TIMESTAMP}"
    local browser_report_dir="${REPORT_DIR}_${browser}_${CURRENT_TIMESTAMP}"
    browser_reports[$browser]=$browser_report_dir
    mkdir -p "$browser_results_dir" "$browser_report_dir"

    # 모든 테스트 파일을 하나의 배열로 준비
    local test_files=()
    for module_name in "${!TEST_MODULES[@]}"; do
      test_files+=("test/${TEST_MODULES[$module_name]}")
    done

    # 모든 테스트를 한 번의 명령어로 실행
    echo -e "\n${YELLOW}테스트 실행 중... (${#test_files[@]} 개의 테스트)${NC}"
    if ! npx playwright test "${test_files[@]}" \
        --project=$browser \
        --reporter=list,html; then
      echo -e "${RED}✗ 일부 테스트가 실패했습니다${NC}"
      test_results[$browser]=0
      test_exit_code=1
    else
      echo -e "${GREEN}✓ 모든 테스트가 성공했습니다${NC}"
      test_results[$browser]=${#test_files[@]}
    fi

    # 테스트 결과 저장
    if [ -d "$REPORT_DIR" ]; then
      cp -r "$REPORT_DIR"/* "$browser_report_dir/"
    fi

    # 브라우저별 테스트 요약 생성
    local total_tests=${#test_files[@]}
    local passed_tests=${test_results[$browser]}
    local failed_count=$((total_tests - passed_tests))
    test_summaries[$browser]="총 테스트: $total_tests, 성공: $passed_tests, 실패: $failed_count"

    # 테스트 결과 생성
    generate_combined_report "$CURRENT_TIMESTAMP"
  done

  # 최종 결과 출력
  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))
  
  echo -e "\n${BLUE}=== 테스트 실행 완료 ===${NC}"
  echo -e "총 소요 시간: ${DURATION}초"

  # 브라우저별 결과 출력
  for browser in "${!test_summaries[@]}"; do
    echo -e "\n${BROWSERS[$browser]} 결과:"
    echo -e "${test_summaries[$browser]}"
  done

  if [ ${#failed_tests[@]} -gt 0 ]; then
    echo -e "\n${RED}실패한 테스트 목록:${NC}"
    for failed_test in "${failed_tests[@]}"; do
      echo -e "${RED}- ${failed_test}${NC}"
    done
  fi

  cleanup_reports
  start_report_server

  return $test_exit_code
}

# 통합 리포트 생성 함수
generate_combined_report() {
  local timestamp=$1
  echo -e "\n${BLUE}통합 리포트 생성 중...${NC}"

  if [ -d "$COMBINED_REPORT_DIR" ]; then
    mv "$COMBINED_REPORT_DIR" "${COMBINED_REPORT_DIR}_backup"
  fi

  mkdir -p "$COMBINED_REPORT_DIR/data"

  # 브라우저별 결과 통합
  for browser in "${!browser_reports[@]}"; do
    local browser_dir="${browser_reports[$browser]}"
    if [ -d "$browser_dir" ]; then
      find "$browser_dir" -type f -not -name "index.html" -exec cp {} "$COMBINED_REPORT_DIR/data/" \;
      
      local browser_results_dir="${TEST_RESULTS_DIR}/${browser}_${timestamp}"
      if [ -d "$browser_results_dir" ]; then
        find "$browser_results_dir" -type f -not -name "index.html" -exec cp {} "$COMBINED_REPORT_DIR/data/" \;
      fi
    fi
  done

  if [ -d "$REPORT_DIR" ]; then
    cp "$REPORT_DIR/index.html" "$COMBINED_REPORT_DIR/"
  fi

  # 테스트 요약 생성
  {
    echo "# BootcampChat E2E 테스트 결과"
    echo "## 실행 시간: $(date '+%Y-%m-%d %H:%M:%S')"
    if [ $INTERRUPTED -eq 1 ]; then
      echo "## ⚠️ 테스트가 중단되었습니다"
    fi
    
    echo -e "\n## 브라우저별 결과"
    for browser in "${!test_summaries[@]}"; do
      echo "### ${BROWSERS[$browser]}"
      echo "${test_summaries[$browser]}"
    done
    
    if [ ${#failed_tests[@]} -gt 0 ]; then
      echo -e "\n## 실패한 테스트"
      for failed_test in "${failed_tests[@]}"; do
        echo "- ${failed_test}"
      done
    fi
  } > "$COMBINED_REPORT_DIR/summary.md"

  echo -e "${GREEN}통합 리포트 생성 완료${NC}"

  if [ -d "${COMBINED_REPORT_DIR}_backup" ]; then
    rm -rf "${COMBINED_REPORT_DIR}_backup"
  fi
}

# 리포트 서버 시작 함수
start_report_server() {
  if [ -f "$PID_FILE" ]; then
    pid=$(cat "$PID_FILE")
    if ps -p $pid > /dev/null 2>&1; then
      echo -e "${RED}리포트 서버가 이미 실행 중입니다 (PID: $pid)${NC}"
      echo -e "${BLUE}http://0.0.0.0:9323 에서 확인할 수 있습니다${NC}"
      return 1
    else
      rm "$PID_FILE"
    fi
  fi

  if [ ! -d "$COMBINED_REPORT_DIR" ]; then
    echo -e "${RED}리포트 디렉토리가 존재하지 않습니다${NC}"
    return 1
  fi

  echo -e "${BLUE}테스트 리포트 서버를 시작합니다...${NC}"
  npx playwright show-report "$COMBINED_REPORT_DIR" --host 0.0.0.0 --port 9323 > /dev/null 2>&1 &
  echo $! > "$PID_FILE"
  echo -e "${GREEN}리포트 서버가 시작되었습니다 (PID: $(cat $PID_FILE))${NC}"
  echo -e "${BLUE}리포트는 http://0.0.0.0:9323 에서 확인할 수 있습니다${NC}"
}

# 리포트 서버 중지 함수
stop_report_server() {
  if [ -f "$PID_FILE" ]; then
    pid=$(cat "$PID_FILE")
    if ps -p $pid > /dev/null 2>&1; then
      kill $pid
      rm "$PID_FILE"
      echo -e "${GREEN}리포트 서버가 중지되었습니다 (PID: $pid)${NC}"
    else
      echo -e "${RED}리포트 서버가 실행중이지 않습니다${NC}"
      rm "$PID_FILE"
    fi
  else
    echo -e "${RED}리포트 서버가 실행중이지 않습니다${NC}"
  fi
}

# 리포트 서버 상태 확인 함수
status_report_server() {
  if [ -f "$PID_FILE" ]; then
    pid=$(cat "$PID_FILE")
    if ps -p $pid > /dev/null 2>&1; then
      echo -e "${GREEN}리포트 서버가 실행 중입니다 (PID: $pid)${NC}"
      echo -e "${BLUE}http://0.0.0.0:9323 에서 확인할 수 있습니다${NC}"
    else
      echo -e "${RED}리포트 서버가 실행중이지 않습니다${NC}"
      rm "$PID_FILE"
    fi
  else
    echo -e "${RED}리포트 서버가 실행중이지 않습니다${NC}"
  fi
}

# 사용법 출력 함수
show_usage() {
  echo "Usage: $0 {start [browser]|report [start|stop|status]}"
  echo "Commands:"
  echo "  start [browser]     테스트를 실행합니다"
  echo "    browser options:  chromium (기본값), firefox, webkit, all"
  echo "  report start        테스트 리포트 서버를 시작합니다"
  echo "  report stop         테스트 리포트 서버를 중지합니다"
  echo "  report status       테스트 리포트 서버 상태를 확인합니다"
  exit 1
}

# 메인 로직
case "$1" in
  start)
    # browser="${2:-$(show_browser_menu)}"
    browser="chromium"

    if [[ -n "${BROWSERS[$browser]}" ]]; then
      run_tests "$browser"
    else
      echo -e "${RED}잘못된 브라우저 선택: $browser${NC}"
      show_usage
    fi
    ;;
  report)
    case "$2" in
      start)
        start_report_server
        ;;
      stop)
        stop_report_server
        ;;
      status)
        status_report_server
        ;;
      *)
        show_usage
        ;;
    esac
    ;;
  *)
    show_usage
    ;;
esac