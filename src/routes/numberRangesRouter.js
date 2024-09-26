const express = require('express');
const router = express.Router();
const numberRangesController = require('../controllers/numberRangesController');

router.route('/list/:ufmProfileId/:componentTypeId')
    .get( numberRangesController.getAllNumberRangesFromTenants)

router.route('/copy')
    .post( numberRangesController.copyNumberRangesForTenants)
    
module.exports = router;