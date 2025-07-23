#!/bin/bash

# 프론트엔드 Docker 이미지 빌드 및 테스트 스크립트
# 사용법: ./scripts/build-frontend.sh [옵션]
# 옵션: --dev (개발 이미지 빌드), --prod (프로덕션 이미지 빌드, 기본값), --test (테스트만 실행)

set -e  # 오류 발생 시 스크립트 중단

# 색상 코드 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 변수 설정
IMAGE_NAME="ktb-chat-frontend"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
SHORT_SHA="local"
VERSION_TAG="${TIMESTAMP}-${SHORT_SHA}"

# 함수 정의
print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}  프론트엔드 Docker 이미지 빌드 스크립트${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
}

print_step() {
    echo -e "${YELLOW}🔄 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

check_prerequisites() {
    print_step "사전 요구사항 확인 중..."
    
    # Docker 설치 확인
    if ! command -v docker &> /dev/null; then
        print_error "Docker가 설치되지 않았습니다."
        exit 1
    fi
    
    # Docker 서비스 실행 확인
    if ! docker info &> /dev/null; then
        print_error "Docker 서비스가 실행되지 않고 있습니다."
        echo "다음 명령어로 Docker를 시작하세요:"
        echo "  sudo systemctl start docker  # Linux"
        echo "  open -a Docker              # macOS"
        exit 1
    fi
    
    # frontend 디렉토리 확인
    if [ ! -d "frontend" ]; then
        print_error "frontend 디렉토리를 찾을 수 없습니다."
        echo "프로젝트 루트 디렉토리에서 실행해주세요."
        exit 1
    fi
    
    # package.json 확인
    if [ ! -f "frontend/package.json" ]; then
        print_error "frontend/package.json 파일을 찾을 수 없습니다."
        exit 1
    fi
    
    # Dockerfile 확인
    if [ ! -f "frontend/Dockerfile" ]; then
        print_error "frontend/Dockerfile을 찾을 수 없습니다."
        exit 1
    fi
    
    print_success "사전 요구사항 확인 완료"
}

cleanup_previous_images() {
    print_step "이전 이미지 정리 중..."
    
    # 기존 테스트 컨테이너 정리
    if docker ps -a | grep -q "test-frontend-container"; then
        docker rm -f test-frontend-container > /dev/null 2>&1 || true
    fi
    
    # 기존 이미지 정리 (로컬 태그만)
    docker rmi ${IMAGE_NAME}:local > /dev/null 2>&1 || true
    docker rmi ${IMAGE_NAME}:test > /dev/null 2>&1 || true
    
    print_success "이전 이미지 정리 완료"
}

build_image() {
    local target=$1
    local tag=$2
    
    print_step "$target 이미지 빌드 중..."
    
    cd frontend
    
    # 빌드 시작 시간 기록
    BUILD_START=$(date +%s)
    
    # 환경변수 설정
    export NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:5000}
    export NEXT_PUBLIC_ENCRYPTION_KEY=${NEXT_PUBLIC_ENCRYPTION_KEY:-test-encryption-key}
    export NEXT_PUBLIC_PASSWORD_SALT=${NEXT_PUBLIC_PASSWORD_SALT:-test-password-salt}
    
    echo "  환경변수 설정:"
    echo "    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL"
    echo "    NEXT_PUBLIC_ENCRYPTION_KEY=***"
    echo "    NEXT_PUBLIC_PASSWORD_SALT=***"
    
    # Docker 이미지 빌드
    docker build \
        --target $target \
        --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
        --build-arg NEXT_PUBLIC_ENCRYPTION_KEY="$NEXT_PUBLIC_ENCRYPTION_KEY" \
        --build-arg NEXT_PUBLIC_PASSWORD_SALT="$NEXT_PUBLIC_PASSWORD_SALT" \
        --tag ${IMAGE_NAME}:$tag \
        --tag ${IMAGE_NAME}:$VERSION_TAG \
        --label "org.opencontainers.image.created=$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        --label "org.opencontainers.image.revision=local-build" \
        --label "org.opencontainers.image.version=$VERSION_TAG" \
        . || {
        print_error "Docker 이미지 빌드 실패"
        cd ..
        exit 1
    }
    
    cd ..
    
    # 빌드 완료 시간 계산
    BUILD_END=$(date +%s)
    BUILD_TIME=$((BUILD_END - BUILD_START))
    
    print_success "$target 이미지 빌드 완료 (${BUILD_TIME}초 소요)"
    
    # 이미지 크기 출력
    IMAGE_SIZE=$(docker images ${IMAGE_NAME}:$tag --format "table {{.Size}}" | tail -n 1)
    echo "  이미지 크기: $IMAGE_SIZE"
}

test_image() {
    local tag=$1
    
    print_step "Docker 이미지 테스트 중..."
    
    # 테스트용 컨테이너 실행
    docker run --name test-frontend-container -d \
        -p 13000:3000 \
        -e NEXT_PUBLIC_API_URL=http://localhost:5000 \
        ${IMAGE_NAME}:$tag || {
        print_error "컨테이너 실행 실패"
        exit 1
    }
    
    # 컨테이너 시작 대기
    print_step "컨테이너 시작 대기 중... (15초)"
    sleep 15
    
    # 컨테이너 상태 확인
    if docker ps | grep -q "test-frontend-container"; then
        print_success "컨테이너가 정상적으로 실행되고 있습니다"
        
        # 헬스체크 확인 (옵션)
        echo "  컨테이너 로그 (마지막 10줄):"
        docker logs --tail 10 test-frontend-container 2>/dev/null || echo "  로그를 가져올 수 없습니다"
        
        # 포트 테스트 (옵션)
        if command -v curl &> /dev/null; then
            echo "  포트 연결 테스트 중..."
            HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:13000 2>/dev/null || echo "000")
            if [[ "$HTTP_CODE" =~ ^(200|404|301|302)$ ]]; then
                print_success "웹 서버 응답 정상 (HTTP $HTTP_CODE)"
            else
                echo "  ⚠️  웹 서버 응답: HTTP $HTTP_CODE (하지만 컨테이너는 실행 중)"
            fi
        fi
        
        # Next.js 특정 테스트 (있는 경우)
        if command -v curl &> /dev/null; then
            echo "  Next.js 헬스체크 시도 중..."
            if curl -s http://localhost:13000/api/health > /dev/null 2>&1; then
                print_success "Next.js API 라우트 응답 정상"
            else
                echo "  ⚠️  API 헬스체크 엔드포인트 없음 (정상적인 상황일 수 있음)"
            fi
        fi
    else
        print_error "컨테이너 실행 실패"
        echo "컨테이너 로그:"
        docker logs test-frontend-container
        docker rm -f test-frontend-container > /dev/null 2>&1 || true
        exit 1
    fi
    
    # 테스트 컨테이너 정리
    docker stop test-frontend-container > /dev/null 2>&1
    docker rm test-frontend-container > /dev/null 2>&1
    
    print_success "이미지 테스트 완료"
}

run_tests() {
    print_step "프론트엔드 의존성 및 테스트 실행 중..."
    
    cd frontend
    
    # Node.js 버전 확인
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        echo "  Node.js 버전: $NODE_VERSION"
    fi
    
    # npm 의존성 설치 확인
    if [ ! -d "node_modules" ]; then
        print_step "npm 의존성 설치 중..."
        npm ci || {
            print_error "의존성 설치 실패"
            cd ..
            exit 1
        }
    fi
    
    # 타입 체크 (TypeScript가 있는 경우)
    if npm list typescript >/dev/null 2>&1; then
        print_step "TypeScript 타입 체크 실행 중..."
        npx tsc --noEmit || {
            print_error "타입 체크 실패"
            cd ..
            exit 1
        }
    else
        echo "  TypeScript가 설정되지 않음"
    fi
    
    # 린팅 실행 (있는 경우)
    if npm run | grep -q "lint"; then
        print_step "코드 린팅 실행 중..."
        npm run lint || {
            print_error "린팅 실패"
            cd ..
            exit 1
        }
    else
        echo "  린팅 스크립트가 설정되지 않음"
    fi
    
    # 테스트 실행 (있는 경우)
    if npm run | grep -q "test"; then
        print_step "단위 테스트 실행 중..."
        npm test || {
            print_error "테스트 실패"
            cd ..
            exit 1
        }
    else
        echo "  테스트 스크립트가 설정되지 않음"
    fi
    
    # Next.js 빌드 테스트
    print_step "Next.js 빌드 테스트 실행 중..."
    
    # 환경변수 설정
    export NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:5000}
    export NEXT_PUBLIC_ENCRYPTION_KEY=${NEXT_PUBLIC_ENCRYPTION_KEY:-test-encryption-key}
    export NEXT_PUBLIC_PASSWORD_SALT=${NEXT_PUBLIC_PASSWORD_SALT:-test-password-salt}
    
    npm run build || {
        print_error "Next.js 빌드 실패"
        cd ..
        exit 1
    }
    
    cd ..
    
    print_success "프론트엔드 테스트 완료"
}

show_usage() {
    echo "사용법: $0 [옵션]"
    echo ""
    echo "옵션:"
    echo "  --dev     개발용 이미지 빌드"
    echo "  --prod    프로덕션용 이미지 빌드 (기본값)"
    echo "  --test    코드 테스트만 실행 (빌드 안함)"
    echo "  --help    이 도움말 표시"
    echo ""
    echo "환경변수:"
    echo "  NEXT_PUBLIC_API_URL              # 백엔드 API URL (기본값: http://localhost:5000)"
    echo "  NEXT_PUBLIC_ENCRYPTION_KEY       # 암호화 키"
    echo "  NEXT_PUBLIC_PASSWORD_SALT        # 패스워드 솔트"
    echo ""
    echo "예시:"
    echo "  $0                               # 프로덕션 이미지 빌드 및 테스트"
    echo "  $0 --dev                         # 개발 이미지 빌드 및 테스트"
    echo "  $0 --test                        # 코드 테스트만 실행"
    echo "  NEXT_PUBLIC_API_URL=https://api.example.com $0  # 커스텀 API URL로 빌드"
}

# 메인 실행 로직
main() {
    local mode="prod"
    
    # 명령행 인자 처리
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dev)
                mode="dev"
                shift
                ;;
            --prod)
                mode="prod"
                shift
                ;;
            --test)
                mode="test"
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                print_error "알 수 없는 옵션: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    print_header
    
    # 사전 요구사항 확인
    check_prerequisites
    
    # 테스트만 실행하는 경우
    if [ "$mode" = "test" ]; then
        run_tests
        echo ""
        print_success "모든 테스트가 완료되었습니다!"
        exit 0
    fi
    
    # 이미지 빌드 및 테스트
    cleanup_previous_images
    
    if [ "$mode" = "dev" ]; then
        build_image "development" "dev"
        test_image "dev"
    else
        # 프로덕션 빌드 전에 테스트 실행
        run_tests
        build_image "production" "latest"
        test_image "latest"
    fi
    
    echo ""
    print_success "모든 작업이 완료되었습니다!"
    echo ""
    echo "빌드된 이미지:"
    docker images ${IMAGE_NAME} --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    echo ""
    echo "이미지 실행 방법:"
    echo "  docker run -d -p 3000:3000 --name frontend ${IMAGE_NAME}:latest"
    echo ""
    echo "컨테이너 로그 확인:"
    echo "  docker logs frontend"
    echo ""
    echo "웹 브라우저에서 확인:"
    echo "  http://localhost:3000"
}

# 스크립트 실행
main "$@" 