const UFMSyncDetail = require("../models/UFM/ufmSyncDetail");
const UFMSyncHeader = require("../models/UFM/ufmSyncHeader");
const UFMProfile = require("../models/ufmProfile");
const { getBearerTokenForTenants, getBearerTokenForIFlow } = require("../util/auth");
const { axiosInstance } = require("./cpiClient");
const  sequelize  = require("../dbconfig/config");
const { sendResponse } = require("../util/responseSender");
const { HttpStatusCode } = require("axios");
const { responseObject } = require("../constants/responseTypes");

const getUserCredentials = async (req, res) => {
    try {
        const { ufmProfileId, componentTypeId } = req.params;
        console.log(`ufmProfileId: ${ufmProfileId}, componentTypeId: ${componentTypeId}`);

        const ufmProfileResponse = await UFMProfile.findOne({
            where: {
                ufm_profile_id: ufmProfileId
            }
        })

        if (!ufmProfileResponse) {
            return res.status(400).json({ error: "UFM Profile id not found" })
        }

        const [
            tenantOneBearerToken, tenantTwoBearerToken,
            tenantOneDbResponse, tenantTwoDbResponse
        ] = await getBearerTokenForTenants(
            ufmProfileResponse.ufm_profile_primary_tenant_id,
            ufmProfileResponse.ufm_profile_secondary_tenant_id);

        const axiosInstanceTenantOne = axiosInstance({
            url: tenantOneDbResponse.tenant_host_url,
            token: tenantOneBearerToken
        });

        const axiosInstanceTenantTwo = axiosInstance({
            url: tenantTwoDbResponse.tenant_host_url,
            token: tenantTwoBearerToken
        });

        let runTimeResponse = {};
        let errorInfo = { utilErrorMessageTenantOne: null, utilErrorMessageTenantTwo: null };

        try {
            runTimeResponse['TenantOne'] = await axiosInstanceTenantOne.get("/api/v1/IntegrationRuntimeArtifacts('Util_GetCredentials')")
        } catch (error) {
            errorInfo.utilErrorMessageTenantOne = `Util_GetCredentials not deployed for tenant: ${tenantOneDbResponse.tenant_name}. Please deploy/check it`;
        }

        try {
            runTimeResponse['TenantTwo'] = await axiosInstanceTenantTwo.get("/api/v1/IntegrationRuntimeArtifacts('Util_GetCredentials')")
        } catch (error) {
            errorInfo.utilErrorMessageTenantTwo = `Util_GetCredentials not deployed for tenant: ${tenantTwoDbResponse.tenant_name}. Please deploy/check it`;
        }

        if (errorInfo.utilErrorMessageTenantOne && errorInfo.utilErrorMessageTenantTwo) {
            return res.status(200).json({ data: { utilErrorMessage: `Util_GetCredentials not deployed for tenant: ${tenantOneDbResponse.tenant_name} and ${tenantTwoDbResponse.tenant_name}. Please deploy/check it` } });
        } else if (errorInfo.utilErrorMessageTenantOne && !errorInfo.utilErrorMessageTenantTwo) {
            return res.status(200).json({ data: { utilErrorMessage: errorInfo.utilErrorMessageTenantOne } });
        } else if (errorInfo.utilErrorMessageTenantTwo && !errorInfo.utilErrorMessageTenantOne) {
            return res.status(200).json({ data: { utilErrorMessage: errorInfo.utilErrorMessageTenantTwo } });
        }

        const updatedCred = await Promise.all([
            getUpdatedUtil(tenantOneDbResponse, axiosInstanceTenantOne),
            getUpdatedUtil(tenantTwoDbResponse, axiosInstanceTenantTwo)
        ]);

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

        const mainResponseArrays = {
            last_sync_on,
            tenantOneUserCredentials: updatedCred[0],
            tenantTwoUserCredentials: updatedCred[1]
        };
        return res.status(200).json({ data: mainResponseArrays });
    } catch (error) {
        console.log('Error in service fn getUserCredentials: ', error);
        return res.status(500).json({ error: error.message});
    }
}

const getUpdatedUtil = async (DBResponse, axiosInstanceTenant) => {
    try {
        const response = await axiosInstanceTenant.get("/api/v1/UserCredentials");

        const userCreds = response.data.d.results;

        const iFlowToken = await getBearerTokenForIFlow(DBResponse);
        const axiosInstanceUtilTenant = axiosInstance({
            url: DBResponse.tenant_util_host_url,
            headers: {
                'CredentialType': 'UserCredential',
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            token: iFlowToken
        });

        const targetCredentialUrl = `/http/GetCredentials`;
        const utilInfo = await axiosInstanceUtilTenant.post(targetCredentialUrl, userCreds);

        if (utilInfo.status !== 200) {
            return userCreds;
        }

        const utilResponseMap = new Map(utilInfo.data.map(item => {
            let Credential = {
                Password: item.Password,
                Status: item.SecurityArtifactDescriptor.Status,
                User: item.User
            };
            return [item.Name, Credential];
        }));

        userCreds.forEach(item => {
            const util = utilResponseMap.get(item.Name);
            if (util.User = item.User) {
                item.Password = util.Password;
                item.Status = util.Status;
                item.isPasswordCorrupt = (util.Status == "NOT_FOUND" || util.Password === null) ? true : false;
            }
        });

        return userCreds.filter( item => item.Status !== "NOT_FOUND" && item.Kind !== 'oauth2:default')
    } catch (error) {
        console.log(error);
        console.log('error in getUpdatedUtil');
        throw new Error(error);
    }
}

const copyUserCredentialsInfo = async (req, res) => {

    const transaction = await sequelize.transaction();
    try {
    const { ufm_profile_id, component_type_id, user_id, payload } = req.body;

    
    console.log(`ufm_profile_id: ${ufm_profile_id}, component_type_id: ${component_type_id}`);

    const ufmProfileResponse = await UFMProfile.findOne( {
        where: {
            ufm_profile_id: ufm_profile_id
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
    
    const tenantOneUtilBearerToken = await getBearerTokenForIFlow (tenantOneDbResponse) ;


    const axiosInstanceUtilTenantOne = axiosInstance({
        url: tenantOneDbResponse.tenant_util_host_url,
        headers: {
            'CredentialType': 'UserCredential',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        token: tenantOneUtilBearerToken
    })

    const axiosInstanceTenantTwo = axiosInstance({
        url: tenantTwoDbResponse.tenant_host_url,
        token: tenantTwoBearerToken
    });

    let targetCredentialUrl = `/http/GetCredentials`;
    let utilResponse = await axiosInstanceUtilTenantOne.post(targetCredentialUrl,payload)
    if ( utilResponse) {
        console.log('Got util response');
    }

    let validCredentialPayload = [];
    let invalidCredentials = [];
    let validNames = []
    let inputData = utilResponse.data
    for ( let i = 0; i < inputData.length; i++) {
        // if ( inputData[i].SecurityArtifactDescriptor.Status === "NOT_FOUND" ) 
            validNames.push (inputData[i].Name)
            validCredentialPayload.push( inputData[i])
        
    }

    const updateResult =    await UFMSyncHeader.update(
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

    const createOrUpdateUserCredentials = async (credential) => {
        try {
        const targetUrl = credential.doesExistOnTarget 
            ? `/api/v1/UserCredentials('${credential.Name}')`
            : '/api/v1/UserCredentials';
        const requestMethod = credential.doesExistOnTarget ? 'put' : 'post';

        const foundElement = validCredentialPayload.find(element => element['Name'] === credential.Name);

        let response;

            if ( credential.doesExistOnTarget) {
    
                response = await axiosInstanceTenantTwo.put(encodeURI(targetUrl), {
                    "Name": credential.Name,
                    "Kind": credential.Kind,
                    "Description": credential.Description,
                    "User": credential.User,
                    "Password": foundElement.Password === null ? "" : foundElement.Password,
                    "CompanyId": credential.CompanyId
                })
            } else {
                console.log('\ndoes Exist', doesExistOnTarget)
                delete credential.doesExistOnTarget;
                delete credential.SecurityArtifactDescriptor;
                delete credential.__metadata;

                console.log('\nPOST FOR ', JSON.stringify( credential , null, 2));

                if (foundElement.Password === null) {
                    console.log('\nZY Found Element Password: ', foundElement.Password, credential.Name)
                } else {
                    console.log('2. Password',  foundElement.Password);
                }
    
                response = await axiosInstanceTenantTwo.post(targetUrl, {
                    ...credential, 
                    "Password": foundElement.Password === null ? "" : foundElement.Password
                 })
            }
       
            if (response) {
                console.log(`${requestMethod.toUpperCase()} response done for:`, credential.Name);
                await UFMSyncDetail.create({
                    ufm_sync_header_id: newUFMSyncHeader.ufm_sync_header_id,
                    ufm_sync_uc_name: credential.Name,
                    ufm_sync_uc_kind: credential.Kind,
                    ufm_sync_uc_description: credential.Description,
                    ufm_sync_uc_user: credential.User,
                    ufm_sync_uc_password: foundElement.Password === null ? "" : foundElement.Password,
                    ufm_sync_uc_company_id: credential.CompanyId,
                }, { transaction });
            }
        } catch(error) {
            invalidCredentials.push(credential.Name)
        }
    };

    const promises = validCredentialPayload.map(createOrUpdateUserCredentials);
    await Promise.all(promises);
    
    await transaction.commit();

    if (invalidCredentials.length) {
        return res.status(200).json({ invalidCredentials })
    }

    return res.status(200).json({ message: "User credentials copied successfully"})
    
  } catch(err){
        await transaction.rollback();
        console.log('Error in service post user credential: ');
        return sendResponse(
            res, // response object
            false, // success
            HttpStatusCode.InternalServerError, // statusCode
            responseObject.INTERNAL_SERVER_ERROR, // status type
            `${err.message}`, // message
            {}
        );
        // return res.status(500).json({ error: `Internal Server Error: ${err.message}`})
    }

}   

//----------------------------------------------------------------------------------------------//
// Non exported functions:
function mapToUserCredentials(input) {

    const mapKeys = [
        "Name",
        "Kind",
        "Description",
        "User",
        "Password",
        "CompanyId"
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
    getUserCredentials,
    copyUserCredentialsInfo
}