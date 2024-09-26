const express = require('express');
const router = express.Router();
const ufmFailoverConfigStateController = require('../controllers/ufmFailoverConfigStateController');

router.route('/')
    .get( ufmFailoverConfigStateController.getAllFailoverConfigStateRecords)
    .post(ufmFailoverConfigStateController.createFailoverConfigStateRecord)
    .put( ufmFailoverConfigStateController.updateFailoverConfigStateRecord)

router.route("/:ufmProfileId") 
    .get( ufmFailoverConfigStateController.getFailoverConfigStateRecord)
    .delete(ufmFailoverConfigStateController.removeFailoverConfigStateRecord);

module.exports = router;