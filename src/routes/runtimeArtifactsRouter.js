const express = require('express');
const router = express.Router();
const runtimeArtifactsController  = require('../controllers/runtimeArtifactsController');

// router.route('/:tenantOneId/:tenantTwoId')
//     .get( runtimeArtifactsController.getRuntimeArtifactsWithDesigntimeArtifacts )

router.route('/failover-status/:ufmProfileId')
    .get(runtimeArtifactsController.getFailoverStatus )
    
router.route('/:ufmProfileId')
    .get(runtimeArtifactsController.getRuntimeArtifactsWithDesigntimeArtifacts)

router.route('/').post(runtimeArtifactsController.postFailoverConfig);

router.route('/schedule-failover')
    .post(runtimeArtifactsController.schedulePlannedFailover);




module.exports = router;