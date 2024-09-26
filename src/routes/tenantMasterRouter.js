const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantMasterController');

router.route('/')
    .get( tenantController.getAllTenantsList)
    .post(tenantController.addTenantRecord)
    .put( tenantController.updateTenantRecord)


router.route("/:tenantId") 
    .get( tenantController.getTenantDetailById)
    .delete(tenantController.removeTenantRecord);

module.exports = router;