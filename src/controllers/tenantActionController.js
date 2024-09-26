const tenantActionService = require("../services/tenantActionService");

const checkTenantConnectionProper = (req, res) => {
    console.log('Test connection proper:')
    const { tenantId } = req.params;
    try {
        tenantActionService.checkTenantConnection( req, res, tenantId);
    } catch(error) {
        console.log('Error in checkTenantConnectionProper function', error);
    } 
}

module.exports = {
    checkTenantConnectionProper
}