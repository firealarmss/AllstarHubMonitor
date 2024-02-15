const AmiClient = require('asterisk-ami-client');

class AmiCommunications {
    constructor(logger, node) {
        this.logger = logger;
        this.node = node;

        this.amiClient = new AmiClient();
        this.nodes = [];
    }

    initialize() {
        this.amiClient.connect('admin', 'aGR2GF5VfQu7Nvh', {host: this.node.host, port: this.node.port})
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
            .on('nodes', () => console.log("Node test"))
            .on('connect', () => console.log('AMI Connected'))
            .on('event', event => this.handleIncomingData(event))
            //.on('data', chunk => console.log('Data Received:', chunk))
            .on('response', response => console.log('Response:', response))
            .on('disconnect', () => console.log('AMI Disconnected'))
            .on('reconnection', () => console.log('AMI Reconnecting...'))
            .on('internalError', error => console.log('AMI Internal Error:', error));
    }

    handleIncomingData(data) {
        //console.log('Incoming Data:', data);
        if (data.Event === "RPT_ALINKS") {
            //console.log(data);
            //this.handleKeyUp(data.EventValue)
        }
    }

    handleKeyUp(eventValue) {
        const parts = eventValue.split(',');

        if (parts.length > 1) {
            let nodeId = parts[1];
            const direction = nodeId.slice(-2, -1); // 'T' (direction) from nodeId
            const stateIndicator = nodeId.slice(-1); // 'K' for Keyed, 'U' for Unkeyed
            const newState = stateIndicator === 'U' ? 'Unkeyed' : 'Keyed';
            nodeId = nodeId.slice(0, -2); // node number

            const nodeIndex = this.nodes.findIndex(n => n.number === nodeId);

            if (nodeIndex !== -1) {
                const node = this.nodes[nodeIndex];
                if (node.direction === direction && node.keyState === newState) {
                    return;
                }
                node.direction = direction;
                node.keyState = newState;
                console.log(`Node ${nodeId} updated: Direction = ${direction}, State = ${newState}`);
            } else {
                this.nodes.push({ number: nodeId, direction: direction, keyState: newState });
                console.log(`Node ${nodeId} added: Direction = ${direction}, State = ${newState}`);
            }
        } else {
            console.log("Invalid eventValue format:", eventValue);
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
