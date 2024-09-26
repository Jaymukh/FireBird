const express = require('express');
const router = express.Router();
const tenantActionController = require('../controllers/tenantActionController');

router.route('/:tenantId')
    .get( tenantActionController.checkTenantConnectionProper);

module.exports = router;