const { getBearerTokenForTenants } = require("../util/auth");

const getBearerTokens = async (req, res) => {
    try {
        const tenantOneId = req.params.tenantOneId;
        const tenantTwoId = req.params.tenantTwoId;
      const [ tenantOneBearerToken, tenantTwoBearerToken] =  await getBearerTokenForTenants(tenantOneId, tenantTwoId);
        
      return res.status(200).json({ tenantOneBearerToken, tenantTwoBearerToken})
    } catch(error) {
        console.log('Error in getBearerTokenForTenants: ', error);
    }

}

module.exports = {
    getBearerTokens
}