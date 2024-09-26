const variablesService = require("../services/variablesService")
const getAllVariablesForTenants = async ( req, res ) => {
    try {
        variablesService.getAllVariables(req,res)
    } catch(error) {
        console.log('Error in controller:getAllVariablesForTenants: ', error);
    }
}

const copyVariablesFromSourceToTargetTenant = async (req, res) => {
    try {
        variablesService.copyVariablesFromSourceToTarget(req,res)
    } catch(error) {
        console.log('Error in controller:copyVariablesFromSourceToTargetTenant: ', error);
    }
}

module.exports = {
    getAllVariablesForTenants,
    copyVariablesFromSourceToTargetTenant
}