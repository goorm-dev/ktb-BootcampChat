# E2E 테스트

  채팅 애플리케이션의 Artillery 부하 테스트 코드입니다.

  ## 실행 방법

  > **⚠️ 반드시 실행이전에 환경변수를 확인하세요.**

  Makefile 사용 (권장)
  ```bash
  # 환경 검증 (Node.js, npx, Artillery 설치 확인)
  make verify-env

  # 기본 부하 테스트 (1명, 5초)
  make artillery

  # 커스터마이징
  PHASE1_ARRIVAL_COUNT=10 PHASE1_DURATION=30 make artillery
  ```

## 환경 변수

  Artillery 실행 시 다음 환경 변수로 커스터마이징할 수 있습니다:

  대상 서버

  - BASE_URL: 테스트 대상 URL
    - 기본값: https://chat.goorm-ktb-024.goorm.teams

  부하 설정

  - PHASE1_DURATION: 테스트 지속 시간 (초)
    - 기본값: 5
  - PHASE1_ARRIVAL_COUNT: 생성할 가상 유저 수
    - 기본값: 1

  시나리오 설정

  - MASS_MESSAGE_COUNT: 대량 메시지 전송 개수
    - 기본값: 10
  - ACTION_TIMEOUT: 일반 액션 타임아웃 (밀리초)
    - 기본값: 1000
  - ACTION_TIMEOUT_SHORT: 짧은 액션 타임아웃 (밀리초)
    - 기본값: 500
  - ACTION_TIMEOUT_LONG: 긴 액션 타임아웃 (밀리초)
    - 기본값: 2000
  - FORBIDDEN_WORDS: 금칙어 목록 (쉼표로 구분)
    - 기본값: "b3sig78jv,9c0hej6x,lbl276sz"

  ### 예시

  ```bash
  # 10명의 유저로 60초간 테스트
  PHASE1_ARRIVAL_COUNT=10 PHASE1_DURATION=60 make artillery

  # 다른 서버로 테스트
  BASE_URL=https://example.com PHASE1_ARRIVAL_COUNT=5 make artillery

  # 대량 메시지 100개로 테스트
  MASS_MESSAGE_COUNT=100 PHASE1_ARRIVAL_COUNT=3 make artillery

  # 타임아웃 조정
  ACTION_TIMEOUT=2000 ACTION_TIMEOUT_LONG=5000 make artillery

  # 커스텀 금칙어로 테스트
  FORBIDDEN_WORDS="word1,word2,word3" make artillery
  ```

## 디렉토리 구조

```
  artillery/
  ├── scenarios/              # 부하 테스트 시나리오
  │   ├── auth.scenario.js
  │   ├── chat.scenario.js
  │   └── profile.scenario.js
  ├── all-scenarios.js        # 통합 시나리오 순차 실행
  ├── artillery-config.yaml   # Artillery 설정 파일
  ├── Makefile               # 빌드 및 실행 명령어
  ├── package.json
  ├── node_modules/
  └── README.md
```


  ### actions/ (상위 디렉토리)

  시나리오에서 사용하는 사용자 행위 함수들입니다. 기존 Playwright 기반의 E2E 코드의 함수를 참조합니다.

  - 위치: `../actions/`

  ### fixtures/ (상위 디렉토리)

  테스트에 사용되는 고정 파일입니다.

  - 위치: `../fixtures/`

  - images/profile.jpg - 프로필 이미지 업로드 테스트용
  - pdf/sample.pdf - 파일 업로드 테스트용 (있는 경우)

  
  ### scenarios/
  
  Artillery와 Playwright를 활용한 부하 테스트 시나리오입니다. actions 함수를 재사용하여 실제 브라우저 환경에서 부하를
  시뮬레이션합니다.
  
  시나리오 파일:
  - auth.scenario.js - 인증 부하 테스트
    - loginScenario: 회원가입 → 로그인 (전체 인증 플로우)
    - failedLoginScenario: 잘못된 로그인 시도 (에러 핸들링 테스트)
  - chat.scenario.js - 채팅 부하 테스트
    - chatRoomCreationScenario: 채팅방 생성 및 메시지 전송
    - massMessageScenario: 대량 메시지 전송 (처리량 테스트)
    - fileUploadScenario: 이미지 파일 업로드
    - forbiddenWordScenario: 금칙어 필터링 테스트
  - profile.scenario.js - 프로필 부하 테스트
    - fullProfileUpdateScenario: 프로필 이름 및 이미지 업데이트

  ### all-scenarios.js

  모든 시나리오를 순차적으로 실행하는 통합 파일입니다.

  실행 순서:
  1. failedLoginScenario (Auth)
  2. loginScenario (Auth)
  3. chatRoomCreationScenario (Chat)
  4. massMessageScenario (Chat)
  5. fileUploadScenario (Chat)
  6. forbiddenWordScenario (Chat)
  7. fullProfileUpdateScenario (Profile)

  각 가상 유저는 위 7개 시나리오를 순서대로 모두 실행합니다.


  ### artillery-config.yaml

  Artillery의 기본 설정 파일입니다.

  주요 설정:
  - Playwright 엔진 사용
  - Chromium 브라우저 (headless 모드)
  - 환경 변수 기반 동적 설정

  성능 고려사항

  - 브라우저 리소스 사용량
  - 각 가상 유저는 실제 브라우저 인스턴스를 생성합니다
    - 메모리: ~100-150MB per 브라우저
    - CPU: 유저 수에 비례하여 증가
    - 네트워크: 모든 HTTP 요청 발생

  높은 부하 테스트 (50+ 동시 유저)는 충분한 시스템 리소스가 필요합니다.

  시나리오 소요 시간

  시나리오별 예상 소요 시간:
  - Auth 시나리오: ~3-5초
  - Chat 시나리오: ~5-10초 (유형에 따라 다름)
  - Profile 시나리오: ~4-8초

  전체 시나리오 세트 (7개) 완료: ~30-50초

  데이터 생성 오버헤드

  각 시나리오마다 고유한 테스트 데이터를 생성합니다:
  - DB 지속적 증가
  - 실행 간 데이터 정리 없음
  - 별도의 테스트 DB 사용 또는 주기적 정리 권장

  주의사항

  1. Headless 모드: 기본적으로 headless 모드로 실행됩니다. 디버깅이 필요한 경우 artillery-config.yaml에서 **`headless: 
  false`** 로 변경하세요.
  2. 대상 URL: 기본 대상은 https://chat.goorm-ktb-024.goorm.teams입니다. BASE_URL 환경 변수로 변경 가능합니다.
  3. 타임아웃 설정: 네트워크 환경에 따라 타임아웃 조정이 필요할 수 있습니다.
  4. 파일 경로: 파일 업로드 시나리오는 ../fixtures/images/profile.jpg 파일을 사용합니다. 파일이 존재하는지 확인하세요.
  5. 테스트 데이터: 각 시나리오가 고유한 사용자를 생성하므로 DB가 증가합니다. 주기적인 정리를 계획하세요.
  6. 서버 준비: 부하 테스트 전에 대상 서버가 준비되었는지 확인하세요.

  ## 트러블슈팅

  1. Artillery가 설치되지 않았다는 오류

  ```bash
  make verify-env
  # 또는
  npm install artillery
  ```

  2. 시나리오가 자주 타임아웃

  ```bash
  # 타임아웃 증가
  ACTION_TIMEOUT=3000 ACTION_TIMEOUT_LONG=10000 make artillery
  ```

  3. 파일 업로드 실패
    1. ../fixtures/images/profile.jpg 파일 존재 확인
    2. 파일 경로가 올바른지 확인
    3. 파일 권한 확인

  4. 메모리 부족 문제

    1. 동시 유저 수 감소: PHASE1_ARRIVAL_COUNT=5
    2. 테스트 시간 단축: PHASE1_DURATION=10
    3. 시스템 리소스 확인

  ## 관련 문서

  - https://www.artillery.io/docs
  - https://playwright.dev/docs/intro
  - https://www.artillery.io/docs/reference/engines/playwright