const express = require('express');
const router = express.Router();
const variablesController = require('../controllers/variablesController');

router.route('/list/:ufmProfileId/:componentTypeId')
    .get( variablesController.getAllVariablesForTenants )

router.route('/copy')
    .post( variablesController.copyVariablesFromSourceToTargetTenant );

module.exports = router;