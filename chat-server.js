const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

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

        axios.get(`http://localhost/practice/chat-api/get-messages.php?user_id=${userId}&receiver_id=${data.receiver_id}`)
            .then(res => {
                socket.emit('conversationMessages', res.data.messages);
            })
            .catch(err => console.log(err.message));
    });

    // ===============================
    // SEND MESSAGE (REAL-TIME)
    // ===============================
    socket.on('sendMessage', data => {

        const payload = {
            sender_id: parseInt(userId),
            receiver_id: data.receiver_id,
            message: data.message
        };

        axios.post('http://localhost/practice/chat-api/send-message.php', payload)
            .then(res => {

                if (res.data.status !== 'success') return;

                const msg = res.data.message;

                // Send to sender
                socket.emit('newMessage', msg);

                // Send to receiver if online
                if (onlineUsers[msg.receiver_id]) {
                    io.to(onlineUsers[msg.receiver_id]).emit('newMessage', msg);
                }

            })
            .catch(err => console.log(err.message));
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

server.listen(3000, () => console.log("Messenger Server Running"));
