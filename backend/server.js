//server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const { router: roomsRouter, initializeSocket } = require('./routes/api/rooms');
const routes = require('./routes');
const { startupChecks } = require('./utils/startup');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const promBundle = require('express-prom-bundle');
const client = require('prom-client');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5001;

// trust proxy 설정 추가
app.set('trust proxy', 1);

// CORS 설정
const corsOptions = {
  origin: [
    'https://bootcampchat-fe.run.goorm.site',
    'https://bootcampchat-hgxbv.dev-k8s.arkain.io',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'https://localhost:3000',
    'https://localhost:3001',
    'https://localhost:3002',
    'http://0.0.0.0:3000',
    'https://0.0.0.0:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'x-auth-token', 
    'x-session-id',
    'Cache-Control',
    'Pragma'
  ],
  exposedHeaders: ['x-auth-token', 'x-session-id']
};

// 기본 미들웨어
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// OPTIONS 요청에 대한 처리
app.options('*', cors(corsOptions));

// 정적 파일 제공
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 요청 로깅
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
  });
}

// 기본 수집기 활성화 (CPU, 메모리 등)
client.collectDefaultMetrics({
  prefix: 'my_app_',
  timeout: 5000
});

// Prometheus 메트릭
const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  metricsPath: '/metrics'
});
app.use(metricsMiddleware);

// 기본 상태 체크
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV
  });
});

// API 라우트 마운트
app.use('/api', routes);

// 환경변수에서 Redis 클러스터 노드 구성
const redisClusterNodes = [
  // Master 노드들
  { host: process.env.REDIS_1_HOST, port: parseInt(process.env.REDIS_1_HOST_PORT) },
  { host: process.env.REDIS_2_HOST, port: parseInt(process.env.REDIS_2_HOST_PORT) },
  { host: process.env.REDIS_3_HOST, port: parseInt(process.env.REDIS_3_HOST_PORT) },
  { host: process.env.REDIS_4_HOST, port: parseInt(process.env.REDIS_4_HOST_PORT) },
  // Replica 노드들
  { host: process.env.REDIS_1_REPLICA, port: parseInt(process.env.REDIS_1_REPLICA_PORT) },
  { host: process.env.REDIS_2_REPLICA, port: parseInt(process.env.REDIS_2_REPLICA_PORT) },
  { host: process.env.REDIS_3_REPLICA, port: parseInt(process.env.REDIS_3_REPLICA_PORT) },
  { host: process.env.REDIS_4_REPLICA, port: parseInt(process.env.REDIS_4_REPLICA_PORT) }
];

console.log('Redis Cluster Nodes Configuration:', redisClusterNodes);

// Socket.IO용 Redis 클라이언트 생성 (클러스터 모드)
const pubClient = createClient({
  socket: {
    host: redisClusterNodes[0].host,
    port: redisClusterNodes[0].port,
  },
  password: process.env.REDIS_PASSWORD,
});

const subClient = createClient({
  socket: {
    host: redisClusterNodes[0].host,
    port: redisClusterNodes[0].port,
  },
  password: process.env.REDIS_PASSWORD,
});

// 연결 이벤트 핸들러
pubClient.on('error', (err) => {
  console.error('PubClient Redis Cluster Error:', err);
});

subClient.on('error', (err) => {
  console.error('SubClient Redis Cluster Error:', err);
});

pubClient.on('connect', () => {
  console.log('PubClient connected to Redis cluster');
});

subClient.on('connect', () => {
  console.log('SubClient connected to Redis cluster');
});

// Socket.IO 설정
const io = socketIO(server, { 
  cors: corsOptions,
  adapter: createAdapter(pubClient, subClient)
});

// Socket.IO 객체 전달 (소켓 초기화는 나중에)
initializeSocket(io);

// 404 에러 핸들러
app.use((req, res) => {
  console.log('404 Error:', req.originalUrl);
  res.status(404).json({
    success: false,
    message: '요청하신 리소스를 찾을 수 없습니다.',
    path: req.originalUrl
  });
});

// 글로벌 에러 핸들러
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || '서버 에러가 발생했습니다.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 서버 시작
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('MongoDB Connected');
    
    // Redis 클러스터 초기화 체크
    await startupChecks();
    
    // Redis 클러스터 연결
    await Promise.all([
      pubClient.connect(),
      subClient.connect()
    ]);
    
    console.log('Redis cluster connected for Socket.IO adapter');
    console.log('Cluster nodes:', redisClusterNodes.map(node => `${node.host}:${node.port}`));
    
    // 소켓 초기화 (한 번만)
    require('./sockets/chat')(io);
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log('Environment:', process.env.NODE_ENV);
      console.log('API Base URL:', `http://0.0.0.0:${PORT}/api`);
      console.log('Redis Cluster configured with 8 nodes');
    });
  })
  .catch(err => {
    console.error('Server startup error:', err);
    process.exit(1);
  });

module.exports = { app, server };