const express = require('express');
const router = express.Router();
const userMasterController = require('../controllers/userMasterController');

router.route('/')
    .get( userMasterController.getAllUserMasterRecords)
    .post(userMasterController.addUserMasterRecord)
    .put( userMasterController.updateUserMasterRecord)

router.route("/:id") 
    .get( userMasterController.getUserMasterRecordById)
    .delete(userMasterController.removeUserMasterRecord);

module.exports = router;