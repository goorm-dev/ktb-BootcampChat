#!/usr/bin/env python3
"""
Result aggregation script for distributed load testing
Parses log files from multiple nodes and produces summary statistics
"""

import sys
import re
import os
from pathlib import Path

def parse_log_file(log_file):
    """로그 파일에서 메트릭 추출"""
    try:
        with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    except Exception as e:
        print(f"Warning: Could not read {log_file}: {e}", file=sys.stderr)
        return None

    metrics = {}

    # 정규식 패턴으로 메트릭 파싱
    patterns = {
        'users_created': r'Users Created\s+│\s+(\d+)',
        'connected': r'Connected\s+│\s+(\d+)',
        'disconnected': r'Disconnected\s+│\s+(\d+)',
        'messages_sent': r'Messages Sent\s+│\s+(\d+)',
        'messages_received': r'Messages Received\s+│\s+(\d+)',
        'messages_read': r'Messages Marked Read\s+│\s+(\d+)',
        'read_acks': r'Read Acks Received\s+│\s+(\d+)',
        'avg_latency': r'Avg Message Latency\s+│\s+([\d.]+)ms',
        'p95_latency': r'P95 Message Latency\s+│\s+([\d.]+)ms',
        'p99_latency': r'P99 Message Latency\s+│\s+([\d.]+)ms',
        'avg_connection_time': r'Avg Connection Time\s+│\s+([\d.]+)ms',
        'errors_auth': r'Auth Errors\s+│\s+(\d+)',
        'errors_connection': r'Connection Errors\s+│\s+(\d+)',
        'errors_message': r'Message Errors\s+│\s+(\d+)',
        'total_errors': r'Total Errors\s+│\s+(\d+)'
    }

    for key, pattern in patterns.items():
        match = re.search(pattern, content)
        if match:
            metrics[key] = float(match.group(1))
        else:
            metrics[key] = 0

    # 완료 시간 추출
    elapsed_match = re.search(r'Elapsed Time\s+│\s+([\d.]+)s', content)
    if elapsed_match:
        metrics['elapsed_time'] = float(elapsed_match.group(1))
    else:
        metrics['elapsed_time'] = 0

    # Messages/sec 계산
    if metrics['elapsed_time'] > 0:
        metrics['messages_per_sec'] = metrics['messages_sent'] / metrics['elapsed_time']
    else:
        metrics['messages_per_sec'] = 0

    return metrics

def aggregate_metrics(metrics_list):
    """여러 노드의 메트릭을 집계"""
    if not metrics_list:
        return {}

    aggregated = {}

    # 합산 메트릭
    sum_keys = [
        'users_created', 'connected', 'disconnected',
        'messages_sent', 'messages_received', 'messages_read', 'read_acks',
        'errors_auth', 'errors_connection', 'errors_message', 'total_errors'
    ]

    for key in sum_keys:
        aggregated[key] = sum(m.get(key, 0) for m in metrics_list)

    # 평균 메트릭
    avg_keys = ['avg_latency', 'p95_latency', 'p99_latency', 'avg_connection_time', 'elapsed_time']

    for key in avg_keys:
        values = [m.get(key, 0) for m in metrics_list if m.get(key, 0) > 0]
        aggregated[key] = sum(values) / len(values) if values else 0

    # Messages/sec 재계산
    if aggregated['elapsed_time'] > 0:
        aggregated['messages_per_sec'] = aggregated['messages_sent'] / aggregated['elapsed_time']
    else:
        aggregated['messages_per_sec'] = 0

    return aggregated

def print_summary(metrics, node_count):
    """결과 요약 출력"""
    print("=" * 60)
    print("AGGREGATED RESULTS")
    print("=" * 60)
    print(f"Total Nodes:          {node_count}")
    print(f"Total Users Created:  {int(metrics.get('users_created', 0))}")
    print(f"Total Connected:      {int(metrics.get('connected', 0))}")
    print(f"Total Disconnected:   {int(metrics.get('disconnected', 0))}")
    print("-" * 60)
    print(f"Total Messages Sent:  {int(metrics.get('messages_sent', 0))}")
    print(f"Total Messages Rcvd:  {int(metrics.get('messages_received', 0))}")
    print(f"Messages Marked Read: {int(metrics.get('messages_read', 0))}")
    print(f"Read Acks Received:   {int(metrics.get('read_acks', 0))}")
    print(f"Messages/sec:         {metrics.get('messages_per_sec', 0):.2f}")
    print("-" * 60)
    print(f"Avg Latency:          {metrics.get('avg_latency', 0):.2f}ms")
    print(f"P95 Latency:          {metrics.get('p95_latency', 0):.2f}ms")
    print(f"P99 Latency:          {metrics.get('p99_latency', 0):.2f}ms")
    print(f"Avg Connection Time:  {metrics.get('avg_connection_time', 0):.2f}ms")
    print(f"Avg Test Duration:    {metrics.get('elapsed_time', 0):.1f}s")
    print("-" * 60)
    print(f"Auth Errors:          {int(metrics.get('errors_auth', 0))}")
    print(f"Connection Errors:    {int(metrics.get('errors_connection', 0))}")
    print(f"Message Errors:       {int(metrics.get('errors_message', 0))}")
    print(f"Total Errors:         {int(metrics.get('total_errors', 0))}")
    print("=" * 60)

def main():
    if len(sys.argv) < 2:
        print("Usage: collect.py <result_dir>", file=sys.stderr)
        sys.exit(1)

    result_dir = Path(sys.argv[1])

    if not result_dir.exists():
        print(f"Error: Directory not found: {result_dir}", file=sys.stderr)
        sys.exit(1)

    # 로그 파일 찾기
    log_files = sorted(result_dir.glob("node-*.log"))

    if not log_files:
        print("No log files found!", file=sys.stderr)
        print(f"Looking in: {result_dir}", file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(log_files)} log files", file=sys.stderr)
    print("", file=sys.stderr)

    all_metrics = []

    for log_file in log_files:
        try:
            metrics = parse_log_file(log_file)
            if metrics:
                all_metrics.append(metrics)
                print(f"✓ Parsed {log_file.name}", file=sys.stderr)
            else:
                print(f"✗ Could not parse {log_file.name}", file=sys.stderr)
        except Exception as e:
            print(f"✗ Error parsing {log_file.name}: {e}", file=sys.stderr)

    if not all_metrics:
        print("", file=sys.stderr)
        print("No metrics could be extracted!", file=sys.stderr)
        sys.exit(1)

    # 집계
    aggregated = aggregate_metrics(all_metrics)

    # 결과 출력
    print("", file=sys.stderr)
    print_summary(aggregated, len(all_metrics))

if __name__ == '__main__':
    main()
