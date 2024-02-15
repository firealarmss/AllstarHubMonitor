const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

function createApp() {
    const app = express();
    const server = http.createServer(app);
    const io = socketIo(server);

    app.set('view engine', 'ejs');
    app.set('views', __dirname + '/views');

    app.use(require('./routes'));

    io.on('connection', (socket) => {
        console.log('A user connected');
        socket.on('disconnect', () => {
            console.log('User disconnected');
        });
    });

    return { app, server };
}

module.exports = createApp;
