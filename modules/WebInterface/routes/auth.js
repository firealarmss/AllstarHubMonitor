const express = require('express');

function createAuthRouter(dbManager) {
    const router = express.Router();

    router.get('/login', (req, res) => {
        res.render('login', { title: 'Login', error: null });
    });

    router.post('/login', (req, res) => {
        const { username, password } = req.body;
        dbManager.validateUser(username, password, (err, user) => {
            if (err) {
                res.render('login', { title: 'Login', error: err });
            } else {
                req.session.user = user;
                res.redirect('/');
            }
        });
    });

    router.get('/logout', (req, res) => {
        req.session.destroy();
        res.redirect('/login');
    });

    return router;
}

module.exports = createAuthRouter;