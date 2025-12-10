#!/bin/bash

###############################################################################
# KTB Chat Backend Application Control Script
#
# Usage:
#   ./app-control.sh start    - Start the application
#   ./app-control.sh stop     - Stop the application
#   ./app-control.sh restart  - Restart the application
#   ./app-control.sh status   - Check application status
###############################################################################

set -e

# Configuration
APP_NAME="ktb-chat-backend"
JAR_FILE="target/ktb-chat-backend-0.0.1-SNAPSHOT.jar"
PID_FILE="app.pid"
LOG_DIR="logs"
LOG_FILE="${LOG_DIR}/app.log"
HEALTH_CHECK_URL="http://localhost:5001/api/health"
HEALTH_CHECK_TIMEOUT=60  # seconds
HEALTH_CHECK_INTERVAL=2  # seconds

# JVM Options
JVM_OPTS="${JVM_OPTS:--Xmx1024m -Xms512m}"

# Spring Profile
SPRING_PROFILE="${SPRING_PROFILE:-prod}"

# Ensure HOSTNAME is exported for Spring Boot
export HOSTNAME="${HOSTNAME:-$(hostname)}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

###############################################################################
# Helper Functions
###############################################################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if JAR file exists
check_jar() {
    if [ ! -f "$JAR_FILE" ]; then
        log_error "JAR file not found: $JAR_FILE"
        log_info "Please build the application first or copy the JAR file"
        exit 1
    fi
}

# Get PID from file
get_pid() {
    if [ -f "$PID_FILE" ]; then
        cat "$PID_FILE"
    else
        echo ""
    fi
}

# Check if process is running
is_running() {
    local pid=$1
    if [ -z "$pid" ]; then
        return 1
    fi
    if ps -p "$pid" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Check if port is in use
check_port() {
    local port=$1
    if command -v lsof &> /dev/null; then
        lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1
    elif command -v netstat &> /dev/null; then
        netstat -tuln | grep ":$port " >/dev/null 2>&1
    elif command -v ss &> /dev/null; then
        ss -tuln | grep ":$port " >/dev/null 2>&1
    else
        return 1
    fi
}

# Wait for health check
wait_for_health() {
    log_info "Waiting for application to be healthy..."
    local elapsed=0

    while [ $elapsed -lt $HEALTH_CHECK_TIMEOUT ]; do
        if command -v curl &> /dev/null; then
            if curl -sf "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
                log_success "Application is healthy!"
                return 0
            fi
        elif command -v wget &> /dev/null; then
            if wget -q --spider "$HEALTH_CHECK_URL" 2>/dev/null; then
                log_success "Application is healthy!"
                return 0
            fi
        else
            log_warn "Neither curl nor wget available, skipping health check"
            return 0
        fi

        sleep $HEALTH_CHECK_INTERVAL
        elapsed=$((elapsed + HEALTH_CHECK_INTERVAL))
        echo -n "."
    done

    echo ""
    log_warn "Health check timeout after ${HEALTH_CHECK_TIMEOUT}s"
    log_info "Application might still be starting up. Check logs: tail -f $LOG_FILE"
    return 1
}

###############################################################################
# Command Functions
###############################################################################

start() {
    log_info "Starting $APP_NAME..."

    check_jar

    local pid=$(get_pid)
    if is_running "$pid"; then
        log_warn "Application is already running (PID: $pid)"
        return 0
    fi

    # Clean up stale PID file
    if [ -f "$PID_FILE" ]; then
        log_warn "Removing stale PID file"
        rm -f "$PID_FILE"
    fi

    # Check if .env file exists
    if [ ! -f ".env" ]; then
        log_warn ".env file not found"
        log_info "Application will use default configuration or environment variables"
    fi

    # Create log directory
    mkdir -p "$LOG_DIR"

    # Archive old log if it exists and is too large (>100MB)
    if [ -f "$LOG_FILE" ]; then
        local log_size=$(du -m "$LOG_FILE" | cut -f1)
        if [ "$log_size" -gt 100 ]; then
            local timestamp=$(date +%Y%m%d_%H%M%S)
            log_info "Archiving large log file..."
            mv "$LOG_FILE" "${LOG_FILE}.${timestamp}"
            gzip "${LOG_FILE}.${timestamp}" &
        fi
    fi

    # Start application
    log_info "Launching application..."
    log_info "  JAR: $JAR_FILE"
    log_info "  Profile: $SPRING_PROFILE"
    log_info "  Hostname: $HOSTNAME"
    log_info "  JVM Options: $JVM_OPTS"
    log_info "  Log: $LOG_FILE"

    nohup java $JVM_OPTS \
        -Dspring.profiles.active=$SPRING_PROFILE \
        -jar "$JAR_FILE" \
        >> "$LOG_FILE" 2>&1 &

    local new_pid=$!
    echo $new_pid > "$PID_FILE"

    log_info "Application started (PID: $new_pid)"

    # Wait a moment for the process to initialize
    sleep 2

    # Verify process is still running
    if ! is_running "$new_pid"; then
        log_error "Application failed to start"
        log_info "Check logs: tail -n 50 $LOG_FILE"
        rm -f "$PID_FILE"
        exit 1
    fi

    # Wait for health check
    wait_for_health

    log_success "$APP_NAME started successfully"
    log_info "View logs: tail -f $LOG_FILE"
}

stop() {
    log_info "Stopping $APP_NAME..."

    local pid=$(get_pid)

    if [ -z "$pid" ]; then
        log_warn "PID file not found"

        # Try to find process by jar name
        pid=$(pgrep -f "$JAR_FILE" | head -1)

        if [ -z "$pid" ]; then
            log_warn "Application is not running"
            return 0
        else
            log_info "Found process by JAR name (PID: $pid)"
        fi
    fi

    if ! is_running "$pid"; then
        log_warn "Application is not running (stale PID: $pid)"
        rm -f "$PID_FILE"
        return 0
    fi

    log_info "Sending TERM signal to process (PID: $pid)..."
    kill -TERM "$pid"

    # Wait for graceful shutdown (max 30 seconds)
    local timeout=30
    local elapsed=0
    while is_running "$pid" && [ $elapsed -lt $timeout ]; do
        sleep 1
        elapsed=$((elapsed + 1))
        echo -n "."
    done
    echo ""

    if is_running "$pid"; then
        log_warn "Process did not stop gracefully, forcing..."
        kill -KILL "$pid" 2>/dev/null || true
        sleep 1
    fi

    if is_running "$pid"; then
        log_error "Failed to stop process (PID: $pid)"
        exit 1
    fi

    rm -f "$PID_FILE"
    log_success "$APP_NAME stopped successfully"
}

restart() {
    log_info "Restarting $APP_NAME..."
    stop
    sleep 2
    start
}

status() {
    local pid=$(get_pid)

    echo ""
    echo "=========================================="
    echo "  $APP_NAME Status"
    echo "=========================================="
    echo ""

    if [ -z "$pid" ]; then
        echo "Status: ${RED}STOPPED${NC}"
        echo "PID File: Not found"

        # Check if process is running anyway
        pid=$(pgrep -f "$JAR_FILE" | head -1)
        if [ -n "$pid" ]; then
            echo ""
            log_warn "Found orphaned process (PID: $pid)"
            echo "Run './app-control.sh stop' to clean up"
        fi
    elif is_running "$pid"; then
        echo "Status: ${GREEN}RUNNING${NC}"
        echo "PID: $pid"

        # Show memory usage if available
        if command -v ps &> /dev/null; then
            local mem=$(ps -o rss= -p "$pid" 2>/dev/null | awk '{printf "%.1f MB", $1/1024}')
            if [ -n "$mem" ]; then
                echo "Memory: $mem"
            fi
        fi

        # Show uptime
        if command -v ps &> /dev/null; then
            local uptime=$(ps -o etime= -p "$pid" 2>/dev/null | tr -d ' ')
            if [ -n "$uptime" ]; then
                echo "Uptime: $uptime"
            fi
        fi

        # Check health endpoint
        echo ""
        echo "Health Check: $HEALTH_CHECK_URL"
        if command -v curl &> /dev/null; then
            if curl -sf "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
                echo "Health Status: ${GREEN}HEALTHY${NC}"
            else
                echo "Health Status: ${RED}UNHEALTHY${NC}"
            fi
        fi
    else
        echo "Status: ${RED}STOPPED${NC}"
        echo "PID: $pid (stale)"
        log_warn "PID file exists but process is not running"
    fi

    echo ""
    echo "Configuration:"
    echo "  Hostname: $HOSTNAME"
    echo "  JAR: $JAR_FILE"
    echo "  Profile: $SPRING_PROFILE"
    echo "  JVM Options: $JVM_OPTS"
    echo "  Log: $LOG_FILE"

    if [ -f ".env" ]; then
        echo "  .env: ${GREEN}Found${NC}"
    else
        echo "  .env: ${YELLOW}Not found${NC}"
    fi

    echo ""
    echo "=========================================="
    echo ""
}

###############################################################################
# Main
###############################################################################

case "${1:-}" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        echo ""
        echo "Commands:"
        echo "  start    - Start the application"
        echo "  stop     - Stop the application"
        echo "  restart  - Restart the application"
        echo "  status   - Check application status"
        echo ""
        echo "Environment Variables:"
        echo "  JVM_OPTS        - JVM options (default: -Xmx1024m -Xms512m)"
        echo "  SPRING_PROFILE  - Spring profile (default: prod)"
        echo ""
        echo "Examples:"
        echo "  $0 start"
        echo "  $0 status"
        echo "  JVM_OPTS='-Xmx2048m' $0 start"
        echo "  SPRING_PROFILE=dev $0 restart"
        exit 1
        ;;
esac
