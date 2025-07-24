// Debug script to test chat functionality in browser console
// Copy and paste this into browser console to test

console.log('=== Chat Debug Test ===');

// Test 1: Check if socket is connected
if (typeof window !== 'undefined' && window.socketService) {
  console.log('Socket service available:', !!window.socketService);
  console.log('Socket connected:', window.socketService.isConnected?.());
} else {
  console.log('Socket service not available on window');
}

// Test 2: Check current user
if (typeof window !== 'undefined' && window.authService) {
  const user = window.authService.getCurrentUser?.();
  console.log('Current user:', user ? 'Logged in' : 'Not logged in');
  console.log('User ID:', user?.id);
} else {
  console.log('Auth service not available on window');
}

// Test 3: Check room state
const roomId = window.location.pathname.includes('/chat') ? 
  new URLSearchParams(window.location.search).get('room') : null;
console.log('Current room ID:', roomId);

// Test 4: Try to emit a test message (if socket exists)
if (typeof window !== 'undefined' && window.io?.sockets) {
  console.log('Socket.io available');
  const socket = Object.values(window.io.sockets)[0];
  if (socket) {
    console.log('Socket found, testing emit...');
    socket.emit('test', { message: 'Debug test' });
  }
}

console.log('=== End Debug Test ===');
