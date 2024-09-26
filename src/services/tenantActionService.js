const { HttpStatusCode } = require("axios");
const Tenant = require("../models/tenant");
const { getOAuth, getOAuthForIFlow } = require("../util/auth");
const { decryptData, getEncryptionIV } = require("../util/decode");
const  sequelize  = require("../dbconfig/config");
const { SUCCESSFUL_TEST_STATUS, UNSUCCESSFUL_TEST_STATUS } = require("../constants/taxonomyValues");
const { sendResponse } = require("../util/responseSender");
const { responseObject } = require("../constants/responseTypes");

const checkTenantConnection = async (req, res, tenantId) => {
    const transaction = await sequelize.transaction();
    
    try {
        const response = await Tenant.findByPk(tenantId, { transaction });

        if (!response) {
            await transaction.rollback();
            return sendResponse(
                res, // response object
                false, // success
                HttpStatusCode.NotFound, // statusCode
                responseObject.RECORD_NOT_FOUND, // status type
                `Tenant id : ${tenantId} not found`, // message
                 {}
            );
            // return res.status(HttpStatusCode.NotFound).json({ error: `Tenant id : ${tenantId} not found`});
        }

       // this is for API 
        let inputCredentials = {
             tokenEndpoint : response.tenant_host_token_api,
             clientId : response.tenant_host_username, 
             clientSecret : decryptData(response.tenant_host_password, getEncryptionIV( response.tenant_iv_salt) ), 
        }

        // this is for Util/Iflow
        let inputCredentialsForIflow = {
            tokenEndpoint : response.tenant_util_token_url,
            clientId : response.tenant_util_client_id, 
            clientSecret : decryptData (
                response.tenant_util_client_secret,
                getEncryptionIV(response.tenant_util_iv_salt)
            )
        }

        let bearerToken = await getOAuth(inputCredentials);
        let bearerTokenForIFlow = await getOAuthForIFlow(inputCredentialsForIflow);

        if (!bearerToken || !bearerTokenForIFlow) {
            console.log('\nReching here')
            // Simulate failure for Tenant connection not OK
            await Tenant.update({ tenant_host_test_status_id:UNSUCCESSFUL_TEST_STATUS  }, {
                where: {
                    tenant_id: tenantId
                },
                transaction
            });
            await transaction.commit();
            return sendResponse(
                res, // response object
                false, // success
                HttpStatusCode.Ok, // statusCode
                responseObject.TEST_CONNECTION_NOT_OK, // status type
                `Tenant connection not okay`, // message
                 {}
            );
            // return res.status(HttpStatusCode.Ok).json({ success: false});
        }

        if (bearerToken && bearerTokenForIFlow) {
            console.log('\nGot bearer token')
            await Tenant.update({ tenant_host_test_status_id: SUCCESSFUL_TEST_STATUS,
                tenant_host_test_status_on: Math.floor(Date.now() / 1000)
             }, {
                where: {
                    tenant_id: tenantId
                },
                transaction
            });
            await transaction.commit();
            return sendResponse(
                res, // response object
                true, // success
                HttpStatusCode.Ok, // statusCode
                responseObject.TEST_CONNECTION_OK, // status type
                `Tenant connection is okay`, // message
                 {}
            );
            // return res.status(HttpStatusCode.Ok).json({ success: true });
        }
        
    } catch(error) {
        console.log('Error in checkTenantConnection Service: ', error);
        await transaction.rollback();
        return sendResponse(
            res, // response object
            false, // success
            HttpStatusCode.InternalServerError, // statusCode
            responseObject.INTERNAL_SERVER_ERROR, // status type
            `Internal Server Error: in checking tenant connection.`, // message
            {}
        );
        // return res.status(HttpStatusCode.InternalServerError).json({ success: false });
    }
} 

module.exports = {
    checkTenantConnection
}