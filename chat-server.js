const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

const API_BASE = "https://yourdomain.infinityfreeapp.com/practice/chat-api";

let onlineUsers = {};

io.on('connection', socket => {

    const userId = socket.handshake.query.userId;
    if (!userId) return;

    onlineUsers[userId] = socket.id;
    console.log("User connected:", userId);

    // ===============================
    // LOAD CONVERSATION
    // ===============================
    socket.on('loadConversation', data => {

        axios.get(`${API_BASE}/get-messages.php?user_id=${userId}&receiver_id=${data.receiver_id}`)
            .then(res => {
                socket.emit('conversationMessages', res.data.messages);
            })
            .catch(err => console.log("Load error:", err.message));
    });

    // ===============================
    // SEND MESSAGE
    // ===============================
    socket.on('sendMessage', data => {

        const payload = {
            sender_id: parseInt(userId),
            receiver_id: data.receiver_id,
            message: data.message
        };

        axios.post(`${API_BASE}/send-message.php`, payload)
            .then(res => {

                if (res.data.status !== 'success') return;

                const msg = res.data.message;

                socket.emit('newMessage', msg);

                if (onlineUsers[msg.receiver_id]) {
                    io.to(onlineUsers[msg.receiver_id])
                        .emit('newMessage', msg);
                }

            })
            .catch(err => console.log("Send error:", err.message));
    });

    // ===============================
    // TYPING INDICATOR
    // ===============================
    socket.on('typing', data => {
        if (onlineUsers[data.receiver_id]) {
            io.to(onlineUsers[data.receiver_id])
                .emit('typing', { sender_id: userId });
        }
    });

    socket.on('disconnect', () => {
        delete onlineUsers[userId];
        console.log("User disconnected:", userId);
    });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
    console.log("Messenger Server Running on", PORT)
);

