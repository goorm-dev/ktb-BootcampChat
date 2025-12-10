#!/bin/bash
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"
LOADTEST_DIR="$PROJECT_ROOT/loadtest"

source "$SCRIPT_DIR/config.sh"

# 색상
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

NODES=${1:-""}
HOSTS_FILE="$SCRIPT_DIR/hosts.txt"

# hosts.txt에서 IP 읽기
HOSTS=($(grep -v '^#' "$HOSTS_FILE" | grep -v '^$'))

if [ ${#HOSTS[@]} -eq 0 ]; then
  echo -e "${RED}Error: No hosts found in $HOSTS_FILE${NC}"
  exit 1
fi

# 노드 수 제한
if [ -n "$NODES" ]; then
  HOSTS=("${HOSTS[@]:0:$NODES}")
fi

echo -e "${BLUE}=========================================="
echo "Deploying to ${#HOSTS[@]} nodes"
echo "==========================================${NC}"
echo ""

for HOST in "${HOSTS[@]}"; do
  echo -e "${YELLOW}→ $HOST${NC}"

  # rsync로 동기화
  rsync -az --delete \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'distributed' \
    --exclude '*.log' \
    -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o BatchMode=yes" \
    "$LOADTEST_DIR/" \
    ${SSH_USER}@${HOST}:${REMOTE_DIR}/ 2>&1 | sed 's/^/  /'

  # npm install
  ssh -i $SSH_KEY -o BatchMode=yes ${SSH_USER}@${HOST} \
    "cd ${REMOTE_DIR} && npm install --production" 2>&1 | sed 's/^/  /'

  echo -e "${GREEN}  ✓ Complete${NC}"
  echo ""
done

echo -e "${GREEN}✅ Deployment complete to ${#HOSTS[@]} nodes!${NC}"
