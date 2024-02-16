const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('nodes', { title: '', nodes: req.nodes });
});

module.exports = router;