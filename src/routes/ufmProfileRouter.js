const express = require('express');
const router = express.Router();
const ufmProfileController = require('../controllers/ufmProfileController');

router.route('/')
    .get( ufmProfileController.getAllUfmProfileRecords)
    .post(ufmProfileController.addUfmProfileRecord)
    .put( ufmProfileController.updateUfmProfileRecord);

router.route("/:ufmProfileId") 
    .get( ufmProfileController.getUfmProfileById)
    .delete(ufmProfileController.removeUfmProfileRecord);

module.exports = router;