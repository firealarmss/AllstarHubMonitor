const fs = require('fs');

function parseLine(line) {
    const parts = line.split('|');
    if (parts.length >= 4) {
        return {
            nodeId: parts[0].trim(),
            callsign: parts[1].trim(),
            frequency: parts[2].trim(),
            location: parts[3].trim(),
        };
    }
    return null;
}

function loadPrivateNodes(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject('Error reading private nodes file: ' + err);
                return;
            }
            const lines = data.split('\n');
            const privateNodes = new Map();
            lines.forEach(line => {
                const record = parseLine(line);
                if (record) {
                    privateNodes.set(record.nodeId, record);
                }
            });

            //console.log('Loaded', privateNodes.size, 'private nodes');
            resolve(privateNodes);
        });
    });
}

async function parseAslDb(filePath) {
    try {
        const aslData = await fs.promises.readFile(filePath, 'utf8');
        const lines = aslData.split('\n');
        const records = lines
            .filter(line => line.trim() && !line.startsWith(';'))
            .map(parseLine)
            .filter(record => record);

        if (!records.length) {
            throw new Error("No valid records found");
        }

        //console.log('Parsed', records.length, 'ASL records');
        return records;
    } catch (err) {
        console.error('Error processing ASL database:', err);
        throw err;
    }
}

module.exports = {
    parseAslDb,
    loadPrivateNodes
};
