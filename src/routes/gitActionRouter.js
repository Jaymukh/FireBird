const express = require('express');
const router = express.Router();
const gitActionController = require('../controllers/gitActionController');

router.route('/')
    .get( gitActionController.copyPackagesOnGitFromTenant)
    .post(gitActionController.downloadPackagesFromGitForTenant);


router.route('/:grId')
    .get( gitActionController.checkGitConnectionProper);


module.exports = router;