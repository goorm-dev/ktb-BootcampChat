#!/bin/bash
# Frontend 서버 재시작 스크립트

set -e

PID_FILE="server.pid"
LOG_FILE="app.log"

# 기존 서버 종료
if [ -f "$PID_FILE" ]; then
    echo "🛑 Stopping existing server..."
    PID=$(cat "$PID_FILE")
    
    if ps -p "$PID" > /dev/null 2>&1; then
        kill "$PID" || true
        # 프로세스가 완전히 종료될 때까지 대기
        for i in {1..10}; do
            if ! ps -p "$PID" > /dev/null 2>&1; then
                break
            fi
            sleep 0.5
        done
        
        # 강제 종료가 필요한 경우
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "⚠️  Force killing process..."
            kill -9 "$PID" || true
            sleep 1
        fi
        echo "✅ Server stopped (PID: $PID)"
    else
        echo "⚠️  Process $PID not found (stale PID file)"
    fi
    rm -f "$PID_FILE"
else
    echo "⚠️  No PID file found, checking for running processes..."
    pkill -f 'node ./server.js' || true
    sleep 1
fi

echo "🚀 Starting server..."
nohup node ./server.js >> "$LOG_FILE" 2>&1 &
NEW_PID=$!

# PID 파일 저장
echo "$NEW_PID" > "$PID_FILE"

# 서버 시작 확인
sleep 1
if ps -p "$NEW_PID" > /dev/null 2>&1; then
    echo "✅ Server started successfully!"
    echo "📋 PID: $NEW_PID (saved to $PID_FILE)"
else
    echo "❌ Failed to start server"
    echo "📋 Check $LOG_FILE for details"
    rm -f "$PID_FILE"
    exit 1
fi