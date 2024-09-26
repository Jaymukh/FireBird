const express = require('express');
const router = express.Router();
const runtimeEnvironmentController = require('../controllers/runtimeEnvironmentController');

router.route('/:tenantId')
    .get( runtimeEnvironmentController.getRuntimeEnvironmentValues )

module.exports = router;