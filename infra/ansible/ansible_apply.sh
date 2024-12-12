#!/bin/bash

# 변수 설정
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOSTS_FILE="$ROOT_DIR/infra/ansible/hosts.ini"
ENV_FILE="$ROOT_DIR/backend/.env"

# [mongo] 그룹의 IP 주소 가져오기
MONGO_HOSTS=$(awk '/^\[mongo\]/ {getline; while ($0 !~ /^\[/ && $0 != "") {printf $0 ","; getline}}' "$HOSTS_FILE" | sed 's/,$//')

echo "MONGO_URI updated in $MONGO_HOSTS"

# 새로운 MONGO_URI 생성
MONGO_URI="mongodb://$(echo $MONGO_HOSTS | sed 's/,/:27017,/g'):27017/?replicaSet=rs0"

# .env 파일에서 MONGO_URI 업데이트
if grep -q "^MONGO_URI=" "$ENV_FILE"; then
  # 기존 MONGO_URI 교체
  sed -i.bak "s|^MONGO_URI=.*|MONGO_URI=$MONGO_URI|" "$ENV_FILE"
else
  # MONGO_URI 추가
  echo "MONGO_URI=$MONGO_URI" >> "$ENV_FILE"
fi

# [redis] 그룹의 첫 번째 IP 주소 가져오기
REDIS_HOST=$(awk '/^\[redis\]/ {getline; print}' "$HOSTS_FILE")

# .env 파일에서 REDIS_HOST 업데이트
if grep -q "^REDIS_HOST=" "$ENV_FILE"; then
  # 기존 REDIS_HOST 교체
  sed -i.bak "s|^REDIS_HOST=.*|REDIS_HOST=$REDIS_HOST|" "$ENV_FILE"
else
  # REDIS_HOST 추가
  echo "REDIS_HOST=$REDIS_HOST" >> "$ENV_FILE"
fi


# .env 파일 내용 출력
cat "$ENV_FILE"


# Docker 빌드 및 푸시
cd "$ROOT_DIR" || exit

docker compose build
docker push choiseu98/stress-frontend:latest
docker push choiseu98/stress-backend:latest

cd infra/ansible || exit
ansible-playbook -i hosts.ini playbook.yml

echo "ansible 완료"