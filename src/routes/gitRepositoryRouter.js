const express = require('express');
const router = express.Router();
const gitMasterController = require('../controllers/gitRepositoryController');

router.route('/')
    .get( gitMasterController.getAllGitMasterRecords)
    .post(gitMasterController.addGitMasterRecord)
    .put( gitMasterController.updateGitMasterRecord)

router.route("/:grId") 
    .get( gitMasterController.getGitMasterRecordById)
    .delete(gitMasterController.removeGitMasterRecord);

module.exports = router;