provider "aws" {
  region = "ap-northeast-2"
  profile = "stress"
}

data "aws_vpc" "existing_vpc" {
  filter {
    name   = "vpc-id"
    values = ["vpc-029ae47ab08cfa4fa"]
  }
}

data "aws_subnet" "existing_subnet" {
  filter {
    name   = "subnet-id"
    values = ["subnet-0db153e6090b5140c"]
  }
}

data "aws_internet_gateway" "existing_igw" {
  filter {
    name   = "internet-gateway-id"
    values = ["igw-0428ab0c76e9f9f43"]
  }
}

data "aws_route_table" "existing_route_table" {
  filter {
    name   = "route-table-id"
    values = ["rtb-0665183907a3fdc82"]
  }
}

data "aws_security_group" "existing_sg" {
  filter {
    name   = "group-id"
    values = ["sg-0f828b1810a6cd48c"]
  }
}

resource "aws_instance" "ec2_instances-app" {
  count         = 4
  ami           = "ami-040c33c6a51fd5d96"
  instance_type = "t3.small"
  key_name      = "stress-test-key"

  subnet_id              = data.aws_subnet.existing_subnet.id
  vpc_security_group_ids = [data.aws_security_group.existing_sg.id]

  associate_public_ip_address = true

  tags = {
    Name = "total-app-${count.index + 1}"
  }
}

resource "aws_instance" "ec2_instances-mongo" {
  count         = 2
  ami           = "ami-040c33c6a51fd5d96"
  instance_type = "t3.small"
  key_name      = "stress-test-key"

  subnet_id              = data.aws_subnet.existing_subnet.id
  vpc_security_group_ids = [data.aws_security_group.existing_sg.id]

  associate_public_ip_address = true

  tags = {
    Name = "redis-${count.index + 1}"
  }
}

resource "aws_instance" "ec2_instances-redis" {
  count         = 2
  ami           = "ami-040c33c6a51fd5d96"
  instance_type = "t3.small"
  key_name      = "stress-test-key"

  subnet_id              = data.aws_subnet.existing_subnet.id
  vpc_security_group_ids = [data.aws_security_group.existing_sg.id]

  associate_public_ip_address = true

  tags = {
    Name = "mongo-${count.index + 1}"
  }
}

output "instance_public_ips_app" {
  description = "생성된 EC2 인스턴스의 퍼블릭 IP 목록"
  value       = aws_instance.ec2_instances-app[*].public_ip
}

output "instance_public_ips_mongo" {
  description = "생성된 EC2 인스턴스의 퍼블릭 IP 목록"
  value       = aws_instance.ec2_instances-mongo[*].public_ip
}

output "instance_public_ips_redis" {
  description = "생성된 EC2 인스턴스의 퍼블릭 IP 목록"
  value       = aws_instance.ec2_instances-redis[*].public_ip
}