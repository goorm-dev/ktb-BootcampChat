#!/bin/bash

cd .. && cd ..

docker compose build
docker push choiseu98/stress-frontend:latest
docker push choiseu98/stress-backend:latest

cd infra/ansible
ansible-playbook -i hosts.ini playbook.yml

echo "ansible 완료"