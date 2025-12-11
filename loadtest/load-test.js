#!/usr/bin/env node

const io = require('socket.io-client');
const axios = require('axios');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const chalk = require('chalk');
const Table = require('cli-table3');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('users', {
    alias: 'u',
    description: 'Total number of users to simulate',
    type: 'number',
    default: 100
  })
  .option('rampup', {
    alias: 'r',
    description: 'Ramp-up time in seconds',
    type: 'number',
    default: 30
  })
  .option('duration', {
    alias: 'd',
    description: 'Test duration in seconds (0 = until all messages sent)',
    type: 'number',
    default: 0
  })
  .option('messages', {
    alias: 'm',
    description: 'Messages per user',
    type: 'number',
    default: 20
  })
  .option('api-url', {
    description: 'Backend REST API URL',
    type: 'string',
    default: 'http://localhost:5001'
  })
  .option('socket-url', {
    description: 'Socket.IO server URL',
    type: 'string',
    default: 'http://127.0.0.1:5002'
  })
  .option('room-id', {
    description: 'Room ID to send messages to (auto-create if not specified)',
    type: 'string',
    default: null
  })
  .option('batch-size', {
    alias: 'b',
    description: 'Number of users to spawn simultaneously per batch',
    type: 'number',
    default: 10
  })
  .option('batch-delay', {
    description: 'Delay between batches in milliseconds',
    type: 'number',
    default: 1000
  })
  .help()
  .alias('help', 'h')
  .argv;

class LoadTester {
  constructor(config) {
    this.config = config;
    this.metrics = {
      usersCreated: 0,
      connected: 0,
      disconnected: 0,
      messagesSent: 0,
      messagesReceived: 0,
      messagesRead: 0,
      readAcksReceived: 0,
      errorsAuth: 0,
      errorsConnection: 0,
      errorsMessage: 0,
      latencies: [],
      connectionTimes: [],
      startTime: Date.now()
    };
    this.sockets = [];
    this.metricsInterval = null;
    this.logBuffer = [];
    this.maxLogLines = 10;  // Keep last 10 log lines
  }

  log(level, message, ...args) {
    const timestamp = new Date().toISOString().substring(11, 19);  // HH:MM:SS only
    const formattedMessage = `[${timestamp}] ${message} ${args.join(' ')}`;

    // Add to buffer
    this.logBuffer.push({ level, message: formattedMessage });
    if (this.logBuffer.length > this.maxLogLines) {
      this.logBuffer.shift();
    }

    // Don't output to console directly - it will be handled by printMetrics
  }

  async createTestUser(userId) {
    try {
      const email = `loadtest-${userId}@test.com`;
      const password = 'Test1234!';
      const name = `LoadTest User ${userId}`;

      // Try to login first
      let authRes;
      try {
        authRes = await axios.post(
          `${this.config.apiUrl}/api/auth/login`,
          { email, password },
          { timeout: 5000 }
        );
      } catch (loginError) {
        // If login fails, try to register
        if (loginError.response?.status === 401 || loginError.response?.status === 404) {
          this.log('info', `Registering new user: ${email}`);
          authRes = await axios.post(
            `${this.config.apiUrl}/api/auth/register`,
            { email, password, name },
            { timeout: 5000 }
          );
        } else {
          throw loginError;
        }
      }

      this.metrics.usersCreated++;
      return authRes.data;

    } catch (error) {
      this.metrics.errorsAuth++;
      this.log('error', `Failed to create/login user ${userId}:`, error.message);
      return null;
    }
  }

  async createTestRoom() {
    try {
      // If room ID is specified, use it
      if (this.config.roomId) {
        this.log('info', `Using existing room: ${this.config.roomId}`);
        return this.config.roomId;
      }

      // Create a test user for room creation
      this.log('info', 'Creating test room admin user...');
      const adminAuth = await this.createTestUser('admin');
      if (!adminAuth) {
        throw new Error('Failed to create admin user for room');
      }

      // Create a test room
      this.log('info', 'Creating load test room...');
      const response = await axios.post(
        `${this.config.apiUrl}/api/rooms`,
        {
          name: 'Load Test Room',
          description: 'Room for load testing - ' + new Date().toISOString(),
          participants: []  // Room creator will be added automatically
        },
        {
          headers: {
            'Authorization': `Bearer ${adminAuth.token}`
          },
          timeout: 10000
        }
      );

      // API response structure: { success: true, data: { _id: "...", ... } }
      const roomId = response.data.data._id;
      this.log('success', `Load test room created: ${roomId}`);
      return roomId;

    } catch (error) {
      this.log('error', 'Failed to create test room:', error.message);
      throw error;
    }
  }

  async simulateUser(userId, roomId) {
    const connectStartTime = Date.now();

    try {
      // 1. Authenticate
      const authData = await this.createTestUser(userId);
      if (!authData) {
        return;
      }

      const { token, sessionId, user } = authData;

      // 3. Connect to Socket.IO
      const socket = io(this.config.socketUrl, {
        auth: { token, sessionId },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 30000,  // 30초 연결 타임아웃 (heavy 테스트용)
        forceNew: true,  // 항상 새 연결 생성
        upgrade: false   // polling->websocket 업그레이드 비활성화 (안정성 우선)
      });

      this.sockets.push(socket);

      return new Promise((resolve) => {
        socket.on('connect', () => {
          const connectionTime = Date.now() - connectStartTime;
          this.metrics.connected++;
          this.metrics.connectionTimes.push(connectionTime);
          this.log('success', `User ${userId} (${user.name}) connected in ${connectionTime}ms`);

          // Join room
          socket.emit('joinRoom', roomId);
        });

        socket.on('joinRoomSuccess', (data) => {
          this.log('info', `User ${userId} joined room ${roomId} with ${data.participants?.length || 0} participants`);

          // Start sending messages
          this.sendMessages(socket, userId, roomId);
        });

        socket.on('joinRoomError', (error) => {
          this.metrics.errorsConnection++;
          this.log('error', `User ${userId} failed to join room:`, error.message || JSON.stringify(error));
          socket.close();
          resolve();
        });

        socket.on('message', (data) => {
          this.metrics.messagesReceived++;

          // Mark message as read
          if (data._id) {
            socket.emit('markMessagesAsRead', {
              roomId: roomId,
              messageIds: [data._id]
            });
            this.metrics.messagesRead++;
          }
        });

        socket.on('messagesRead', (data) => {
          this.metrics.readAcksReceived++;
        });

        socket.on('error', (error) => {
          this.metrics.errorsMessage++;
          this.log('error', `User ${userId} received error:`, error);
        });

        socket.on('disconnect', (reason) => {
          this.metrics.disconnected++;
          this.log('warn', `User ${userId} disconnected:`, reason);
          resolve();
        });

        socket.on('connect_error', (error) => {
          this.metrics.errorsConnection++;
          this.log('error', `User ${userId} connection error:`, error.message);
          socket.close();
          resolve();
        });
      });

    } catch (error) {
      this.metrics.errorsConnection++;
      this.log('error', `User ${userId} simulation failed:`, error.message);
    }
  }

  async sendMessages(socket, userId, roomId) {
    const messageCount = this.config.messages;
    const minDelay = 1000; // 1 second
    const maxDelay = 3000; // 3 seconds

    for (let i = 0; i < messageCount; i++) {
      // Random delay between messages
      const delay = Math.random() * (maxDelay - minDelay) + minDelay;
      await this.sleep(delay);

      const startTime = Date.now();

      try {
        socket.emit('chatMessage', {
          room: roomId,
          type: 'text',
          content: `Load test message ${i + 1}/${messageCount} from user ${userId} at ${new Date().toISOString()}`
        });

        this.metrics.messagesSent++;
        this.metrics.latencies.push(Date.now() - startTime);

      } catch (error) {
        this.metrics.errorsMessage++;
        this.log('error', `User ${userId} failed to send message ${i + 1}:`, error.message);
      }
    }

    // After all messages sent, wait a bit then disconnect
    await this.sleep(5000);
    socket.close();
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  printMetrics() {
    const elapsed = ((Date.now() - this.metrics.startTime) / 1000).toFixed(1);
    const avgLatency = this.metrics.latencies.length > 0
      ? (this.metrics.latencies.reduce((a, b) => a + b, 0) / this.metrics.latencies.length).toFixed(2)
      : 0;
    const avgConnectionTime = this.metrics.connectionTimes.length > 0
      ? (this.metrics.connectionTimes.reduce((a, b) => a + b, 0) / this.metrics.connectionTimes.length).toFixed(2)
      : 0;

    const p95Latency = this.metrics.latencies.length > 0
      ? this.getPercentile(this.metrics.latencies, 95).toFixed(2)
      : 0;
    const p99Latency = this.metrics.latencies.length > 0
      ? this.getPercentile(this.metrics.latencies, 99).toFixed(2)
      : 0;

    const table = new Table({
      head: [chalk.cyan('Metric'), chalk.cyan('Value')],
      colWidths: [30, 20]
    });

    table.push(
      ['Elapsed Time', `${elapsed}s`],
      ['---', '---'],
      [chalk.green('Users Created'), this.metrics.usersCreated],
      [chalk.green('Connected'), this.metrics.connected],
      [chalk.yellow('Disconnected'), this.metrics.disconnected],
      ['---', '---'],
      [chalk.green('Messages Sent'), this.metrics.messagesSent],
      [chalk.green('Messages Received'), this.metrics.messagesReceived],
      [chalk.cyan('Messages Marked Read'), this.metrics.messagesRead],
      [chalk.cyan('Read Acks Received'), this.metrics.readAcksReceived],
      ['Messages/sec', (this.metrics.messagesSent / elapsed).toFixed(2)],
      ['---', '---'],
      ['Avg Message Latency', `${avgLatency}ms`],
      ['P95 Message Latency', `${p95Latency}ms`],
      ['P99 Message Latency', `${p99Latency}ms`],
      ['Avg Connection Time', `${avgConnectionTime}ms`],
      ['---', '---'],
      [chalk.red('Auth Errors'), this.metrics.errorsAuth],
      [chalk.red('Connection Errors'), this.metrics.errorsConnection],
      [chalk.red('Message Errors'), this.metrics.errorsMessage],
      [chalk.red('Total Errors'), this.metrics.errorsAuth + this.metrics.errorsConnection + this.metrics.errorsMessage]
    );

    // Clear screen and redraw
    console.clear();
    console.log(chalk.bold.cyan('\n=== KTB Chat Load Test - Real-time Metrics ===\n'));
    console.log(table.toString());
    console.log('');

    // Print recent logs
    if (this.logBuffer.length > 0) {
      console.log(chalk.bold.white('Recent Activity:'));
      console.log(chalk.gray('─'.repeat(80)));
      this.logBuffer.forEach(({ level, message }) => {
        switch (level) {
          case 'info':
            console.log(chalk.blue(message));
            break;
          case 'success':
            console.log(chalk.green(message));
            break;
          case 'warn':
            console.log(chalk.yellow(message));
            break;
          case 'error':
            console.log(chalk.red(message));
            break;
          default:
            console.log(message);
        }
      });
      console.log(chalk.gray('─'.repeat(80)));
    }
  }

  getPercentile(arr, percentile) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  async run() {
    const { totalUsers, rampUpTime, batchSize, batchDelay } = this.config;
    const totalBatches = Math.ceil(totalUsers / batchSize);

    console.log(chalk.bold.cyan('\n=== KTB Chat Load Test ===\n'));
    console.log(chalk.white('Configuration:'));
    console.log(chalk.gray(`  Users:           ${totalUsers}`));
    console.log(chalk.gray(`  Ramp-up time:    ${rampUpTime}s`));
    console.log(chalk.gray(`  Batch size:      ${batchSize} users/batch`));
    console.log(chalk.gray(`  Batch delay:     ${batchDelay}ms`));
    console.log(chalk.gray(`  Total batches:   ${totalBatches}`));
    console.log(chalk.gray(`  Messages/user:   ${this.config.messages}`));
    console.log(chalk.gray(`  API URL:         ${this.config.apiUrl}`));
    console.log(chalk.gray(`  Socket.IO URL:   ${this.config.socketUrl}`));
    console.log(chalk.gray(`  Room ID:         ${this.config.roomId || 'auto-create'}`));
    console.log('');

    // Create or get test room
    let roomId;
    try {
      roomId = await this.createTestRoom();
    } catch (error) {
      this.log('error', 'Failed to setup test room. Aborting test.');
      process.exit(1);
    }

    this.log('info', `Starting load test: ${totalUsers} users in ${totalBatches} batches`);
    this.log('info', `Batch configuration: ${batchSize} users every ${batchDelay}ms`);
    this.log('info', `Target room: ${roomId}`);

    // Show initial metrics
    this.printMetrics();

    // Start metrics reporting (every 2 seconds for more responsive UI)
    this.metricsInterval = setInterval(() => this.printMetrics(), 2000);

    // Create users in batches
    const promises = [];
    for (let batch = 0; batch < totalBatches; batch++) {
      const batchStart = batch * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, totalUsers);
      const batchNum = batch + 1;

      this.log('info', `Spawning batch ${batchNum}/${totalBatches} (users ${batchStart}-${batchEnd - 1})...`);

      // Spawn all users in this batch simultaneously
      for (let i = batchStart; i < batchEnd; i++) {
        promises.push(this.simulateUser(i, roomId));
      }

      // Wait before starting next batch (except for the last batch)
      if (batch < totalBatches - 1) {
        await this.sleep(batchDelay);
      }
    }

    this.log('info', 'All users spawned, waiting for completion...');

    // Wait for all users to complete
    await Promise.all(promises);

    // Stop metrics reporting and print final report
    clearInterval(this.metricsInterval);
    this.printMetrics();

    console.log(chalk.bold.green('\n✓ Load test completed!\n'));
    process.exit(0);
  }
}

// Main execution
const tester = new LoadTester({
  apiUrl: argv.apiUrl,
  socketUrl: argv.socketUrl,
  roomId: argv.roomId,
  totalUsers: argv.users,
  rampUpTime: argv.rampup,
  duration: argv.duration,
  messages: argv.messages,
  batchSize: argv.batchSize,
  batchDelay: argv.batchDelay
});

tester.run().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
