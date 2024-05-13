/**
 * This file is part of the Allstarlink Hub Monitor project.
 *
 * (c) 2024 Caleb <ko4uyj@gmail.com>
 *
 * For the full copyright and license information, see the
 * LICENSE file that was distributed with this source code.
 */

const yargs = require('yargs');
const fs = require('fs');
const yaml = require('js-yaml');

const WebInterface = require('./modules/WebInterface');
const DbManager = require("./modules/DbManager");
const DBRefresher = require('./modules/DBRefresher');

const argv = yargs

    .option('c', {
        alias: 'config',
        describe: 'Path to config file',
        type: 'string',
    })
    .help()
    .alias('help', 'h')
    .argv;

let config = {
    nodes: undefined,
    webServer: {
        port: 3000
    },
    db: {
        userDbPath: undefined,
        asl: {
            url: undefined,
            refreshInterval: undefined,
            dbPath: undefined
        }
    }
};

if (argv.config) {
    try {
        const configFileContents = fs.readFileSync(argv.config, 'utf8');
        config = yaml.load(configFileContents);
    } catch (e) {
        console.error("Error reading config file: \n" + e);
        process.exit(1);
    }

    let LogPath = config.LogPath || "Disabled";

    console.log(`AllstarLink Hub Monitor\nCopyright 2024 Caleb, KO4UYJ\n\nDebug: ${config.Debug}\nLog Path: ${LogPath}\n`);

    let dbManager = new DbManager(config.db.userDbPath, null);
    dbManager.initialize();

    if (config.db && config.db.asl && config.db.asl.refreshInterval > 0 && config.db.asl.url && config.db.asl.dbPath) {
        const dbRefresher = new DBRefresher(config.db.asl.url, config.db.asl.dbPath ,config.db.asl.refreshInterval);
        dbRefresher.start();
    } else {
        console.warn('ASL DB Refresher not configured or is disabled.');
    }

    const { app, server, io } = WebInterface(config, null, dbManager);

    server.listen(config.webServer.port, () => console.log(`Server running on port ${config.webServer.port}`));
} else {
    console.error('No config file specified');
    process.exit(1);
}
