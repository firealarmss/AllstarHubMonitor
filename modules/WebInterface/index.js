const express = require('express');
const session = require('express-session');
const http = require('http');
const socketIo = require('socket.io');
const AmiCommunications = require("../AmiCommunications");

const ensureAuthenticated = require('./routes/middleware');
const createAuthRouter = require('./routes/auth');
const createUserManagementRouter = require('./routes/userManagement');

const DiscordWebhook = require('../DiscordWebhook');

function createApp(config, logger, dbManager) {
    this.config = config;
    this.logger = logger;

    this.webhook = new DiscordWebhook(config);

    const app = express();
    const server = http.createServer(app);
    const io = socketIo(server);

    const amiCommsInstances = [];

    config.nodes.forEach(nodeConfig => {
        const amiComms = new AmiCommunications(logger, nodeConfig, config.nodes, io);
        amiCommsInstances.push(amiComms);  // Store the instance
        amiComms.initialize().catch(err => {
            console.error("AMI Initialization failed for node", nodeConfig.nodeNumber, ":", err);
        });
    });

    app.set('view engine', 'ejs');
    app.set('views', __dirname + '/views');

    app.use(session({ secret: 'yourSecretKey', resave: false, saveUninitialized: true }));
    app.use(express.urlencoded({ extended: true }));

    app.use((req, res, next) => {
        req.systemName = config.systemName;
        req.nodes = config.nodes;
        next();
    });

    app.use('/', require('./routes/index'));
    app.use('/nodes', require('./routes/nodes'));
    const authRouter = createAuthRouter(dbManager);
    app.use(authRouter);
    const userManagementRouter = createUserManagementRouter(dbManager);
    app.use(userManagementRouter);

    io.on('connection', (socket) => {
        checkAndEmitEvents(socket);

        socket.on('connect_node', (node_info) => {
            if (node_info.connectionType === 'permanent') {
                sendConnectionCommand(logger, io, config, node_info, '*13');
            } else {
                sendConnectionCommand(logger, io, config, node_info, '*3');
            }
            console.log('Connecting to node:', node_info.targetNode, " to ", node_info.sourceNode);
        });

        socket.on('disconnect_node', (node_info) => {
            sendConnectionCommand(logger, io, config, node_info, '*1', node_info.username);
            console.log('Disconnecting to node:', node_info.targetNode, " to ", node_info.sourceNode, node_info.username);
        });

        socket.on('disconnect', () => {
            //console.log('User disconnected');
        });
    });

    function checkAndEmitEvents(socket) {
        const allConnected = amiCommsInstances.every(comm => comm.connected);
        if (allConnected) {
            amiCommsInstances.forEach(comm => {
                comm.emitLastKeyUpEvents(socket);
                comm.sendAsteriskCLICommand(`rpt showvars ${nodeConfig.nodeNumber}`).then(r => {});
            });
        } else {
            console.log("Not all AMI instances are connected. Retrying in 5 seconds...");
            setTimeout(() => checkAndEmitEvents(socket), 5000);
        }
    }

    return { app, server, io };
}

function sendConnectionCommand(logger, io, config, node_info, command, username) {
    console.log(config.nodes);
    const matchingNode = config.nodes.find(node => parseInt(node.nodeNumber) === parseInt(node_info.sourceNode, 10) || node.node === parseInt(node_info.sourceNode, 10));

    if (!matchingNode) {
        console.error('Node not found:', node_info.sourceNode);
        return;
    }

    const amiComms = new AmiCommunications(logger, matchingNode, this.config.nodes, io);
    amiComms.initialize().then(r => {});
    setTimeout(() => {
        amiComms.sendAsteriskCLICommand(`rpt fun ${node_info.sourceNode} ${command}${node_info.targetNode}`).then(r => {});
        if (command === '*1') {
            this.webhook.send(this.webhook.createDisconnectAlert(username, node_info.targetNode), this.config.webhook.url);
            io.emit("disconnect_ack", {nodeId: node_info.targetNode, via: node_info.sourceNode});
        }
    }, 2000);
}

module.exports = createApp;