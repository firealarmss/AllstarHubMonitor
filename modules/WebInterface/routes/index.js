const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('index', { title: 'Express EJS Socket.IO Module' });
});

module.exports = router;