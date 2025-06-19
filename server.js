// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS enabled for development
// In production, configure origin more restrictively for security
const io = new Server(server, {
    cors: {
        origin: "*", // Allows all origins for development. Be more specific in production (e.g., "http://localhost:3001").
        methods: ["GET", "POST"]
    }
});

// Changed PORT to 3001 to avoid common 'address already in use' issues
const PORT = process.env.PORT || 6001;

// In-memory storage for chat data (data will be lost if server restarts)
const users = {}; // Stores socket.id -> username mapping
const onlineUsernames = new Set(); // Stores unique online usernames
const typingUsers = new Set(); // Stores usernames currently typing

// Serve static files from the 'public' directory
// This makes 'index.html', 'style.css', 'client.js' accessible to the browser
app.use(express.static(path.join(__dirname, 'public')));

// Route for the main chat page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle 'user joined' event from client
    socket.on('user joined', (username) => {
        // Basic validation: username should not be empty and must be unique
        if (!username || onlineUsernames.has(username)) {
            const errorMessage = onlineUsernames.has(username) ? 'This username is already taken.' : 'Username cannot be empty.';
            socket.emit('username taken', errorMessage);
            console.log(`Join attempt failed for ${username}: ${errorMessage}`);
            return; // Do not proceed if username is invalid or taken
        }

        // Store user details
        users[socket.id] = username;
        onlineUsernames.add(username);
        console.log(`User ${username} (${socket.id}) joined the chat.`);

        // Notify the joining client that they successfully joined
        socket.emit('user joined success');

        // Broadcast to all other clients that a new user has joined
        socket.broadcast.emit('user joined', username);
        // Update the list of online users for all clients
        io.emit('update users', Array.from(onlineUsernames));

        // Send a system welcome message to the newly joined user
        socket.emit('chat message', {
            sender: 'System',
            text: `Welcome, ${username}!`,
            timestamp: new Date().toISOString(),
            isSystem: true
        });

        // Inform other users in the chat that a new user has joined
        socket.broadcast.emit('chat message', {
            sender: 'System',
            text: `${username} has joined the chat.`,
            timestamp: new Date().toISOString(),
            isSystem: true
        });
    });

    // Handle 'chat message' event from client
    socket.on('chat message', (msg) => {
        const username = users[socket.id];
        if (username && msg.trim()) { // Ensure sender has a username and message is not empty
            console.log(`Message from ${username}: "${msg}"`);
            // Broadcast the message to all connected clients
            io.emit('chat message', {
                sender: username,
                text: msg,
                timestamp: new Date().toISOString() // Use server-side timestamp for consistency
            });

            // If the user was typing, clear their typing status after sending a message
            if (typingUsers.has(username)) {
                typingUsers.delete(username);
                io.emit('typing status', Array.from(typingUsers));
            }
        }
    });

    // Handle 'typing' event from client
    socket.on('typing', () => {
        const username = users[socket.id];
        if (username && !typingUsers.has(username)) { // Add to typing list only if not already there
            typingUsers.add(username);
            io.emit('typing status', Array.from(typingUsers)); // Broadcast typing status to all clients
        }
    });

    // Handle 'stop typing' event from client
    socket.on('stop typing', () => {
        const username = users[socket.id];
        if (username && typingUsers.has(username)) { // Remove from typing list if present
            typingUsers.delete(username);
            io.emit('typing status', Array.from(typingUsers)); // Broadcast updated typing status
        }
    });

    // Handle user disconnection
    socket.on('disconnect', () => {
        const username = users[socket.id];
        if (username) {
            // Remove user from all in-memory lists
            onlineUsernames.delete(username);
            typingUsers.delete(username);
            delete users[socket.id];
            console.log(`User ${username} (${socket.id}) disconnected.`);

            // Inform other users that this user has left
            socket.broadcast.emit('user left', username);
            // Update online users and typing status for all remaining clients
            io.emit('update users', Array.from(onlineUsernames));
            io.emit('typing status', Array.from(typingUsers));
        } else {
            console.log(`Unknown user disconnected: ${socket.id}`);
        }
    });
});

// Start the server and listen for incoming connections
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Access the chat application at http://localhost:${PORT}`);
});
