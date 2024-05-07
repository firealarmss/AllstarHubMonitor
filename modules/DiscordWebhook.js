/**
 * This file is part of the AllstarLink Hub Monitor project.
 *
 * (c) 2024 Caleb <ko4uyj@gmail.com>
 *
 * For the full copyright and license information, see the
 * LICENSE file that was distributed with this source code.
 */

const https = require('https');
const Logger = require('./Logger'); // temporary

class DiscordWebhook {
    constructor(config) {
        this.logger = new Logger(); // temporary
        this.config = config;

        if (!this.config.webhook || !this.config.webhook.enabled) {
            this.logger.warn("No discord webhook configuration found", "DISCORD WEBHOOK");
        }
    }

    createDisconnectAlert(username, node){
        return {
            username: `HUB Moderation Alert`,
            avatar_url: "",
            embeds: [
                {
                    "title": "Node Disconnected",
                    "color": 15258703,
                    "thumbnail": {
                        "url": "",
                    },
                    "fields": [
                        {
                            "name": `User: ${username}`,
                            "value": `Disconnected: ${node}`,
                            "inline": true
                        }
                    ]
                }
            ]
        }
    }

    send(message, url){
        const parsedUrl = new URL(url);

        const options = {
            hostname: parsedUrl.hostname,
            port: 443,
            path: parsedUrl.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (data) {
                    try {
                        const parsedData = JSON.parse(data);
                        this.logger.dbug(parsedData, 'DISCORD WEBHOOK');
                    } catch (e) {
                        this.logger.error('Error parsing JSON response:' + e, 'DISCORD WEBHOOK');
                    }
                } else {
                    this.logger.dbug('No response body from discord webhook', 'DISCORD WEBHOOK');
                }
            });
        });

        req.on('error', (e) => {
            this.logger.error(`problem with request: ${e.message}`, 'DISCORD WEBHOOK');
        });

        req.write(JSON.stringify(message));
        req.end();
    }
}

module.exports = DiscordWebhook;