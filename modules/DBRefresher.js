const fs = require('fs');
const https = require('https');

class DBRefresher {
    constructor(url, dbPath, interval) {
        this.url = url;
        this.dbPath = dbPath;
        this.interval = interval;
        this.timer = null;
    }

    start() {
        this.stop();
        this.refreshData();
        this.timer = setInterval(() => this.refreshData(), this.interval);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    refreshData() {
        https.get(this.url, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                this.saveData(data);
            });
        }).on('error', (err) => {
            console.error('Error fetching data:', err.message);
        });
    }

    saveData(data) {
        console.log('Refreshing data...');
        fs.writeFile(this.dbPath, data, (err) => {
            if (err) {
                console.error('Error saving file:', err);
            } else {
                console.log('Data refreshed and saved successfully.');
            }
        });
    }
}

module.exports = DBRefresher;