const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('index', { title: req.systemName, isAuthenticated: req.session.user });
});

module.exports = router;