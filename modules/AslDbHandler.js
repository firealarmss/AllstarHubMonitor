const fs = require('fs');
const path = require('path');

function parseLine(line) {
    const parts = line.split('|');
    if (parts.length >= 4) {
        return {
            nodeId: parts[0].trim(),
            callSign: parts[1].trim(),
            frequency: parts[2].trim(),
            location: parts[3].trim(),
        };
    }
    return null;
}

function parseAslDb(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject('Error reading the file: ' + err);
                return;
            }

            const lines = data.split('\n');
            const records = lines
                .filter(line => line && !line.startsWith(';'))
                .map(parseLine)
                .filter(record => record !== null);

            resolve(records);
        });
    });
}

module.exports = parseAslDb;
