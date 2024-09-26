const UFMSyncDetail = require("../models/UFM/ufmSyncDetail");
const UFMSyncHeader = require("../models/UFM/ufmSyncHeader");
const UFMProfile = require("../models/ufmProfile");
const { getBearerTokenForTenants, getBearerTokenForIFlow } = require("../util/auth");
const { axiosInstance } = require("./cpiClient");
const  sequelize  = require("../dbconfig/config");
const { sendResponse } = require("../util/responseSender");
const { HttpStatusCode } = require("axios");
const { responseObject } = require("../constants/responseTypes");

const getOAuth2Credentials = async ( req, res ) => {
    try {
        const { ufmProfileId, componentTypeId } = req.params;
        console.log(`ufmProfileId: ${ufmProfileId}, componentTypeId: ${componentTypeId}`);

        const ufmProfileResponse = await UFMProfile.findOne( {
            where: {
                ufm_profile_id: ufmProfileId
            }
        })
        if (!ufmProfileResponse) {
            return res.status(400).json({ error: "UFM Profile id not found"})
        }

        const [
             tenantOneBearerToken, tenantTwoBearerToken,
             tenantOneDbResponse, tenantTwoDbResponse 
        ] = await getBearerTokenForTenants(
            ufmProfileResponse.ufm_profile_primary_tenant_id, 
            ufmProfileResponse.ufm_profile_secondary_tenant_id);

        // if (!tenantOneBearerToken || !tenantTwoBearerToken) {
        //     return res.status(500).json({error: 'Error in getting bearer token for one of the tenant(s)'})
        // }
        
        const axiosInstanceTenantOne = axiosInstance({
            url: tenantOneDbResponse.tenant_host_url,
            token: tenantOneBearerToken
        });
    
        const axiosInstanceTenantTwo = axiosInstance({
            url: tenantTwoDbResponse.tenant_host_url,
            token: tenantTwoBearerToken
        });

        const tenantOneUtilBearerToken = await getBearerTokenForIFlow (tenantOneDbResponse) ;
        
        const axiosInstanceUtilTenantOne = axiosInstance({
            url: tenantOneDbResponse.tenant_util_host_url,
            headers: {
                'CredentialType': 'OAuth2',
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            token: tenantOneUtilBearerToken
        })

        const tenantTwoUtilBearerToken = await getBearerTokenForIFlow (tenantTwoDbResponse) ;
        
        const axiosInstanceUtilTenantTwo = axiosInstance({
            url: tenantTwoDbResponse.tenant_util_host_url,
            headers: {
                'CredentialType': 'OAuth2',
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            token: tenantTwoUtilBearerToken
        })
    
        let [OAuth2TenantOneResponse, OAuth2TenantTwoResponse ] = await Promise.all([
            await axiosInstanceTenantOne.get("/api/v1/OAuth2ClientCredentials"),
            await axiosInstanceTenantTwo.get("/api/v1/OAuth2ClientCredentials")
        ])

        let OAuth2CredentialArrayOne = flattenObjectsInArray(OAuth2TenantOneResponse.data.d.results);
        let OAuth2CredentialArrayTwo = flattenObjectsInArray(OAuth2TenantTwoResponse.data.d.results);   

        const targetCredentialUrl = `/http/GetCredentials`; // this util must be deployed on both tenants
        let [utilResponseOne, utilResponseTwo ] = await Promise.all([
            await axiosInstanceUtilTenantOne.post(targetCredentialUrl, OAuth2CredentialArrayOne),
            await axiosInstanceUtilTenantTwo.post(targetCredentialUrl, OAuth2CredentialArrayTwo)
        ])
        
        function transformArray (inputArray) {
            let updatedArr = inputArray.map(item => 
                Object.fromEntries(
                    Object.entries(item).map(([key, value]) => 
                        key === "Password" ? ["ClientSecret", value] : [key, value]
                    )
                )
            );

            return updatedArr;
        }

        const lastSyncInfoFromUFMSyncHeader = await UFMSyncHeader.findOne({ 
            where: { 
                    ufm_profile_id: ufmProfileId,
                    ufm_component_type_id: componentTypeId,
                    is_last_record: true 
                }
            }
        );
        let last_sync_on = null;
        if (lastSyncInfoFromUFMSyncHeader) {
            last_sync_on = lastSyncInfoFromUFMSyncHeader.ufm_last_synced_on;
        }     

       const mainResponseArray = {
             last_sync_on,
             tenantOneOAuth2Credentials: mapToOAuth2Credentials( transformArray(utilResponseOne.data) ) , 
             tenantTwoOAuth2Credentials: mapToOAuth2Credentials( transformArray(utilResponseTwo.data) ) 
       }

    //    return sendResponse(
    //     res, // response object
    //     true, // success
    //     HttpStatusCode.Ok, // statusCode
    //     responseObject.API_RESPONSE_OK, // status type
    //     `List of all OAuth2 Credentials for both tenants`, // message
    //     mainResponseArray
    // );

        return res.status(200).json( { data: mainResponseArray })
    } catch(error) {
        console.log('Error in service fn getOAuth2Credentials: ', error);
        return sendResponse(
            res, // response object
            false, // success
            HttpStatusCode.InternalServerError, // statusCode
            responseObject.INTERNAL_SERVER_ERROR, // status type
            `Internal Server Error in listing OAuth2 Credentials: ${error.message}`, // message
            {}
        );
        // return res.status(500).json({ error: `Internal server error: ${err.message}`}) 
    }
}

const copyOAuth2CredentialsInfo = async( req, res) => {
        const transaction = await sequelize.transaction();
        try {
        const { ufm_profile_id, component_type_id, user_id, payload } = req.body;
    
        
        console.log(`ufm_profile_id: ${ufm_profile_id}, component_type_id: ${component_type_id}`);
    
        const ufmProfileResponse = await UFMProfile.findOne( {
            where: {
                ufm_profile_id: ufm_profile_id
            },
            transaction
        })
        
        if (!ufmProfileResponse) {
            return res.status(400).json({ error: "UFM Profile id not found"})
        }
    
        const [
             tenantOneBearerToken, tenantTwoBearerToken,
             tenantOneDbResponse, tenantTwoDbResponse 
        ] = await getBearerTokenForTenants(
            ufmProfileResponse.ufm_profile_primary_tenant_id, 
            ufmProfileResponse.ufm_profile_secondary_tenant_id);
        
        const tenantOneUtilBearerToken = await getBearerTokenForIFlow (tenantOneDbResponse) ;
        
        const axiosInstanceUtilTenantOne = axiosInstance({
            url: tenantOneDbResponse.tenant_util_host_url,
            headers: {
                'CredentialType': 'OAuth2',
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            token: tenantOneUtilBearerToken
        })

        const axiosInstanceTenantTwo = axiosInstance({
            url: tenantTwoDbResponse.tenant_host_url,
            token: tenantTwoBearerToken
        });
    
        const updateResult = await UFMSyncHeader.update(
            { is_last_record: false },
            { where: 
                { 
                    ufm_profile_id: ufm_profile_id,
                    ufm_component_type_id: component_type_id,
                    is_last_record: true 
                }
            , transaction 
            }
          );
    
          const newUFMSyncHeader = await UFMSyncHeader.create({
            ufm_profile_id: ufm_profile_id,
            ufm_component_type_id: component_type_id,
            is_last_record: true,
            created_by: user_id, // this is from FE
            modified_by: user_id, // this is from FE
          }, 
          { transaction }
        );
    
        const createOrUpdateOAuth2Credentials = async (credential) => {

            const targetUrl = credential.doesExistOnTarget 
                ? `/api/v1/OAuth2ClientCredentials('${credential.Name}')`
                : '/api/v1/OAuth2ClientCredentials';
            const requestMethod = credential.doesExistOnTarget ? 'put' : 'post';

            // get clientSecret from Util
            let targetCredentialUrl = `/http/GetCredentials`;
            let utilResponse = await axiosInstanceUtilTenantOne.post(targetCredentialUrl, [
                {
                    Name: `${credential.Name}`
                }
            ])

            const nameFromUtil =  utilResponse.data[0].Name;
            const clientSecretFromUtil = utilResponse.data[0].Password;

            let response;
            if ( credential.doesExistOnTarget) {

                response = await axiosInstanceTenantTwo.put(encodeURI(targetUrl), {
                    "Name": credential.Name,
                    "Description": credential.Description,
                    "TokenServiceUrl": credential.TokenServiceUrl,
                    "ClientId": credential.ClientId,
                    "ClientSecret": clientSecretFromUtil,
                    "ClientAuthentication": credential.ClientAuthentication,
                    "Scope": credential.Scope,
                    "ScopeContentType": credential.ScopeContentType,
                    "Resource": credential.Resource,
                    "Audience": credential.Audience
                    // "Type": "CREDENTIALS",
                    // "DeployedBy": "DL7152",
                    // "DeployedOn": "/Date(1689921881599)/",
                    // "Status": "DEPLOYED"
                })
            } else {
                delete credential.doesExistOnTarget;
                credential.ClientSecret = utilResponse.data[0].Password;
    
                response = await axiosInstanceTenantTwo.post(targetUrl, {
                    ...credential
                 })
            }
    
            if (response) {
                console.log(`${requestMethod.toUpperCase()} response done for:`, credential.Name);
                await UFMSyncDetail.create({
                    ufm_sync_header_id: newUFMSyncHeader.ufm_sync_header_id,
                    ufm_sync_oa2cc_name: credential.Name ,
                    ufm_sync_oa2cc_description:credential.Description ,
                    ufm_sync_oa2cc_token_service_url: credential.TokenServiceUrl,
                    ufm_sync_oa2cc_client_id:  credential.ClientId,
                    ufm_sync_oa2cc_client_secret: clientSecretFromUtil,
                    ufm_sync_oa2cc_client_authentication:credential.ClientAuthentication ,
                    ufm_sync_oa2cc_scope:  credential.Scope,
                    ufm_sync_oa2cc_scope_content_type: credential.ScopeContentType,
                    ufm_sync_oa2cc_resource:  credential.Resource ,
                    ufm_sync_oa2cc_audience: credential.Audience
                    // ufm_sync_oa2cc_type: ,
                    // ufm_sync_oa2cc_deployed_by: ,
                    // ufm_sync_oa2cc_status: ,
                }, { transaction });
            }
        };
    
        const promises = payload.map(createOrUpdateOAuth2Credentials);
        await Promise.all(promises);
        
        await transaction.commit();
        return res.status(200).json({ message: "OAuth2 Client credentials copied successfully"})
        } catch(err){
            await transaction.rollback();
            console.log('Error in service post user credential: ', err);
            return res.status(500).json({error:`Internal server Error: ${err.message}`})
        }
    
    }   

//----------------------------------------------------------------------------------------------//
// Non exported functions:

function flattenObjectsInArray (inputArray) {
    return inputArray.map(obj => {
        let newObj = { ...obj };
        for (let key in newObj) {
          if (typeof newObj[key] === 'object' && !Array.isArray(newObj[key])) {
            newObj = { ...newObj, ...newObj[key] };
            delete newObj[key];
          }
        }
        return newObj;
      });
}

function mapToOAuth2Credentials(input) {

    const mapKeys = [
        "Name",
        "Description",
        "TokenServiceUrl",
        "ClientId",
        "ClientSecret",
        "ClientAuthentication",
        "Scope",
        "ScopeContentType",
        "Resource",
        "Audience",
        "Type",
        "DeployedBy",
        "DeployedOn",
        "Status"
    ];

    // Understanding this function is the key
    function mapKeysToObject(keys, source) {
        return keys.reduce((acc, key) => {
            acc[key] = source[key];
            return acc;
        }, {});
    }

    // Check if input is an array
    if (Array.isArray(input)) {
        return input.map(item => mapKeysToObject(mapKeys, item));
    }
    // Otherwise, assume input is an object
    return  mapKeysToObject(mapKeys, input);
}

module.exports = {
    getOAuth2Credentials,
    copyOAuth2CredentialsInfo
}