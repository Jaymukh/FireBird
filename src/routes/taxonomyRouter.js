const express = require('express');
const router = express.Router();
const taxonomyController = require('../controllers/taxonomyController');

router.route('/')
    .get( taxonomyController.getAllTaxonomyRecords); // for getting all taxonomy records, no grouping et al

router.route('/group')
    .get( taxonomyController.getAllTaxonomyGroupWiseRecords );

router.route('/code')
    .post( taxonomyController.getTaxonomyRecordsByCode );

router.route('/type')
    .get( taxonomyController.getTaxonomyRecordsByType);

module.exports = router;