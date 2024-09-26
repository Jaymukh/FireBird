const express = require('express');
const router = express.Router();
const OAuth2CredentialsController = require('../controllers/OAuth2CredentialsController');

// OAuth2ClientCredentials
router.route('/list/:ufmProfileId/:componentTypeId')
    .get( OAuth2CredentialsController.getAllOAuth2Credentials)

router.route('/copy')
    .post( OAuth2CredentialsController.copyOAuth2Credentials)


module.exports = router;