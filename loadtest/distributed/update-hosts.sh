#!/bin/bash
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "$SCRIPT_DIR/config.sh"

# 색상
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

HOSTS_FILE="$SCRIPT_DIR/hosts.txt"

echo -e "${YELLOW}Fetching running loadtest instances...${NC}"

PUBLIC_IPS=$(aws ec2 describe-instances \
  --filters "Name=tag:Environment,Values=loadtest" \
            "Name=instance-state-name,Values=running" \
  --query 'Reservations[*].Instances[*].PublicIpAddress' \
  --output text \
  --region $AWS_REGION)

if [ -z "$PUBLIC_IPS" ]; then
  echo -e "${RED}❌ No running instances found!${NC}"
  echo "Create instances with: ./setup-ec2.sh <count>"
  exit 1
fi

INSTANCE_COUNT=$(echo $PUBLIC_IPS | wc -w)

echo "# Auto-updated on $(date)" > $HOSTS_FILE
echo "# Region: $AWS_REGION" >> $HOSTS_FILE
echo "# Found $INSTANCE_COUNT running instances" >> $HOSTS_FILE
echo "" >> $HOSTS_FILE

for IP in $PUBLIC_IPS; do
  echo "$IP" >> $HOSTS_FILE
done

echo -e "${GREEN}✓ hosts.txt updated with $INSTANCE_COUNT IPs${NC}"
echo ""
cat $HOSTS_FILE | grep -v '^#' | grep -v '^$' | nl
