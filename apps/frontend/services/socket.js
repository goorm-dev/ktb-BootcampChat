import { io } from 'socket.io-client';

const CLEANUP_REASONS = {
  DISCONNECT: 'disconnect',
  MANUAL: 'manual',
  RECONNECT: 'reconnect'
};

class SocketService {
  constructor() {
    this.socket = null;
    this.heartbeatInterval = null;
    this.messageHandlers = new Map();
    this.messageQueue = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.isReconnecting = false;
    this.connectionPromise = null;
    this.retryDelay = 3000;
    this.reactionHandlers = new Set();
    this.connected = false;
  }

  async connect(options = {}) {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    if (this.socket?.connected) {
      return Promise.resolve(this.socket);
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        if (this.socket) {
          this.cleanup(CLEANUP_REASONS.RECONNECT);
        }

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;

        this.socket = io(socketUrl, {
          ...options,
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: this.retryDelay,
          reconnectionDelayMax: 5000,
          timeout: 20000,
          forceNew: true
        });

        this.setupEventHandlers(resolve, reject);

      } catch (error) {
        this.connectionPromise = null;
        reject(error);
      }
    }).finally(() => {
      this.connectionPromise = null;
    });

    return this.connectionPromise;
  }

  setupEventHandlers(resolve, reject) {
    const connectionTimeout = setTimeout(() => {
      if (!this.socket?.connected) {
        reject(new Error('Connection timeout'));
      }
    }, 30000);

    this.socket.on('connect', () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      clearTimeout(connectionTimeout);
      this.startHeartbeat();
      resolve(this.socket);
    });

    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      this.cleanup(CLEANUP_REASONS.DISCONNECT);
    });

    this.socket.on('connect_error', (error) => {
      console.log('Socket connection error:', error.message);
      if (error.message === 'Invalid session') {
        reject(error);
        return;
      }
      if (error.message === 'websocket error') {
        this.reconnectAttempts++;
      }
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        clearTimeout(connectionTimeout);
        reject(error);
      }
    });

    // duplicate_login 이벤트 수신
    // type: 'new_login_attempt' - 새로 로그인한 디바이스
    // type: 'existing_session' - 기존 세션이 있던 디바이스 (다른 곳에서 로그인함)
    this.socket.on('duplicate_login', (data) => {
      // TODO: 향후 중복 로그인 처리 필요 시 AuthContext에서 구현
    });

    this.socket.on('error', (error) => {
      this.handleSocketError(error);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      this.connected = true;
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      this.processMessageQueue();
    });

    this.socket.on('reconnect_failed', () => {
      this.cleanup(CLEANUP_REASONS.MANUAL);
      reject(new Error('Reconnection failed'));
    });

    this.socket.on('messageReaction', (data) => {
      this.reactionHandlers.forEach(handler => handler(data));
    });
  }

  cleanup(reason = CLEANUP_REASONS.MANUAL) {
    if (reason === CLEANUP_REASONS.DISCONNECT && this.isReconnecting) {
      return;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (reason !== CLEANUP_REASONS.RECONNECT) {
      this.reactionHandlers.clear();
    }

    if (reason !== CLEANUP_REASONS.RECONNECT) {
      this.messageQueue = [];
    }

    if (reason === CLEANUP_REASONS.MANUAL && this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    if (reason === CLEANUP_REASONS.MANUAL) {
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      this.connectionPromise = null;
      this.connected = false;
    }
  }

  disconnect() {
    this.cleanup(CLEANUP_REASONS.MANUAL);
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  handleConnectionError(error) {
    this.reconnectAttempts++;

    if (error.message.includes('auth')) {
      return;
    }

    if (error.message.includes('websocket error')) {
      if (this.socket) {
        this.socket.io.opts.transports = ['polling', 'websocket'];
      }
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.cleanup(CLEANUP_REASONS.MANUAL);
      this.isReconnecting = false;
    }
  }

  handleSocketError(error) {
    if (error.type === 'TransportError') {
      this.reconnect();
    }
  }

  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping', null, (error) => {
          if (error) {
            this.cleanup(CLEANUP_REASONS.MANUAL);
          }
        });
      } else {
        this.cleanup(CLEANUP_REASONS.MANUAL);
      }
    }, 25000);
  }

  getSocket() {
    return this.socket;
  }

  queueMessage(event, data) {
    const message = { event, data, timestamp: Date.now() };
    this.messageQueue.push(message);
  }

  processMessageQueue() {
    const now = Date.now();
    const validMessages = this.messageQueue.filter(msg => now - msg.timestamp < 300000);

    while (validMessages.length > 0) {
      const message = validMessages.shift();
      try {
        this.socket.emit(message.event, message.data);
      } catch (error) {
        // Silent error handling
      }
    }

    this.messageQueue = validMessages;
  }

  async emit(event, data) {
    try {
      if (!this.socket?.connected) {
        await this.connect();
      }
      
      return new Promise((resolve, reject) => {
        if (!this.socket?.connected) {
          reject(new Error('Socket is not connected'));
          return;
        }

        const timeout = setTimeout(() => {
          reject(new Error('Socket event timeout'));
        }, 10000);

        this.socket.emit(event, data, (response) => {
          clearTimeout(timeout);
          if (response?.error) {
            reject(response.error);
          } else {
            resolve(response);
          }
        });
      });
    } catch (error) {
      this.queueMessage(event, data);
      throw error;
    }
  }

  on(event, callback) {
    if (!this.socket) {
      this.messageHandlers.set(event, callback);
      return;
    }

    this.socket.on(event, callback);
  }

  off(event, callback) {
    if (!this.socket) {
      this.messageHandlers.delete(event);
      return;
    }

    this.socket.off(event, callback);
  }

  async reconnect() {
    if (this.isReconnecting) return;

    this.isReconnecting = true;
    this.cleanup(CLEANUP_REASONS.RECONNECT);

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    try {
      await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      await this.connect();
    } catch (error) {
      this.isReconnecting = false;
      throw error;
    }
  }

  isConnected() {
    return this.connected && this.socket?.connected;
  }

  getConnectionQuality() {
    if (!this.socket?.connected) return 'disconnected';
    if (this.isReconnecting) return 'reconnecting';
    if (this.socket.conn?.transport?.name === 'polling') return 'poor';
    return 'good';
  }

  async addReaction(messageId, reaction, user) {
    try {
      if (!user) {
        throw new Error('Authentication required');
      }

      await this.emit('messageReaction', {
        messageId,
        reaction,
        add: true
      });
    } catch (error) {
      throw error;
    }
  }

  async removeReaction(messageId, reaction, user) {
    try {
      if (!user) {
        throw new Error('Authentication required');
      }

      await this.emit('messageReaction', {
        messageId,
        reaction,
        add: false
      });
    } catch (error) {
      throw error;
    }
  }

  onReactionUpdate(handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    this.reactionHandlers.add(handler);
    return () => this.reactionHandlers.delete(handler);
  }

  async toggleReaction(messageId, reaction, user) {
    try {
      if (!user) {
        throw new Error('Authentication required');
      }

      await this.emit('messageReaction', {
        messageId,
        reaction,
        toggle: true
      });
    } catch (error) {
      throw error;
    }
  }
}

const socketService = new SocketService();

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (!socketService.isConnected() && !socketService.isReconnecting) {
      socketService.connect();
    }
  });

  window.addEventListener('offline', () => {
    socketService.disconnect();
  });
}

export default socketService;
