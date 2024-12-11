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

data "aws_subnet" "existing_subnet_a" {
  filter {
    name   = "subnet-id"
    values = ["subnet-02b3a69e91b3cb7c8"]
  }
}

data "aws_subnet" "existing_subnet_c" {
  filter {
    name   = "subnet-id"
    values = ["subnet-03402ac4a7ba6687b"]
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










resource "aws_instance" "ec2_instances_app_a" {
  count         = 2
  ami           = "ami-040c33c6a51fd5d96"
  instance_type = "t3.small"
  key_name      = "stress-test-key"

  subnet_id              = data.aws_subnet.existing_subnet_a.id
  vpc_security_group_ids = [data.aws_security_group.existing_sg.id]

  associate_public_ip_address = true

  tags = {
    Name = "total-app-front-${count.index + 1}"
  }
}

resource "aws_instance" "ec2_instances_app_c" {
  count         = 2
  ami           = "ami-040c33c6a51fd5d96"
  instance_type = "t3.small"
  key_name      = "stress-test-key"

  subnet_id              = data.aws_subnet.existing_subnet_c.id
  vpc_security_group_ids = [data.aws_security_group.existing_sg.id]

  associate_public_ip_address = true

  tags = {
    Name = "total-app-back-${count.index + 1}"
  }
}

resource "aws_instance" "ec2_instances_mongo" {
  count         = 2
  ami           = "ami-040c33c6a51fd5d96"
  instance_type = "t3.small"
  key_name      = "stress-test-key"

  subnet_id              = data.aws_subnet.existing_subnet_a.id
  vpc_security_group_ids = [data.aws_security_group.existing_sg.id]

  associate_public_ip_address = true

  tags = {
    Name = "total-redis-${count.index + 1}"
  }
}

resource "aws_instance" "ec2_instances_redis" {
  count         = 2
  ami           = "ami-040c33c6a51fd5d96"
  instance_type = "t3.small"
  key_name      = "stress-test-key"

  subnet_id              = data.aws_subnet.existing_subnet_a.id
  vpc_security_group_ids = [data.aws_security_group.existing_sg.id]

  associate_public_ip_address = true

  tags = {
    Name = "total-mongo-${count.index + 1}"
  }
}

resource "aws_instance" "ec2_instances_monitoring" {
  count         = 1
  ami           = "ami-040c33c6a51fd5d96"
  instance_type = "t3.small"
  key_name      = "stress-test-key"

  subnet_id              = data.aws_subnet.existing_subnet_c.id
  vpc_security_group_ids = [data.aws_security_group.existing_sg.id]

  associate_public_ip_address = true

  tags = {
    Name = "total-monitoring-${count.index + 1}"
  }
}










resource "aws_lb" "app_alb" {
  name               = "total-app-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [data.aws_security_group.existing_sg.id]
  subnets            = [data.aws_subnet.existing_subnet_a.id, data.aws_subnet.existing_subnet_c.id]

  enable_deletion_protection = false
  idle_timeout               = 60

  tags = {
    Name = "total-app-alb"
  }
}

resource "aws_lb_target_group" "app_tg" {
  name        = "total-app-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.existing_vpc.id
  target_type = "instance"

  health_check {
    path                = "/health"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 3
    unhealthy_threshold = 2
    protocol            = "HTTP"
  }

  tags = {
    Name = "total-app-tg"
  }
}

resource "aws_lb_listener" "http_listener" {
  load_balancer_arn = aws_lb.app_alb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app_tg.arn
  }
}

locals {
  all_app_instance_ids = concat(
    aws_instance.ec2_instances_app_a[*].id,
    aws_instance.ec2_instances_app_c[*].id
  )
}

resource "aws_lb_target_group_attachment" "app_targets" {
  count            = length(local.all_app_instance_ids)
  target_group_arn = aws_lb_target_group.app_tg.arn
  target_id        = local.all_app_instance_ids[count.index]
  port             = 3000

  depends_on = [aws_lb_listener.http_listener]
}

























output "instance_public_ips_app_a" {
  description = "생성된 EC2 인스턴스의 퍼블릭 IP 목록"
  value       = aws_instance.ec2_instances_app_a[*].public_ip
}

output "instance_public_ips_app_c" {
  description = "생성된 EC2 인스턴스의 퍼블릭 IP 목록"
  value       = aws_instance.ec2_instances_app_c[*].public_ip
}

output "instance_public_ips_mongo" {
  description = "생성된 EC2 인스턴스의 퍼블릭 IP 목록"
  value       = aws_instance.ec2_instances_mongo[*].public_ip
}

output "instance_public_ips_redis" {
  description = "생성된 EC2 인스턴스의 퍼블릭 IP 목록"
  value       = aws_instance.ec2_instances_redis[*].public_ip
}

output "instance_public_ips_monitoring" {
  description = "생성된 EC2 인스턴스의 퍼블릭 IP 목록"
  value       = aws_instance.ec2_instances_monitoring[*].public_ip
}

output "alb_dns_name" {
  description = "Application Load Balancer의 DNS 이름"
  value       = aws_lb.app_alb.dns_name
}