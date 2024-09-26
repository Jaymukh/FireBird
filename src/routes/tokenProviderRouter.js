const express = require('express');
const router = express.Router();
const tokenProviderController = require('../controllers/tokenProviderController');

router.route('/:tenantOneId/:tenantTwoId')
    .get( tokenProviderController.getBearerTokens )

module.exports = router;