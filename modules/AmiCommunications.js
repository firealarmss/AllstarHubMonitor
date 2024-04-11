const AmiClient = require('asterisk-ami-client');
const parseAslDb = require('./AslDbHandler');

class AmiCommunications {
    constructor(logger, node, io) {
        this.logger = logger;
        this.node = node;

        this.io = io;
        this.amiClient = new AmiClient();
        this.nodes = [];
    }

    initialize() {
        this.amiClient.connect(this.node.user, this.node.password, {host: this.node.host, port: this.node.port})
            .then(() => {
                this.setupEventListeners();
            })
            .catch(error => {
                console.log('AMI Connection Error:', error);
                this.logger.error('AMI Connection Error:', error);
            });
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

    async processShowVarsResponse(response) {
        const lines = response['$content'].split('\n');
        const alinksLine = lines.find(line => line.trim().startsWith('RPT_ALINKS='));
        if (alinksLine) {
            const [, alinksDetails] = alinksLine.split('=');
            const alinksParts = alinksDetails.split(',').slice(1);

            try {
                const nodeData = await parseAslDb("db/aslDb.txt");
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

                //console.log('Connected Nodes:', connectedNodes);
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
                const nodeData = await parseAslDb("db/aslDb.txt");

                let connectedNodesPromises = nodeDetails.map(async detail => {
                    let nodeId = detail.slice(0, -2); // Extract node number
                    let stateIndicator = detail.slice(-1); // 'K' for Keyed, 'U' for Unkeyed
                    let newState = stateIndicator === 'U' ? 'Unkeyed' : 'Keyed';

                    let nodeInfo = nodeData.find(n => n.nodeId === nodeId) || {};
                    this.io.emit('node_key', { node: nodeId, via: this.node.nodeNumber, callsign: nodeInfo.callSign, frequency: nodeInfo.frequency, location: nodeInfo.location, direction: null, state: newState});

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

                this.io.emit('connected_nodes', connectedNodes);
            } catch (error) {
                console.error('Error processing node list:', error);
            }
        }
    }


    sendAsteriskCLICommand(cliCommand) {
        return this.sendCommand('Command', { Command: cliCommand });
    }

    sendCommand(command, parameters = {}) {
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
