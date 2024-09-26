const express = require('express');
const router = express.Router();
const integrationPackage = require('../controllers/integrationPackagesController');

// router.route('/:tenantId')
//     .get(integrationPackage.getAllPackagesList);

router.route("/sync/:tenantOneId/:tenantTwoId/:profileId")
    .get(integrationPackage.getAllPackagesWithArtifactsInformation);

router.route("/clone")
    .post(integrationPackage.cloneIntegrationPackagesWithArtifacts);

router.route("/configUpdate")
    .post(integrationPackage.copyConfigForArtifacts);

router.route("/getList/:tenantOneId/:tenantTwoId")
    .get(integrationPackage.getAllTenantPackageArtifactList)

router.route("/scheduleTenant")
    .post(integrationPackage.scheduleTenantPackageArtifactDataFetch);

router.route("/dailyInterval/:dti_id")
    .get(integrationPackage.getDailyTimeInterval)

router.route("/dailyInterval")
    .post(integrationPackage.postDailyTimeInterval)
    .get(integrationPackage.getAllDailyTimeInterval)
    .put(integrationPackage.editDailyTimeInterval)




// router.route('/')
//     .get( integrationPackage.getAllEntries)
//     .post(integrationPackage.postEntry); // can post one or single integration package;

// router.route('/:id') 
//     .get( integrationPackage.getIntegrationPackageDetailsByPackageId);

// router.route('/download/:packageId')
//     .get( integrationPackage.downloadIntegrationPackageBlob)



module.exports = router;