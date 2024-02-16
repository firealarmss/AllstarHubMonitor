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
const Logger = require('./modules/Logger');
const DbManager = require("./modules/DbManager");
const AmiCommunications = require("./modules/AmiCommunications")
const WebInterface = require('./modules/WebInterface');

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
    nodes: undefined
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

    const { app, server, io } = WebInterface(config);

    config.nodes.forEach((node) => {
        let logger = new Logger();
        let amiComms = new AmiCommunications(logger, node, io);
        amiComms.initialize();
    });

    server.listen(config.webServer.port, () => console.log(`Server running on port ${config.webServer.port}`));

/*      let logger = new Logger(config.Debug, server.name, config.LogPath, 0);
        let dbManager = new DbManager("./db/users.db", logger);
*/
} else {
    console.error('No config file specified');
    process.exit(1);
}