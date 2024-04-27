const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const AmiCommunications = require("../AmiCommunications");

function createApp(config, logger) {
    this.config = config;
    this.logger = logger;

    const app = express();
    const server = http.createServer(app);
    const io = socketIo(server);

    app.set('view engine', 'ejs');
    app.set('views', __dirname + '/views');

    app.use((req, res, next) => {
        req.systemName = config.systemName;
        req.nodes = config.nodes;
        next();
    });

    app.use('/', require('./routes/index'));
    app.use('/nodes', require('./routes/nodes'));

    io.on('connection', (socket) => {
        //TODO: Prob redundant

        config.nodes.forEach(nodeConfig => {
            const amiComms = new AmiCommunications(logger, nodeConfig, config.nodes, io);
            amiComms.initialize().then(r => {});

            setTimeout(() => {
                amiComms.sendAsteriskCLICommand(`rpt showvars ${nodeConfig.nodeNumber}`).then(r => {});
            }, 1000);
        });

        socket.on('connect_node', (node_info) => {
            if (node_info.connectionType === 'permanent') {
                sendConnectionCommand(logger, io, config, node_info, '*13');
            } else {
                sendConnectionCommand(logger, io, config, node_info, '*3');
            }
            console.log('Connecting to node:', node_info.targetNode, " to ", node_info.sourceNode);
        });

        socket.on('disconnect_node', (node_info) => {
            sendConnectionCommand(logger, io, config, node_info, '*1');
            console.log('Disconnecting to node:', node_info.targetNode, " to ", node_info.sourceNode);
        });

        socket.on('disconnect', () => {
            //console.log('User disconnected');
        });
    });

    return { app, server, io };
}

function sendConnectionCommand(logger, io, config, node_info, command) {
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
            io.emit("disconnect_ack", {nodeId: node_info.targetNode, via: node_info.sourceNode});
        }
    }, 2000);
}

module.exports = createApp;