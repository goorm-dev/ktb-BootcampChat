#!/bin/bash
# Configuration for distributed load testing

# AWS 설정
export AWS_REGION="${AWS_REGION:-ap-northeast-2}"
export AWS_PROFILE="${AWS_PROFILE:-ktb-chat-app}"
export AMI_ID="${AMI_ID:-ami-04fcc2023d6e37430}"
export VPC_ID="${VPC_ID:-vpc-039e4008af90d106a}"
export SUBNET_ID="${SUBNET_ID:-subnet-0b0297b0bd33f3c69}"

# SSH 설정 (기존 키 사용)
export SSH_KEY="${SSH_KEY:-$HOME/.ssh/key-ktb-chat-app.pem}"
export SSH_USER="${SSH_USER:-ec2-user}"

# EC2 설정
export DEFAULT_INSTANCE_TYPE="${DEFAULT_INSTANCE_TYPE:-t3.medium}"
export DEFAULT_KEY_NAME="${DEFAULT_KEY_NAME:-key-ktb-chat-app}"
export DEFAULT_SECURITY_GROUP="${DEFAULT_SECURITY_GROUP:-sg-0a81f18bcc196d5c0}"  # 비워두면 기존 것 사용

# 원격 디렉토리
export REMOTE_DIR="/opt/loadtest"

# 기본 타겟 URL
export DEFAULT_API_URL="${DEFAULT_API_URL:-http://10.0.6.145:5001}"
export DEFAULT_SOCKET_URL="${DEFAULT_SOCKET_URL:-http://10.0.6.145:5002}"
