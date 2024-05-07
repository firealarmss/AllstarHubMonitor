/**
 * This file is part of the Allstarlink Hub Monitor project.
 *
 * (c) 2024 Caleb <ko4uyj@gmail.com>
 *
 * For the full copyright and license information, see the
 * LICENSE file that was distributed with this source code.
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const Logger = require('./Logger'); // temporary

class DbManager {
    constructor(dbFilePath, logger) {
        this.logger = new Logger(false, "", "", 1); // temporary

        this.db = new sqlite3.Database(dbFilePath, (err) => {
            if (err) {
                this.logger.error('Could not connect to database' + err, "DB MANAGER");
            } else {
                this.logger.info('Connected to database', "DB MANAGER");
            }
        });
    }

    initialize() {
        this.db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        password TEXT
        )`, (err) => {
            if (err) {
                this.logger.error('Error creating the table:' + err, "DB MANAGER");
            } else {
                this.db.get(`SELECT COUNT(*) as count FROM users`, [], (err, row) => {
                    if (row && row.count === 0) {
                        console.log("First time database setup");
                        const hash = bcrypt.hashSync('password', 8);
                        this.db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, ['admin', hash], (err) => {
                            if (err) {
                                this.logger.error('Error creating Default admin user:' + err, "DB MANAGER");
                            } else {
                                this.logger.info('Default admin user created', "DB MANAGER");
                            }
                        });
                    }
                });
            }
        });
    }

    editUser(userId, username, password, callback) {
        let sql = `UPDATE users SET username = ? WHERE id = ?`;
        let params = [username, userId];

        this.db.run(sql, params, (err) => {
            callback(err);
        });
    }
    getUser(username, callback) {
        return this.db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
            callback(err, row);
        });
    }

    addUser(username, password, callback) {
        const hash = bcrypt.hashSync(password, 8);
        this.db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hash], (err) => {
            callback(err);
        });
    }

    getAllUsers(callback) {
        return this.db.all(`SELECT * FROM users`, [], (err, rows) => {
            callback(err, rows);
        });
    }

    deleteUser(userId, callback) {
        this.db.run(`DELETE FROM users WHERE id = ?`, [userId], (err) => {
            callback(err);
        });
    }
    validateUser(username, password, callback) {
        this.getUser(username, (err, user) => {
            if (user && bcrypt.compareSync(password, user.password)) {
                callback(null, user);
            } else {
                callback('Invalid username or password');
            }
        });
    }
}

module.exports = DbManager;