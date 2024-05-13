const AmiClient = require('asterisk-ami-client');
const parseAslDb = require('./AslDbHandler');

class AmiCommunications {
    constructor(logger, node, nodes, config, io) {
        this.logger = logger;
        this.configNodes = nodes;
        this.node = node;
        this.config = config;
        this.io = io;

        this.amiClient = new AmiClient();
        this.nodes = [];
        this.lastKeyUpEvents = [];
        this.connected = false;
    }

    async initialize() {
        try {
            await this.amiClient.connect(this.node.user, this.node.password, {host: this.node.host, port: this.node.port});
            this.connected = true;
            this.setupEventListeners();
        } catch (error) {
            console.log('AMI Connection Error:', error);
            this.logger.error('AMI Connection Error:', error);
            this.connected = false;
            throw error;
        }
    }

    setupEventListeners() {
        this.amiClient
            .on('connect', () => console.log('AMI Connected'))
            .on('event', async event => {
                await this.handleIncomingData(event);
            })
            //.on('data', chunk => console.log('Data Received:', chunk))
            .on('response', async response => {
                //console.log('Response:', response)
                await this.handleResponse(response);
            })
            .on('disconnect', () => console.log('AMI Disconnected'))
            .on('reconnection', () => console.log('AMI Reconnecting...'))
            .on('internalError', error => console.log('AMI Internal Error:', error));
    }

    async handleResponse(response) {
        if (response.Response === 'Follows' && response['$content'].includes('RPT_ALINKS=')) {
            await this.processShowVarsResponse(response);
        }
    }

    async handleIncomingData(data) {
        //console.log('Incoming Data:', data);
        //this.io.emit('ami_event', data);
        if (data.Event === "RPT_ALINKS") {
            //console.log(data);
            await this.handleAList(data.EventValue)
        }
    }

    storeKeyUpEvent(data) {
        if (data.via.toString() === data.node) {
            //console.debug('Ignoring self-loop event:', data);
            return;
        }

        if (data.state === 'Keyed') {
            this.lastKeyUpEvents.push(data);
            if (this.lastKeyUpEvents.length > 15) {
                this.lastKeyUpEvents.shift();
            }
        }
    }

    emitLastKeyUpEvents(socket) {
        //console.log('Emitting last key up events:', this.lastKeyUpEvents);
        socket.emit('initial_key_up_events', this.lastKeyUpEvents);
    }

    async processShowVarsResponse(response) {
        const lines = response['$content'].split('\n');
        const alinksLine = lines.find(line => line.trim().startsWith('RPT_ALINKS='));
        if (alinksLine) {
            const [, alinksDetails] = alinksLine.split('=');
            const alinksParts = alinksDetails.split(',').slice(1);

            try {
                const nodeData = await parseAslDb(this.config.db.asl.dbPath);
                const connectedNodes = await Promise.all(alinksParts.map(async part => {
                    const [nodeId, directionState] = part.split('T');
                    const state = directionState.endsWith('U') ? 'Unkeyed' : 'Keyed';
                    const direction = directionState[0];

                    let nodeInfo = nodeData.find(n => n.nodeId === nodeId) || {};
                    return {
                        node: nodeId,
                        via: this.node.nodeNumber,
                        callsign: nodeInfo.callSign || '',
                        frequency: nodeInfo.frequency || 'N/A',
                        location: nodeInfo.location || 'Unknown',
                        direction: direction,
                        state: state
                    };
                }));
                //console.log('Connected Nodes:', connectedNodes)

                this.io.emit('connected_nodes', connectedNodes);
            } catch (error) {
                console.error('Error processing RPT_ALINKS:', error);
            }
        }
    }

    async handleAList(eventValue, key_event = true) {
        const parts = eventValue.split(',');

        if (parts.length > 1) {
            const nodeCount = parseInt(parts[0], 10);
            const nodeDetails = parts.slice(1);

            try {
                const nodeData = await parseAslDb(this.config.db.asl.dbPath);

                let connectedNodesPromises = nodeDetails.map(async detail => {
                    let nodeId = detail.slice(0, -2); // Extract node number
                    let stateIndicator = detail.slice(-1); // 'K' for Keyed, 'U' for Unkeyed
                    let newState = stateIndicator === 'U' ? 'Unkeyed' : 'Keyed';

                    let nodeInfo = nodeData.find(n => n.nodeId === nodeId) || {};
                    //console.log("nodes list" + this.configNodes);
                    this.io.emit('node_key', { node: nodeId, via: this.node.nodeNumber, callsign: nodeInfo.callSign || 'N/A', frequency: nodeInfo.frequency || 'N/A', location: nodeInfo.location || 'N/A', direction: null, state: newState, config: this.configNodes});
                    this.storeKeyUpEvent({ node: nodeId, via: this.node.nodeNumber, callsign: nodeInfo.callSign || 'N/A', frequency: nodeInfo.frequency || 'N/A', location: nodeInfo.location || 'N/A', direction: null, state: newState, config: this.configNodes})

                    return {
                        node: nodeId,
                        via: this.node.nodeNumber,
                        callsign: nodeInfo.callSign || '',
                        frequency: nodeInfo.frequency || 'N/A',
                        location: nodeInfo.location || 'Unknown',
                        direction: detail.slice(-2, -1), // 'T'
                        state: newState
                    };
                });

                let connectedNodes = await Promise.all(connectedNodesPromises);
                //console.log('Connected Nodes:', connectedNodes)
                this.io.emit('connected_nodes', connectedNodes);
            } catch (error) {
                console.error('Error processing node list:', error);
            }
        } else {
            this.io.emit('connected_nodes', []);
        }
    }

    sendAsteriskCLICommand(cliCommand) {
        if (!this.connected) {
            return Promise.reject('Not connected to AMI');
        }

        return this.sendCommand('Command', { Command: cliCommand });
    }

    sendCommand(command, parameters = {}) {
        if (!this.connected) {
            return Promise.reject('Not connected to AMI');
        }

        return new Promise((resolve, reject) => {
            this.amiClient.action(Object.assign({ Action: command }, parameters), (err, res) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(res);
                }
            });
        });
    }

    disconnect() {
        this.amiClient.disconnect();
        console.log('AMI Disconnected Successfully');
    }
}

module.exports = AmiCommunications;