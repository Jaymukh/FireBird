const keystoreService = require("../services/keystoreService")
const getAllKeystoreEntriesForTenants = async ( req, res ) => {
    try {
       await keystoreService.getKeyStoreValuesForTenants(req,res);
    } catch(error) {
        console.log('Error in controller: getAllKeystoreEntriesForTenants: ', error);
    }
}

const copyCertificatesFromSourceToTargetTenant = async (req, res) => {
    try {
        await keystoreService.copyCertificates(req,res);
     } catch(error) {
         console.log('Error in controller: copyCertificatesFromSourceToTargetTenant: ', error);
     }
}

module.exports = {
    getAllKeystoreEntriesForTenants,
    copyCertificatesFromSourceToTargetTenant
}