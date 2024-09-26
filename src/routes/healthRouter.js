const express = require('express');
const router = express.Router();
const healthCheck = require('../controllers/healthController');

router.route('/')
    .get( healthCheck.healthCheck)


module.exports = router;