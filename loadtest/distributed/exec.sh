#!/bin/bash
# 모든 노드에서 동일한 명령 실행

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "$SCRIPT_DIR/config.sh"

# 색상
BLUE='\033[0;34m'
NC='\033[0m'

COMMAND="$1"

if [ -z "$COMMAND" ]; then
  echo "Usage: $0 '<command>'"
  echo ""
  echo "Examples:"
  echo "  $0 'uptime'"
  echo "  $0 'cat /tmp/setup-done'"
  echo "  $0 'node --version'"
  echo "  $0 'df -h'"
  exit 1
fi

HOSTS_FILE="$SCRIPT_DIR/hosts.txt"
HOSTS=($(grep -v '^#' "$HOSTS_FILE" | grep -v '^$'))

if [ ${#HOSTS[@]} -eq 0 ]; then
  echo "Error: No hosts found in $HOSTS_FILE"
  exit 1
fi

for i in "${!HOSTS[@]}"; do
  HOST="${HOSTS[$i]}"
  NODE_NUM=$((i + 1))

  echo -e "${BLUE}=== Node $NODE_NUM ($HOST) ===${NC}"
  ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o BatchMode=yes ${SSH_USER}@${HOST} "$COMMAND" || {
    echo "Failed to execute on $HOST"
  }
  echo ""
done
