import { io } from 'socket.io-client';
// Icons imported but not used in this file
import { Toast } from '../components/Toast';
import authService from './authService';

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
    this.retryDelay = 1000;
    this.duplicateLoginTimeout = 30000;
    this.reactionHandlers = new Set();
    this.connected = false;
  }

  async handleDuplicateLogin(data) {
    try {
      const { deviceInfo = 'Unknown Device', ipAddress = 'Unknown IP' } = data;

      // 전역 이벤트 발생
      const duplicateLoginEvent = new CustomEvent('duplicateLogin', {
        detail: {
          deviceInfo,
          ipAddress,
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(duplicateLoginEvent);

      // 10초 후에 강제 로그아웃 처리
      setTimeout(async () => {
        try {
          if (this.socket?.connected) {
            await this.emit('force_login', {
              token: authService.getCurrentUser()?.token
            });
          }
        } catch (error) {
          console.error('Force login error:', error);
          await authService.logout();
          window.location.href = '/';
        }
      }, 10000);

    } catch (error) {
      console.error('[Socket] Error handling duplicate login:', error);
      await authService.logout();
      window.location.href = '/?error=session_error';
    }
  }

  async connect(options = {}) {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    if (this.socket?.connected) {
      console.log('[Socket] Already connected');
      return Promise.resolve(this.socket);
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        console.log('[Socket] Starting connection...');

        if (this.socket) {
          console.log('[Socket] Cleaning up existing socket before new connection');
          this.cleanup(CLEANUP_REASONS.RECONNECT);
        }
        
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
        console.log('[Socket] Connecting to:', socketUrl);

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
        console.error('[Socket] Setup error:', error);
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
        console.error('[Socket] Connection timeout');
        reject(new Error('Connection timeout'));
      }
    }, 30000);

    this.socket.on('connect', () => {
      console.log('[Socket] Connected successfully');
      this.connected = true;
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      clearTimeout(connectionTimeout);
      this.startHeartbeat();
      resolve(this.socket);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      this.connected = false;
      this.cleanup(CLEANUP_REASONS.DISCONNECT);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
      
      if (error.message === 'Invalid session') {
        authService.refreshToken()
          .then(() => this.reconnect())
          .catch(() => {
            authService.logout();
            reject(error);
          });
        return;
      }

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        clearTimeout(connectionTimeout);
        reject(error);
      }
    });

    this.socket.on('duplicate_login', async (data) => {
      console.log('[Socket] Duplicate login detected:', data);
      if (data.type === 'new_login_attempt') {
        await this.handleDuplicateLogin(data);
      } else if (data.type === 'existing_session') {
        console.log('[Socket] Existing session displaced');
        // Modal로 대체되었으므로 Toast 제거
        const duplicateLoginEvent = new CustomEvent('duplicateLogin', {
          detail: {
            deviceInfo: data.deviceInfo,
            ipAddress: data.ipAddress,
            timestamp: Date.now()
          }
        });
        window.dispatchEvent(duplicateLoginEvent);
      }
    });

    this.socket.on('error', (error) => {
      console.error('[Socket] Socket error:', error);
      this.handleSocketError(error);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`[Socket] Reconnected after ${attemptNumber} attempts`);
      this.connected = true;
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      this.processMessageQueue();
    });

    this.socket.on('reconnect_failed', () => {
      console.error('[Socket] Reconnection failed');
      this.cleanup(CLEANUP_REASONS.MANUAL);
      reject(new Error('Reconnection failed'));
    });

    this.socket.on('messageReaction', (data) => {
      console.log('[Socket] Message reaction:', data);
      this.reactionHandlers.forEach(handler => handler(data));
    });
  }

  cleanup(reason = CLEANUP_REASONS.MANUAL) {
    if (reason === CLEANUP_REASONS.DISCONNECT && this.isReconnecting) {
      return;
    }

    console.log(`[Socket] Cleanup started (reason: ${reason})`);

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
      console.log("[Socket] Disconnecting socket during cleanup");
      this.socket.disconnect();
      this.socket = null;
    }

    if (reason === CLEANUP_REASONS.MANUAL) {
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      this.connectionPromise = null;
      this.connected = false;
    }

    console.log(`[Socket] Cleanup completed (reason: ${reason})`);
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
    console.error(`Connection error (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}):`, error);

    if (error.message.includes('auth')) {
      authService.refreshToken()
        .then(() => this.reconnect())
        .catch(() => authService.logout());
      return;
    }

    if (error.message.includes('websocket error')) {
      if (this.socket) {
        this.socket.io.opts.transports = ['polling', 'websocket'];
      }
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.cleanup(CLEANUP_REASONS.MANUAL);
      this.isReconnecting = false;
    }
  }

  handleSocketError(error) {
    console.error('Socket error:', error);
    if (error.type === 'TransportError') {
      this.reconnect();
    }
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('socketError', { 
        detail: { error } 
      }));
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
            console.error('Heartbeat failed:', error);
            this.cleanup(CLEANUP_REASONS.MANUAL);
          } else {
            console.debug('Heartbeat succeeded');
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
    console.log(`Message queued: ${event}`, message);
  }

  processMessageQueue() {
    const now = Date.now();
    const validMessages = this.messageQueue.filter(msg => now - msg.timestamp < 300000);

    let successCount = 0;
    let failureCount = 0;

    while (validMessages.length > 0) {
      const message = validMessages.shift();
      try {
        this.socket.emit(message.event, message.data);
        successCount++;
        console.log(`Queued message sent: ${message.event}`);
      } catch (error) {
        failureCount++;
        console.error(`Error sending queued message (${message.event}):`, error);
      }
    }

    if (successCount + failureCount > 0) {
      console.log(`Message queue processed: ${successCount} succeeded, ${failureCount} failed`);
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
      console.error('Error emitting event:', error);
      this.queueMessage(event, data);
      throw error;
    }
  }

  on(event, callback) {
    if (!this.socket) {
      console.warn('Socket is not initialized. Queuing event handler.');
      this.messageHandlers.set(event, callback);
      return;
    }
    
    this.socket.on(event, callback);
    if (event === 'aiMessageChunk') {
      this.messageHandlers.set('aiMessageChunk', callback);
    }
  }

  off(event, callback) {
    if (!this.socket) {
      this.messageHandlers.delete(event);
      return;
    }
    
    this.socket.off(event, callback);
    if (event === 'aiMessageChunk') {
      this.messageHandlers.delete('aiMessageChunk');
    }
  }

  async reconnect() {
    if (this.isReconnecting) return;

    console.log('Initiating manual reconnection...');
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
      console.error('Reconnection failed:', error);
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

  async addReaction(messageId, reaction) {
    try {
      const user = authService.getCurrentUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      await this.emit('messageReaction', {
        messageId,
        reaction,
        add: true
      });
    } catch (error) {
      console.error('Add reaction error:', error);
      throw error;
    }
  }

  async removeReaction(messageId, reaction) {
    try {
      const user = authService.getCurrentUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      await this.emit('messageReaction', {
        messageId,
        reaction,
        add: false
      });
    } catch (error) {
      console.error('Remove reaction error:', error);
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

  async toggleReaction(messageId, reaction) {
    try {
      const user = authService.getCurrentUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      await this.emit('messageReaction', {
        messageId,
        reaction,
        toggle: true
      });
    } catch (error) {
      console.error('Toggle reaction error:', error);
      throw error;
    }
  }
}

const socketService = new SocketService();

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Network is online');
    if (!socketService.isConnected() && !socketService.isReconnecting) {
      socketService.connect();
    }
  });

  window.addEventListener('offline', () => {
    console.log('Network is offline');
    socketService.disconnect();
  });
}

export default socketService;