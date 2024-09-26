const express = require('express');
const router = express.Router();
const userCredentialsController = require('../controllers/userCredentialsController');

router.route('/list/:ufmProfileId/:componentTypeId')
    .get( userCredentialsController.getAllUserCredentials)

router.route('/copy')
    .post( userCredentialsController.copyUserCredentials)


module.exports = router;