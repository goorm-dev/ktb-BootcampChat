SHELL := /bin/bash
.ONESHELL:
.PHONY: setup-java verify-java verify-docker setup-env dev build build-jar build-jar-with-tests test clean install cluster-up deploy deploy-jar restart-servers status-servers deploy-o11y o11y-up o11y-down o11y-logs o11y-restart

COMPOSE_O11Y_FILE ?= docker-compose.o11y.yaml
BACKEND_SCALE ?= 3
DEPLOY_SERVERS ?= your-remote-server1 your-remote-server2 your-remote-server3
DEPLOY_PATH ?= /home/ubuntu/ktb-chat-backend
JVM_OPTS ?= -Xmx1024m

# SDKMAN 초기화 매크로
SDKMAN_INIT = source "$$HOME/.sdkman/bin/sdkman-init.sh" 2>/dev/null || true

# Java 개발 환경 설치
setup-java:
	@echo "🔍 Checking Java installation..."
	@if command -v java &> /dev/null; then \
		echo "✅ Java is already installed: $$(java -version 2>&1 | head -n 1)"; \
		exit 0; \
	fi
	@echo "📦 Installing SDKMAN..."
	@if [ ! -d "$$HOME/.sdkman" ]; then \
		curl -s "https://get.sdkman.io" | bash; \
		echo "✅ SDKMAN installed"; \
	else \
		echo "✅ SDKMAN already installed"; \
	fi
	@echo "☕ Installing Java 21.0.9-librca..."
	@$(SDKMAN_INIT) && \
	sdk install java 21.0.9-librca && \
	sdk default java 21.0.9-librca
	@chmod +x ./mvnw
	@echo "✅ Java installation completed!"
	@echo "⚠️  Please restart your terminal or run: source ~/.bashrc (or ~/.zshrc)"

# Java 환경 확인
verify-java:
	@$(SDKMAN_INIT)
	@echo "Java Version:"
	@java -version
	@echo ""
	@echo "JAVA_HOME: $$JAVA_HOME"
	@echo ""
	@echo "Maven Version:"
	@./mvnw --version

# Docker 환경 확인
verify-docker:
	@echo "🐳 Checking Docker installation..."
	@if ! command -v docker &> /dev/null; then \
		echo "❌ Docker is not installed!"; \
		echo ""; \
		echo "Please install Docker Desktop:"; \
		echo "  - macOS: https://docs.docker.com/desktop/install/mac-install/"; \
		echo "  - Linux: https://docs.docker.com/engine/install/"; \
		echo "  - Windows: https://docs.docker.com/desktop/install/windows-install/"; \
		echo ""; \
		exit 1; \
	fi
	@echo "✅ Docker is installed: $$(docker --version)"
	@if ! docker info &> /dev/null; then \
		echo "❌ Docker daemon is not running!"; \
		echo ""; \
		echo "Please start Docker Desktop or Docker daemon."; \
		echo ""; \
		exit 1; \
	fi
	@echo "✅ Docker daemon is running"

# .env 파일 설정
setup-env:
	@if [ ! -f .env ]; then \
		echo "🔧 Creating .env file from template..."; \
		cp .env.template .env; \
		if command -v openssl &> /dev/null; then \
			JWT_SECRET=$$(openssl rand -hex 32); \
			ENCRYPTION_KEY=$$(openssl rand -hex 64); \
			ENCRYPTION_SALT=$$(openssl rand -hex 32); \
			if [[ "$$(uname)" == "Darwin" ]]; then \
				sed -i '' "s/^JWT_SECRET=.*/JWT_SECRET=$$JWT_SECRET/" .env; \
				sed -i '' "s/^ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$$ENCRYPTION_KEY/" .env; \
				sed -i '' "s/^ENCRYPTION_SALT=.*/ENCRYPTION_SALT=$$ENCRYPTION_SALT/" .env; \
			else \
				sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$$JWT_SECRET/" .env; \
				sed -i "s/^ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$$ENCRYPTION_KEY/" .env; \
				sed -i "s/^ENCRYPTION_SALT=.*/ENCRYPTION_SALT=$$ENCRYPTION_SALT/" .env; \
			fi; \
			echo "✅ .env file created with generated secrets"; \
			echo "   - JWT_SECRET: 32 hex characters"; \
			echo "   - ENCRYPTION_KEY: 64 hex characters"; \
			echo "   - ENCRYPTION_SALT: 32 hex characters"; \
		else \
			echo "⚠️  .env file created but secrets need to be set manually"; \
			echo "    openssl is not available for generating secrets"; \
		fi; \
	else \
		echo "✅ .env file already exists"; \
	fi

dev: setup-env verify-docker
	@echo "Starting application with Testcontainers..."
	@$(SDKMAN_INIT) && \
	./mvnw compile spring-boot:test-run \
		-Dspring-boot.run.profiles=dev \
		-Dspring-boot.run.jvmArguments="$(JVM_OPTS)"

build: verify-docker
	@echo "Building application..."
	@$(SDKMAN_INIT) && ./mvnw clean package

# JAR 파일만 빌드 (테스트 제외 - 빠른 배포용)
build-jar:
	@echo "🔨 Building JAR file (skipping tests)..."
	@$(SDKMAN_INIT) && ./mvnw clean package -DskipTests
	@echo "✅ JAR file built: target/ktb-chat-backend-0.0.1-SNAPSHOT.jar"

# JAR 파일 빌드 (테스트 포함 - 프로덕션 배포용)
build-jar-with-tests: verify-docker
	@echo "🔨 Building JAR file with tests..."
	@$(SDKMAN_INIT) && ./mvnw clean package
	@echo "✅ JAR file built: target/ktb-chat-backend-0.0.1-SNAPSHOT.jar"

test: verify-docker
	@echo "Running tests..."
	@$(SDKMAN_INIT) && ./mvnw test

clean:
	@echo "Cleaning build artifacts..."
	@$(SDKMAN_INIT) && ./mvnw clean

# 원격 서버로 배포 (기존 방식 - 소스 코드 전체)
deploy:
	@echo "📦 Deploying to remote servers..."
	@for server in $(DEPLOY_SERVERS); do \
		echo "  → Deploying to $$server..."; \
		ssh $$server "mkdir -p $(DEPLOY_PATH)"; \
		rsync -avz --delete --exclude '.git' --exclude '.env' --exclude 'target' \
			. $$server:$(DEPLOY_PATH); \
		echo "  ✅ $$server completed"; \
	done
	@echo "✅ All deployments completed!"

# JAR 파일 배포 (신규 방식 - JAR + 실행 스크립트만, 병렬 실행)
deploy-jar:
	@echo "📦 Deploying JAR to remote servers (parallel)..."
	@if [ ! -f target/ktb-chat-backend-0.0.1-SNAPSHOT.jar ]; then \
		echo "❌ JAR file not found!"; \
		echo "   Run 'make build-jar' first"; \
		exit 1; \
	fi
	@echo ""
	@pids=""; \
	for server in $(DEPLOY_SERVERS); do \
		echo "  → Starting deployment to $$server..."; \
		(ssh $$server "mkdir -p $(DEPLOY_PATH)/{target,logs}" && \
		 echo "    [$$server] Uploading JAR file..." && \
		 rsync -az target/ktb-chat-backend-0.0.1-SNAPSHOT.jar \
			$$server:$(DEPLOY_PATH)/target/ && \
		 echo "    [$$server] Uploading control script..." && \
		 rsync -az app-control.sh $$server:$(DEPLOY_PATH)/ && \
		 ssh $$server "chmod +x $(DEPLOY_PATH)/app-control.sh" && \
		 if [ -f .env ]; then \
			if ssh $$server "[ -f $(DEPLOY_PATH)/.env ]"; then \
				echo "    [$$server] .env already exists (not overwriting)"; \
			else \
				echo "    [$$server] Uploading .env file..." && \
				rsync -az .env $$server:$(DEPLOY_PATH)/; \
			fi; \
		 fi && \
		 echo "  ✅ $$server deployment completed" || \
		 echo "  ❌ $$server deployment failed") & \
		pids="$$pids $$!"; \
	done; \
	echo ""; \
	echo "⏳ Waiting for all deployments to complete..."; \
	wait $$pids; \
	echo ""
	@echo "✅ All deployments completed!"
	@echo ""
	@echo "💡 Restart servers with:"
	@echo "   make restart-servers"

# 원격 서버 애플리케이션 재시작 (병렬 실행)
restart-servers:
	@echo "🔄 Restarting applications on remote servers (parallel)..."
	@echo ""
	@pids=""; \
	for server in $(DEPLOY_SERVERS); do \
		echo "  → Starting restart on $$server..."; \
		(ssh $$server "cd $(DEPLOY_PATH) && ./app-control.sh restart" && \
		 echo "  ✅ $$server restart completed" || \
		 echo "  ❌ $$server restart failed") & \
		pids="$$pids $$!"; \
	done; \
	echo ""; \
	echo "⏳ Waiting for all restarts to complete..."; \
	wait $$pids; \
	echo ""
	@echo "✅ All restarts completed!"
	@echo ""
	@echo "💡 Check status with:"
	@echo "   make status-servers"

# 원격 서버 상태 확인
status-servers:
	@echo "📊 Checking application status on remote servers..."
	@for server in $(DEPLOY_SERVERS); do \
		echo ""; \
		echo "  → Status of $$server:"; \
		ssh $$server "cd $(DEPLOY_PATH) && ./app-control.sh status" || echo "    ❌ Failed to get status"; \
	done

# 모니터링 스택 시작 (Prometheus + Grafana)
o11y-up: setup-env verify-docker
	@echo "🚀 Starting monitoring stack (Prometheus + Grafana)..."
	docker compose -f $(COMPOSE_O11Y_FILE) --env-file .env up -d
	@echo "✅ Monitoring stack started!"
	@echo ""
	@echo "📊 Access URLs:"
	@echo "  - Prometheus: http://localhost:9090"
	@echo "  - Grafana:    http://localhost:3000 (admin/admin)"
	@echo ""
	@echo "💡 Tip: Run 'make o11y-logs' to view logs"

# 모니터링 스택 종료
o11y-down:
	@echo "🛑 Stopping monitoring stack..."
	docker compose -f $(COMPOSE_O11Y_FILE) down
	@echo "✅ Monitoring stack stopped!"

# 모니터링 스택 로그 확인
o11y-logs:
	@echo "📋 Viewing monitoring stack logs..."
	docker compose -f $(COMPOSE_O11Y_FILE) logs -f

# 모니터링 스택 재시작
o11y-restart: o11y-down o11y-up
	@echo "✅ Monitoring stack restarted!"

deploy-o11y:
	@echo "📦 Deploying monitoring stack to remote servers..."
	@echo "  → Deploying to ktb-o11y..."
	ssh ktb-o11y "mkdir -p ~/o11y"
	rsync -avz --delete monitoring $(COMPOSE_O11Y_FILE) ktb-o11y:~/o11y/
	@echo ""
	@echo "⚠️  IMPORTANT: Update .env file on remote server with production values!"
	@echo "   SSH to ktb-o11y and edit ~/o11y/.env"
	@echo ""
	@echo "✅ Monitoring stack deployment completed!"
