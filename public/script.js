document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const messagesContainer = document.getElementById('messages');
    const usernameInput = document.getElementById('username-input');
    const roomList = document.getElementById('room-list');
    const userList = document.getElementById('user-list');
    const currentRoomDisplay = document.getElementById('current-room');
    const leaveRoomBtn = document.getElementById('leave-room-btn');
    const createRoomBtn = document.getElementById('create-room-btn');
    const fileBtn = document.getElementById('file-btn');
    
    // App state
    let userId;
    let username;
    let currentRoom = 'general';
    let socket;
    
    // Initialize the app
    init();
    
    function init() {
        connectWebSocket();
        setupEventListeners();
    }
    
    function connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        socket = new WebSocket(`${protocol}//${host}/ws`);
        
        socket.onopen = () => {
            console.log('Connected to WebSocket server');
        };
        
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleServerMessage(data);
        };
        
        socket.onclose = () => {
            console.log('Disconnected from WebSocket server');
            showNotification('Disconnected from server. Reconnecting...');
            setTimeout(connectWebSocket, 3000);
        };
        
        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            showNotification('Connection error. Trying to reconnect...');
        };
    }
    
    function setupEventListeners() {
        // Send message on button click or Enter key
        sendBtn.addEventListener('click', sendMessage);
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // Set username
        usernameInput.addEventListener('change', () => {
            const newUsername = usernameInput.value.trim();
            if (newUsername && newUsername !== username) {
                username = newUsername;
                document.querySelector('.avatar').textContent = username.charAt(0).toUpperCase();
                
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({
                        type: 'setUsername',
                        username: newUsername
                    }));
                }
            }
        });
        
        // Join room when clicking on room list
        roomList.addEventListener('click', (e) => {
            if (e.target.classList.contains('room')) {
                const room = e.target.dataset.room;
                if (room !== currentRoom) {
                    joinRoom(room);
                }
            }
        });
        
        // Leave room button
        leaveRoomBtn.addEventListener('click', () => {
            if (currentRoom) {
                leaveRoom();
            }
        });
        
        // Create room button
        createRoomBtn.addEventListener('click', () => {
            const roomName = prompt('Enter new room name:');
            if (roomName && roomName.trim()) {
                // In a real app, you'd send this to the server to create the room
                alert(`Room "${roomName}" would be created in a full implementation.`);
            }
        });
        
        // File button
        fileBtn.addEventListener('click', () => {
            alert('File sharing would be implemented here in a full version.');
        });
    }
    
    function handleServerMessage(data) {
        switch (data.type) {
            case 'init':
                handleInit(data);
                break;
            case 'roomJoined':
                handleRoomJoined(data);
                break;
            case 'userJoined':
                handleUserJoined(data);
                break;
            case 'userLeft':
                handleUserLeft(data);
                break;
            case 'message':
                handleChatMessage(data);
                break;
            case 'privateMessage':
                handlePrivateMessage(data);
                break;
            case 'userList':
                updateUserList(data.users);
                break;
        }
    }
    
    function handleInit(data) {
        userId = data.userId;
        username = data.username;
        usernameInput.value = username;
        document.querySelector('.avatar').textContent = username.charAt(0).toUpperCase();
        
        // Highlight current room
        const roomElements = document.querySelectorAll('.room');
        roomElements.forEach(el => {
            el.classList.toggle('active', el.dataset.room === currentRoom);
        });
        
        updateUserList(data.users);
    }
    
    function handleRoomJoined(data) {
        currentRoom = data.room;
        currentRoomDisplay.textContent = currentRoom;
        messagesContainer.innerHTML = '';
        
        // Update active room in UI
        const roomElements = document.querySelectorAll('.room');
        roomElements.forEach(el => {
            el.classList.toggle('active', el.dataset.room === currentRoom);
        });
        
        // Load chat history (in a real app)
        if (data.history && data.history.length > 0) {
            data.history.forEach(msg => {
                addMessageToChat(msg);
            });
        }
    }
    
    function handleUserJoined(data) {
        if (data.room === currentRoom) {
            const notification = document.createElement('div');
            notification.className = 'notification-message';
            notification.textContent = `${data.username} joined the room`;
            messagesContainer.appendChild(notification);
        }
    }
    
    function handleUserLeft(data) {
        if (data.room === currentRoom) {
            const notification = document.createElement('div');
            notification.className = 'notification-message';
            notification.textContent = `${data.username} left the room`;
            messagesContainer.appendChild(notification);
        }
    }
    
    function handleChatMessage(data) {
        if (data.room === currentRoom) {
            addMessageToChat(data);
        }
    }
    
    function handlePrivateMessage(data) {
        // In a real app, you'd have a separate UI for private messages
        showNotification(`Private message from ${data.fromUsername}: ${data.message}`);
    }
    
    function sendMessage() {
        const message = messageInput.value.trim();
        if (message && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'message',
                room: currentRoom,
                message: message
            }));
            
            // Add message to UI immediately (optimistic update)
            addMessageToChat({
                from: userId,
                username: username,
                message: message,
                timestamp: new Date().toISOString()
            });
            
            messageInput.value = '';
        }
    }
    
    function joinRoom(room) {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'joinRoom',
                room: room
            }));
        }
    }
    
    function leaveRoom() {
        if (socket.readyState === WebSocket.OPEN && currentRoom) {
            socket.send(JSON.stringify({
                type: 'leaveRoom',
                room: currentRoom
            }));
            
            // Default to general room after leaving
            joinRoom('general');
        }
    }
    
    function addMessageToChat(data) {
        const isCurrentUser = data.from === userId;
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${isCurrentUser ? 'current-user' : ''}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = data.username.charAt(0).toUpperCase();
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        const header = document.createElement('div');
        header.className = 'message-header';
        
        const usernameElement = document.createElement('span');
        usernameElement.className = 'message-username';
        usernameElement.textContent = data.username;
        
        const timeElement = document.createElement('span');
        timeElement.className = 'message-time';
        timeElement.textContent = formatTime(data.timestamp);
        
        const textElement = document.createElement('div');
        textElement.className = 'message-text';
        textElement.textContent = data.message;
        
        header.appendChild(usernameElement);
        header.appendChild(timeElement);
        
        content.appendChild(header);
        content.appendChild(textElement);
        
        messageElement.appendChild(avatar);
        messageElement.appendChild(content);
        
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    function updateUserList(users) {
        userList.innerHTML = '';
        
        users.forEach(user => {
            if (user.id !== userId) { // Don't show ourselves in the list
                const userElement = document.createElement('li');
                userElement.className = 'user-item';
                userElement.dataset.userId = user.id;
                
                const avatar = document.createElement('div');
                avatar.className = 'avatar small';
                avatar.textContent = user.username.charAt(0).toUpperCase();
                
                const usernameElement = document.createElement('span');
                usernameElement.className = 'username';
                usernameElement.textContent = user.username;
                
                const status = document.createElement('div');
                status.className = `status ${user.status}`;
                status.textContent = user.currentRoom ? `In ${user.currentRoom}` : 'Online';
                
                userElement.appendChild(avatar);
                userElement.appendChild(usernameElement);
                userElement.appendChild(status);
                
                userList.appendChild(userElement);
                
                // Add click handler for private messages
                userElement.addEventListener('click', () => {
                    const message = prompt(`Send private message to ${user.username}:`);
                    if (message && message.trim()) {
                        socket.send(JSON.stringify({
                            type: 'privateMessage',
                            toUserId: user.id,
                            message: message.trim()
                        }));
                    }
                });
            }
        });
    }
    
    function formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    function showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        notification.style.display = 'block';
        setTimeout(() => {
            notification.style.display = 'none';
            document.body.removeChild(notification);
        }, 3000);
    }
});