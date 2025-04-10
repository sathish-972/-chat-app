const express = require('express');
const WebSocket = require('ws');
const uuid = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Create HTTP server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected users and chat rooms
const users = new Map();
const chatRooms = {
  'general': new Set(),
  'random': new Set()
};

wss.on('connection', (ws) => {
  const userId = uuid.v4();
  let username = `User-${Math.floor(Math.random() * 1000)}`;
  let currentRoom = null;

  console.log(`New connection: ${userId}`);

  // Add user to the users map
  users.set(userId, { ws, username, currentRoom });

  // Send initial data to client
  ws.send(JSON.stringify({
    type: 'init',
    userId,
    username,
    rooms: Object.keys(chatRooms),
    users: Array.from(users.values()).map(u => ({
      id: userId,
      username: u.username,
      status: 'online'
    }))
  }));

  // Handle messages from client
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleMessage(userId, data);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  // Handle disconnection
  ws.on('close', () => {
    if (currentRoom) {
      leaveRoom(userId, currentRoom);
    }
    users.delete(userId);
    broadcastUserList();
    console.log(`User disconnected: ${userId}`);
  });

  // Message handler
  function handleMessage(userId, data) {
    const user = users.get(userId);
    if (!user) return;

    switch (data.type) {
      case 'setUsername':
        user.username = data.username;
        broadcastUserList();
        break;
      case 'joinRoom':
        leaveRoom(userId, user.currentRoom);
        joinRoom(userId, data.room);
        break;
      case 'leaveRoom':
        leaveRoom(userId, data.room);
        break;
      case 'message':
        sendMessage(userId, data.room, data.message);
        break;
      case 'privateMessage':
        sendPrivateMessage(userId, data.toUserId, data.message);
        break;
    }
  }

  // Join a room
  function joinRoom(userId, room) {
    if (!room || !chatRooms[room]) return;

    const user = users.get(userId);
    if (!user) return;

    user.currentRoom = room;
    chatRooms[room].add(userId);

    // Notify user
    user.ws.send(JSON.stringify({
      type: 'roomJoined',
      room,
      history: [] // In a real app, you'd fetch chat history here
    }));

    // Notify others in the room
    broadcastToRoom(room, {
      type: 'userJoined',
      userId,
      username: user.username
    });

    broadcastUserList();
  }

  // Leave a room
  function leaveRoom(userId, room) {
    if (!room || !chatRooms[room] || !chatRooms[room].has(userId)) return;

    const user = users.get(userId);
    if (!user) return;

    chatRooms[room].delete(userId);
    user.currentRoom = null;

    // Notify others in the room
    broadcastToRoom(room, {
      type: 'userLeft',
      userId,
      username: user.username
    });

    broadcastUserList();
  }

  // Send message to a room
  function sendMessage(userId, room, message) {
    if (!room || !chatRooms[room] || !chatRooms[room].has(userId)) return;

    const user = users.get(userId);
    if (!user) return;

    const messageData = {
      type: 'message',
      room,
      from: userId,
      username: user.username,
      message,
      timestamp: new Date().toISOString()
    };

    broadcastToRoom(room, messageData);
  }

  // Send private message
  function sendPrivateMessage(fromUserId, toUserId, message) {
    const fromUser = users.get(fromUserId);
    const toUser = users.get(toUserId);

    if (!fromUser || !toUser) return;

    const messageData = {
      type: 'privateMessage',
      from: fromUserId,
      fromUsername: fromUser.username,
      message,
      timestamp: new Date().toISOString()
    };

    // Send to recipient
    toUser.ws.send(JSON.stringify(messageData));

    // Send back to sender for their own chat UI
    fromUser.ws.send(JSON.stringify({
      ...messageData,
      to: toUserId,
      toUsername: toUser.username
    }));
  }

  // Broadcast to all users in a room
  function broadcastToRoom(room, data) {
    if (!chatRooms[room]) return;

    chatRooms[room].forEach(userId => {
      const user = users.get(userId);
      if (user && user.ws.readyState === WebSocket.OPEN) {
        user.ws.send(JSON.stringify(data));
      }
    });
  }

  // Broadcast updated user list to all clients
  function broadcastUserList() {
    const userList = Array.from(users.values()).map(user => ({
      id: userId,
      username: user.username,
      status: 'online',
      currentRoom: user.currentRoom
    }));

    const message = {
      type: 'userList',
      users: userList
    };

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }
});