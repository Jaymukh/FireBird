const express = require('express');
const router = express.Router();
const ufmProfileRuntimeMapController = require('../controllers/ufmProfileRuntimeMapController');

router.route('/')
    .get( ufmProfileRuntimeMapController.getAllUfmProfileRuntimeMapRecords)
    .post(ufmProfileRuntimeMapController.addUfmProfileRuntimeMapRecord)
    .put( ufmProfileRuntimeMapController.updateUfmProfileRuntimeMapRecord);

router.route("/:ufmProfileId") 
    .get( ufmProfileRuntimeMapController.getUfmProfileRuntimeMapByUfmProfileId)

router.route("/:ufmProfileRuntimeMapId")
    .delete(ufmProfileRuntimeMapController.removeUfmProfileRuntimeMapRecord);

module.exports = router;
