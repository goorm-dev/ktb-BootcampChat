#!/bin/bash
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "$SCRIPT_DIR/config.sh"

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 인자 파싱
NODE_COUNT=${1:-5}
INSTANCE_TYPE=${2:-$DEFAULT_INSTANCE_TYPE}
KEY_NAME=${3:-$DEFAULT_KEY_NAME}
SECURITY_GROUP=${4:-$DEFAULT_SECURITY_GROUP}

echo -e "${BLUE}=========================================="
echo "EC2 Instance Setup"
echo "==========================================${NC}"
echo "Node count:       $NODE_COUNT"
echo "Instance type:    $INSTANCE_TYPE"
echo "Key name:         $KEY_NAME"
echo "Security group:   ${SECURITY_GROUP:-<will find existing>}"
echo "Region:           $AWS_REGION"
echo -e "${BLUE}==========================================${NC}"
echo ""

# AMI 찾기 (최신 Amazon Linux 2023)
echo -e "${YELLOW}→ Using configured AMI...${NC}"
# AMI_ID=$(aws ec2 describe-images \
#   --owners amazon \
#   --filters "Name=name,Values=al2023-ami-2023.*-x86_64" \
#             "Name=state,Values=available" \
#   --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
#   --output text \
#   --region $AWS_REGION)

echo -e "${GREEN}  AMI: $AMI_ID${NC}"
echo -e "${GREEN}  VPC: $VPC_ID${NC}"
echo -e "${GREEN}  Subnet: $SUBNET_ID${NC}"

# Security Group 찾기 또는 사용
if [ -z "$SECURITY_GROUP" ]; then
  echo ""
  echo -e "${YELLOW}→ Finding existing security groups...${NC}"

  # SSH를 허용하는 보안 그룹 찾기
  SG_ID=$(aws ec2 describe-security-groups \
    --filters "Name=ip-permission.from-port,Values=22" \
    --query "SecurityGroups[0].GroupId" \
    --output text \
    --profile $AWS_PROFILE \
    --region $AWS_REGION 2>/dev/null || echo "")

  if [ "$SG_ID" = "None" ] || [ -z "$SG_ID" ]; then
    echo -e "${RED}  No security group with SSH access found!${NC}"
    echo -e "${RED}  Please specify security group name or ID as 4th argument${NC}"
    exit 1
  fi

  SECURITY_GROUP=$SG_ID
  echo -e "${GREEN}  Using security group: $SECURITY_GROUP${NC}"
else
  # Security Group ID 또는 이름으로 찾기
  if [[ $SECURITY_GROUP == sg-* ]]; then
    SG_ID=$SECURITY_GROUP
  else
    SG_ID=$(aws ec2 describe-security-groups \
      --filters "Name=group-name,Values=$SECURITY_GROUP" \
      --query "SecurityGroups[0].GroupId" \
      --output text \
      --profile $AWS_PROFILE \
      --region $AWS_REGION)
  fi

  if [ "$SG_ID" = "None" ] || [ -z "$SG_ID" ]; then
    echo -e "${RED}  Security group not found: $SECURITY_GROUP${NC}"
    exit 1
  fi

  echo -e "${GREEN}  Using security group: $SG_ID${NC}"
fi

# User Data (초기 설정 스크립트)
USER_DATA=$(cat <<'USERDATA'
#!/bin/bash
set -e
exec > >(tee /var/log/user-data.log)
exec 2>&1

echo "[$(date)] Starting setup..."

# Node.js 20 설치
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs git rsync

# 작업 디렉토리
mkdir -p /opt/loadtest
chown ec2-user:ec2-user /opt/loadtest

echo "[$(date)] Setup complete"
touch /tmp/setup-done
USERDATA
)

# EC2 인스턴스 생성
echo ""
echo -e "${YELLOW}→ Launching $NODE_COUNT instances...${NC}"

INSTANCE_IDS=$(aws ec2 run-instances \
  --profile $AWS_PROFILE \
  --image-id $AMI_ID \
  --instance-type $INSTANCE_TYPE \
  --security-group-ids $SG_ID \
  --subnet-id $SUBNET_ID \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=loadtest-node},{Key=Environment,Value=loadtest},{Key=CreatedBy,Value=distributed-loadtest}]" \
  --count $NODE_COUNT \
  --user-data "$USER_DATA" \
  --region $AWS_REGION \
  --key-name "$KEY_NAME" \
  --query 'Instances[*].InstanceId' \
  --output text)

echo -e "${GREEN}  Instance IDs: $INSTANCE_IDS${NC}"

# 실행 대기
echo ""
echo -e "${YELLOW}→ Waiting for instances to be running...${NC}"

aws ec2 wait instance-running \
  --instance-ids $INSTANCE_IDS \
  --profile $AWS_PROFILE \
  --region $AWS_REGION

echo -e "${GREEN}  ✓ Instances are running!${NC}"

# Public IP 가져오기
echo ""
echo -e "${YELLOW}→ Getting public IPs...${NC}"
sleep 5

PUBLIC_IPS=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_IDS \
  --query 'Reservations[*].Instances[*].PublicIpAddress' \
  --output text \
  --profile $AWS_PROFILE \
  --region $AWS_REGION)

# hosts.txt 업데이트
HOSTS_FILE="$SCRIPT_DIR/hosts.txt"

echo "# Auto-generated on $(date)" > $HOSTS_FILE
echo "# Region: $AWS_REGION" >> $HOSTS_FILE
echo "# Instance IDs: $INSTANCE_IDS" >> $HOSTS_FILE
echo "" >> $HOSTS_FILE

for IP in $PUBLIC_IPS; do
  echo "$IP" >> $HOSTS_FILE
done

echo -e "${GREEN}  ✓ hosts.txt updated${NC}"

# 결과 출력
echo ""
echo -e "${GREEN}=========================================="
echo "✓ Setup complete!"
echo "==========================================${NC}"
echo "Instances created: $NODE_COUNT"
echo "Instance IDs:      $INSTANCE_IDS"
echo ""
echo "Public IPs:"
cat $HOSTS_FILE | grep -v '^#' | grep -v '^$' | nl
echo ""
echo "hosts.txt location: $HOSTS_FILE"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Wait ~60 seconds for User Data script to complete"
echo "  2. Verify setup: ./exec.sh 'cat /tmp/setup-done'"
echo "  3. Run load test: ./run.sh basic-chat --users=1000 --api-url=<URL> --socket-url=<URL>"
echo -e "${GREEN}==========================================${NC}"
