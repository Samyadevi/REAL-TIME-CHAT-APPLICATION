// client.js

// Initial check to ensure Socket.IO client library is loaded.
if (typeof io === 'undefined') {
    console.error("Socket.IO client library not loaded! Please check the <script src='/socket.io/socket.io.js'></script> tag in index.html, and ensure your Node.js server is running and serving Socket.IO correctly.");
    const connectionStatus = document.getElementById('connectionStatus');
    if (connectionStatus) {
        connectionStatus.textContent = "Error: Socket.IO library failed to load. Server might not be running or path is incorrect.";
        connectionStatus.classList.remove('text-gray-500');
        connectionStatus.classList.add('text-red-500', 'font-bold');
    }
    throw new Error("Socket.IO client library is missing. Cannot proceed.");
}


const socket = io(); // Initialize Socket.IO connection to the server

// Get references to DOM elements
const usernameModal = document.getElementById('usernameModal');
const usernameInput = document.getElementById('usernameInput');
const joinChatBtn = document.getElementById('joinChatBtn');
const usernameError = document.getElementById('usernameError');
const connectionStatus = document.getElementById('connectionStatus'); // For displaying connection status

const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const messagesDiv = document.getElementById('messages');
const systemMessageEl = document.getElementById('systemMessage'); // The initial "Welcome to chat" message
const typingIndicator = document.getElementById('typingIndicator');

const onlineUsersToggle = document.getElementById('onlineUsersToggle');
const onlineUsersCount = document.getElementById('onlineUsersCount'); // The badge for displaying user count
const onlineUsersModal = document.getElementById('onlineUsersModal');
const onlineUsersList = document.getElementById('onlineUsersList'); // List inside the modal

// Log elements to console to verify they are found (useful for debugging "null" errors)
console.log("client.js loaded. Verifying DOM elements:");
console.log("usernameModal:", usernameModal);
console.log("joinChatBtn:", joinChatBtn);
console.log("messageInput:", messageInput);
console.log("connectionStatus:", connectionStatus);

// Critical check: if any essential DOM elements are missing, display error and stop script.
if (!usernameModal || !usernameInput || !joinChatBtn || !messagesDiv || !messageInput || !sendMessageBtn || !connectionStatus || !onlineUsersToggle || !onlineUsersCount || !onlineUsersModal || !onlineUsersList) {
    console.error("Critical DOM elements not found! Check your index.html IDs. Disabling chat functionality.");
    if (connectionStatus) {
        connectionStatus.textContent = "Error: Required chat elements not found. Check index.html IDs.";
        connectionStatus.classList.remove('text-gray-500');
        connectionStatus.classList.add('text-red-500', 'font-bold');
    }
    // Disable interactive elements if the UI isn't fully loaded
    if (joinChatBtn) joinChatBtn.disabled = true;
    if (messageInput) messageInput.disabled = true;
    if (sendMessageBtn) sendMessageBtn.disabled = true;
    throw new Error("Critical DOM elements are missing. Cannot proceed.");
}


let currentUser = ''; // Stores the username of the current user for sender/receiver distinction
let typing = false; // Flag to track if the current user is typing
let typingTimeout = undefined; // Timeout ID for typing indicator (to stop typing after inactivity)

// --- Socket.IO Connection Event Listeners ---

// Event fired when successfully connected to the Socket.IO server
socket.on('connect', () => {
    console.log('Successfully connected to Socket.IO server.');
    connectionStatus.textContent = "Connected to chat server!";
    connectionStatus.classList.remove('text-red-500', 'text-gray-500');
    connectionStatus.classList.add('text-green-500');
    // Briefly display "Connected" message, then hide it
    setTimeout(() => {
        if (connectionStatus.textContent === "Connected to chat server!") {
            connectionStatus.classList.add('hidden');
        }
    }, 2000); // Hide after 2 seconds
});

// Event fired when disconnected from the Socket.IO server
socket.on('disconnect', () => {
    console.warn('Disconnected from Socket.IO server. Attempting to reconnect...');
    connectionStatus.textContent = "Disconnected. Please refresh or check server.";
    connectionStatus.classList.remove('text-green-500', 'text-gray-500', 'hidden');
    connectionStatus.classList.add('text-red-500', 'font-bold');
    // Re-show username modal and disable chat input on disconnection
    usernameModal.classList.remove('hidden');
    messageInput.disabled = true;
    sendMessageBtn.disabled = true;
    currentUser = ''; // Clear current user
    onlineUsersCount.textContent = '0'; // Reset online user count
    onlineUsersCount.classList.remove('hidden'); // Ensure badge is visible if it was hidden
    onlineUsersList.innerHTML = ''; // Clear online user list
    typingIndicator.classList.add('hidden'); // Hide typing indicator
});

// Event fired when a connection error occurs (e.g., server not running)
socket.on('connect_error', (error) => {
    console.error("Socket.IO connection error:", error);
    connectionStatus.textContent = `Connection error: ${error.message}. Is server running?`;
    connectionStatus.classList.remove('text-green-500', 'text-gray-500', 'hidden');
    connectionStatus.classList.add('text-red-500', 'font-bold');
    // Re-show username modal on connection error
    usernameModal.classList.remove('hidden');
    messageInput.disabled = true;
    sendMessageBtn.disabled = true;
});


// --- Username Modal Logic ---

// Event listener for the "Join Chat" button click
joinChatBtn.addEventListener('click', () => {
    console.log("Join Chat button clicked!");
    const username = usernameInput.value.trim();
    if (username) {
        usernameError.classList.add('hidden'); // Hide any previous error messages
        usernameError.textContent = '';
        currentUser = username; // Set the current user's name
        socket.emit('user joined', username); // Emit 'user joined' event to the server
        console.log(`Emitted 'user joined' event with username: ${username}`);
    } else {
        console.log("Username is empty.");
        usernameError.textContent = 'Username cannot be empty.';
        usernameError.classList.remove('hidden'); // Show error message if username is empty
    }
});

// Allow pressing Enter key in the username input field to join chat
usernameInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        console.log("Enter key pressed in username input.");
        joinChatBtn.click(); // Simulate a click on the join button
    }
});

// --- Socket.IO Chat-Specific Event Listeners ---

// Handle 'username taken' event from the server
socket.on('username taken', (message) => {
    console.warn("Username taken:", message);
    usernameError.textContent = message;
    usernameError.classList.remove('hidden'); // Display the error message in the modal
    currentUser = ''; // Clear the user if username is taken
});

// Event fired when the server confirms successful user join
socket.on('user joined success', () => {
    console.log("Received 'user joined success' from server. Hiding modal.");
    usernameModal.classList.add('hidden'); // Hide the username modal
    messageInput.disabled = false; // Enable the message input field
    sendMessageBtn.disabled = false; // Enable the send message button
    messageInput.focus(); // Set focus to the message input
    // Hide the initial system message (e.g., "Welcome to the chat! Please enter your username.")
    if (systemMessageEl) {
        systemMessageEl.classList.add('hidden');
    }
});


// Listen for incoming chat messages from the server
socket.on('chat message', (msg) => {
    console.log("Received chat message:", msg);
    addMessageToDisplay(msg); // Add the message to the chat display
});

/**
 * Updates the online users count display with numbers and populates the online users list.
 * @param {string[]} usersArray - An array of usernames currently online.
 */
socket.on('update users', (usersArray) => {
    console.log("Online users updated:", usersArray);
    const userCount = usersArray.length;

    // Update the online users count badge with the numerical count
    onlineUsersCount.textContent = userCount.toString(); // Display the number
    if (userCount === 0) {
        onlineUsersCount.classList.add('hidden'); // Hide the badge entirely if 0 users
    } else {
        onlineUsersCount.classList.remove('hidden'); // Ensure badge is visible
    }

    // Populate the online users list inside the modal
    onlineUsersList.innerHTML = ''; // Clear the current list in the modal
    usersArray.forEach(user => {
        const li = document.createElement('li');
        li.classList.add('flex', 'items-center', 'space-x-2');
        li.innerHTML = `<span class="h-2 w-2 rounded-full bg-green-500"></span><span>${user}</span>`;
        onlineUsersList.appendChild(li);
    });
});

// Listen for typing status updates from the server
socket.on('typing status', (typingUsernames) => {
    // Filter out the current user from the list of typing users
    const othersTyping = typingUsernames.filter(username => username !== currentUser);
    if (othersTyping.length > 0) {
        typingIndicator.textContent = `${othersTyping.join(', ')} is typing...`;
        typingIndicator.classList.remove('hidden'); // Show the typing indicator
    } else {
        typingIndicator.classList.add('hidden'); // Hide the typing indicator
    }
});

// Handle 'user left' event from the server
socket.on('user left', (username) => {
    console.log(`User ${username} has left.`);
    // Add a system message to the chat display
    addMessageToDisplay({
        sender: 'System',
        text: `${username} has left the chat.`,
        timestamp: new Date().toISOString(),
        isSystem: true // Mark as a system message for distinct styling
    });
});

// --- Chat Message Input & Send Logic ---

// Event listener for sending a message
sendMessageBtn.addEventListener('click', () => {
    console.log("Send Message button clicked.");
    const messageText = messageInput.value.trim();
    if (messageText) {
        socket.emit('chat message', messageText); // Emit the message to the server
        messageInput.value = ''; // Clear the input field
        stopTyping(); // Stop the typing indicator after sending a message
    }
});

// Allow pressing Enter key in the message input field to send message
messageInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        console.log("Enter key pressed in message input.");
        sendMessageBtn.click(); // Simulate a click on the send button
    } else {
        startTyping(); // Start typing indicator if user is typing
    }
});

// Logic to manage the typing indicator (client-side)
function startTyping() {
    if (!typing) {
        typing = true;
        socket.emit('typing'); // Notify server that this user is typing
        console.log("Emitting 'typing' event.");
    }
    clearTimeout(typingTimeout); // Clear any existing timeout
    typingTimeout = setTimeout(stopTyping, 3000); // Set timeout to stop typing after 3 seconds of inactivity
}

function stopTyping() {
    typing = false;
    socket.emit('stop typing'); // Notify server that this user stopped typing
    console.log("Emitting 'stop typing' event.");
    clearTimeout(typingTimeout); // Clear timeout just in case
}


// --- Message Display Function ---

// Function to add a message object to the chat display
function addMessageToDisplay(message) {
    const messageWrapper = document.createElement('div');

    // Handle system messages differently (e.g., user joined/left)
    if (message.isSystem) {
        messageWrapper.classList.add('system-message', 'message-entry-animation');
        messageWrapper.textContent = message.text;
    } else {
        // Determine if the message is from the current user (sender) or another user (receiver)
        const isSender = message.sender === currentUser;
        messageWrapper.classList.add('flex', isSender ? 'justify-end' : 'justify-start');

        const messageBubble = document.createElement('div');
        messageBubble.classList.add(
            'p-3',
            'rounded-xl',
            'max-w-[75%]',
            'shadow-md',
            'break-words', // Ensures long words wrap inside the bubble
            'message-entry-animation' // Apply entry animation to messages
        );

        // Apply distinct colors based on sender/receiver
        if (isSender) {
            messageBubble.classList.add('bg-lavender-custom', 'text-dark-gray-custom');
        } else {
            messageBubble.classList.add('bg-violet-custom', 'text-white');
        }

        // Display sender's name for receiver messages (not for sender's own messages or system messages within bubbles)
        if (!isSender && message.sender && message.sender !== 'System') {
            const senderNameSpan = document.createElement('span');
            senderNameSpan.classList.add('block', 'text-xs', 'font-bold', 'mb-1', 'opacity-80', 'text-gray-200');
            senderNameSpan.textContent = message.sender;
            messageBubble.appendChild(senderNameSpan);
        }

        const messageText = document.createElement('p');
        messageText.textContent = message.text;
        messageBubble.appendChild(messageText);

        const timeSpan = document.createElement('span');
        timeSpan.classList.add('text-xs', 'block', 'text-right', 'mt-1');
        // Adjust timestamp color for readability on different bubble backgrounds
        if (isSender) {
            timeSpan.classList.add('text-gray-500');
        } else {
            timeSpan.classList.add('text-purple-200');
        }
        timeSpan.textContent = formatTimestamp(message.timestamp);
        messageBubble.appendChild(timeSpan);

        messageWrapper.appendChild(messageBubble);
    }

    messagesDiv.appendChild(messageWrapper);

    // Scroll to the bottom of the chat display to show the newest message
    // Small timeout ensures message rendering before scroll
    setTimeout(() => {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }, 100);
}

// Function to format ISO timestamp string into a readable time format (e.g., "10:30 AM")
function formatTimestamp(timestampString) {
    if (!timestampString) return '';
    const date = new Date(timestampString);
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // Convert hour '0' to '12' for AM/PM format
    const minStr = minutes < 10 ? '0' + minutes : minutes; // Add leading zero for minutes if needed
    return `${hours}:${minStr} ${ampm}`;
}

// --- Online Users Modal Toggle Logic ---
onlineUsersToggle.addEventListener('click', () => {
    onlineUsersModal.classList.toggle('hidden'); // Toggle visibility of the modal
});

// Close online users modal when clicking anywhere outside it or its trigger button
window.addEventListener('click', (event) => {
    // Check if the click occurred outside both the modal and the toggle button
    if (!onlineUsersModal.contains(event.target) && !onlineUsersToggle.contains(event.target)) {
        onlineUsersModal.classList.add('hidden'); // Hide the modal
    }
});

// Initial scroll to bottom (useful if there were pre-loaded messages, which isn't the case here)
messagesDiv.scrollTop = messagesDiv.scrollHeight;
