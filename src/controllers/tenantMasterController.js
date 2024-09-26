// For Basic Crud operations for Tenant Table
const tenantService = require("../services/tenantMasterService");

// done
const getAllTenantsList = async (req, res) => {
    try {
        tenantService.getAllTenants(req,res);

    } catch(error) {
        console.log('Error in getAllTenantsList: ', error);
    }
}

// done
const addTenantRecord = async( req, res) => {
    try {
        tenantService.addTenant(req,res);

    } catch(error) {
        console.log('Error in addTenantRecord: ', error);
    }
}

// done
const removeTenantRecord = async( req, res) => {
    const tenantId = req.params.tenantId;

    try {
        tenantService.removeTenant(req,res,tenantId);

    } catch(error) {
        console.log('Error in removeTenantRecord: ', error);
    }
}

// done
const getTenantDetailById = async( req, res) => {

    const tenantId = req.params.tenantId;

    try {
        tenantService.getTenantById(req,res, tenantId);

    } catch(error) {
        console.log('Error in getTenantDetailById: ', error);
    }
}


const updateTenantRecord = async ( req, res) => {
    console.log('updateTenantRecord: ')
    try {
        tenantService.updateTenantDetails(req,res);

    } catch(error) {
        console.log('Error in updateTenantRecord: ', error);
    }
}



module.exports = {
    getAllTenantsList,
    addTenantRecord,
    removeTenantRecord,
    getTenantDetailById,
    updateTenantRecord
}