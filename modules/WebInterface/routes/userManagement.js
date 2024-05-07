const express = require('express');
const isAuthenticated = require('./middleware');

function createUserManagementRouter(dbManager) {
    const router = express.Router();

    router.get('/users', isAuthenticated, (req, res) => {
        dbManager.getAllUsers((err, users) => {
            if (err) {
                return res.status(500).send("Error fetching users");
            }
            res.render('userManagement', { title: 'User Management', users });
        });
    });

    router.post('/users/add', isAuthenticated, (req, res) => {
        const { username, password } = req.body;
        dbManager.addUser(username, password, (err) => {
            if (err) {
                return res.status(500).send("Error adding user");
            }
            res.redirect('/users');
        });
    });

    router.post('/users/delete', isAuthenticated, (req, res) => {
        const { userId } = req.body;
        dbManager.deleteUser(userId, (err) => {
            if (err) {
                return res.status(500).send("Error deleting user");
            }
            res.redirect('/users');
        });
    });

    return router;
}

module.exports = createUserManagementRouter;
