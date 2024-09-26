const sequelize = require("../dbconfig/config");
const UFMSyncDetail = require("../models/UFM/ufmSyncDetail");
const UFMSyncHeader = require("../models/UFM/ufmSyncHeader");
const UFMProfile = require("../models/ufmProfile");
const { getBearerTokenForTenants } = require("../util/auth");
const { axiosInstance } = require("./cpiClient");
const { sendResponse } = require("../util/responseSender");
const { HttpStatusCode } = require("axios");
const { responseObject } = require("../constants/responseTypes");

const getKeyStoreValues = async (tenantOneId, tenantTwoId, isCalledFromAPI = false) => {
    console.log('Is called from API: ', isCalledFromAPI)
    try {
        const [
            tenantOneBearerToken, tenantTwoBearerToken,
            tenantOneDbResponse, tenantTwoDbResponse 
       ] = await getBearerTokenForTenants(tenantOneId, tenantTwoId);

    const axiosInstanceTenantOne = axiosInstance({
        url: tenantOneDbResponse.tenant_host_url,
        token: tenantOneBearerToken
    });

    const axiosInstanceTenantTwo = axiosInstance({
        url: tenantTwoDbResponse.tenant_host_url,
        token: tenantTwoBearerToken
    });

    let [keystoreTenantOneResponse, keystoreTenantTwoResponse ] = await Promise.all([
        await axiosInstanceTenantOne.get("/api/v1/KeystoreEntries"),
        await axiosInstanceTenantTwo.get("/api/v1/KeystoreEntries")
    ])

    // Dont want keystore entries with Owner "SAP" -> so they wouldn't be synced either
    let tenantOneKeystore = keystoreTenantOneResponse.data.d.results.filter(item => item.Owner !== "SAP");
    let tenantTwoKeystore = keystoreTenantTwoResponse.data.d.results.filter(item => item.Owner !== "SAP");

    if (isCalledFromAPI) {
        return { 
            tenantOneKeystore: mapToKeystore( tenantOneKeystore ), 
            tenantTwoKeystore: mapToKeystore( tenantTwoKeystore )
        } 

    } else {
        return  { 
            tenantOneKeystore: mapToKeystore( tenantOneKeystore ), 
            tenantTwoKeystore: mapToKeystore( tenantTwoKeystore )
        } 
    }
   
    } catch(error) {
        console.log('Error in controller: getKeyStoreValues: ', error);
        return error.message;
    }
} 

const getKeyStoreValuesForTenants = async (req, res) => {
    const  {tenantOneId, tenantTwoId, ufmProfileId, componentTypeId } = req.params;
    try {
    let isCalledFromAPI = true;// This flag is needed so that we could change  response for fn:getKeyStoreValues
    let mainResponseArray = await getKeyStoreValues(tenantOneId, tenantTwoId, isCalledFromAPI);

    const lastSyncInfoFromUFMSyncHeader = await UFMSyncHeader.findOne(
        { where: 
            { 
            ufm_profile_id: ufmProfileId,
            ufm_component_type_id: componentTypeId,
            is_last_record: true 
        }
    }
      );

      if(lastSyncInfoFromUFMSyncHeader) {
        mainResponseArray.last_sync_on = lastSyncInfoFromUFMSyncHeader.ufm_last_synced_on;
      } else {
        mainResponseArray.last_sync_on = null;
      }
            
    if (typeof mainResponseArray === "string") {
        return sendResponse(
            res, // response object
            false, // success
            HttpStatusCode.InternalServerError, // statusCode
            responseObject.INTERNAL_SERVER_ERROR, // status type
            `Internal Server Error: ${mainResponseArray}`, // message
            {}
        );
    }

    return sendResponse(
        res, // response object
        true, // success
        HttpStatusCode.Ok, // statusCode
        responseObject.RECORD_FOUND, // status type
        `List of keystore values for tenants`, // message
         mainResponseArray
    );
    // return res.status(200).json({ data: mainResponseArray });
 } catch(error) {
    console.log('Error in get Keystore list: ', error);
    return sendResponse(
        res, // response object
        false, // success
        HttpStatusCode.InternalServerError, // statusCode
        responseObject.INTERNAL_SERVER_ERROR, // status type
        `Internal Server Error: ${error.message}`, // message
        {}
    );
 }
}

// In copy certificates 
const copyCertificates = async (req, res) => {
    const {ufm_profile_id, component_type_id, user_id } = req.body;

    const transaction = await sequelize.transaction();
    try {
        const ufmProfileResponse = await UFMProfile.findOne( {
            where: {
                ufm_profile_id: ufm_profile_id
            },
        } ,{ transaction })

        if (!ufmProfileResponse) {
            return sendResponse(
                res, // response object
                false, // success
                HttpStatusCode.NotFound, // statusCode
                responseObject.RECORD_NOT_FOUND, // status type
                `UFM profile id: ${ufm_profile_id}, record not found`, // message
                 {}
            );
            // return res.status(400).json({ error: "UFM Profile id not found"})
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
        }, "tenantOne");

        const axiosInstanceTenantTwo = axiosInstance({
            url: tenantTwoDbResponse.tenant_host_url,
            headers: {
                "Content-Type": "application/pkix-cert",
                "Accept": "application/json"
            },
            token: tenantTwoBearerToken
        }, "tenantTwo");

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
        // if keystore Hexalias Exists on target then -> update = true
        // if keystore Hexalias not Exists on target then -> update = false
        
        const isCalledFromAPI = false;
        const keystoreList = await  getKeyStoreValues(
             ufmProfileResponse.ufm_profile_primary_tenant_id, 
             ufmProfileResponse.ufm_profile_secondary_tenant_id, 
             isCalledFromAPI);
        
        // let tenantOneKeystoreList = keystoreList.tenantOneKeystore;
        let tenantOneKeystoreList = keystoreList.tenantOneKeystore;
        let tenantTwoKeystoreList = keystoreList.tenantTwoKeystore;
        let errorKeysValue = [];
        let successArray = [];
        let bulkCreateArray = [];
        const updatePromises = tenantOneKeystoreList.map(async (keystoreObj) => {
            const sourceUrl = `/api/v1/KeystoreEntries('${keystoreObj.Hexalias}')/Certificate/$value`;
            let hexAliasExists = tenantTwoKeystoreList.some(item => item.Hexalias === keystoreObj.Hexalias);
            console.log(`for t1:${keystoreObj.Hexalias}, hexAliasExists: ${hexAliasExists}`);
            try {
                const response = await axiosInstanceTenantOne.get(sourceUrl);
                const inputCertificate = Buffer.from(response.data, 'utf8').toString("utf8");
                const targetUrl = encodeURI(`/api/v1/CertificateResources('${keystoreObj.Hexalias}')/$value?fingerprintVerified=true&returnKeystoreEntries=true&update=${hexAliasExists}`);
                try {
                    
                    const updatedResponse = await axiosInstanceTenantTwo.put(targetUrl, inputCertificate);
                    if (updatedResponse) {
                        console.log(`\nDone for Hexalias: ${keystoreObj.Hexalias}`);
                        successArray.push({ 
                            hexAlias: keystoreObj.Hexalias,
                            alias: keystoreObj.Alias,
                            owner: keystoreObj.Owner
                         })
                        
                        await UFMSyncDetail.create({
                            ufm_sync_header_id: newUFMSyncHeader.ufm_sync_header_id,
                            ufm_sync_ks_hexalias: keystoreObj.Hexalias ,
                            ufm_sync_ks_alias: keystoreObj.Alias ,
                            ufm_sync_ks_key_type:keystoreObj.KeyType ,
                            ufm_sync_ks_key_size: keystoreObj.KeySize,
                            ufm_sync_ks_valid_not_before: keystoreObj.ValidNotBefore,
                            ufm_sync_ks_valid_not_after:keystoreObj.ValidNotAfter,
                            ufm_sync_ks_serial_number:keystoreObj.SerialNumber,
                            ufm_sync_ks_signature_algorithm:  keystoreObj.SignatureAlgorithm,
                            ufm_sync_ks_subject_dn:keystoreObj.SubjectDN,
                            ufm_sync_ks_issuer_dn:  keystoreObj.IssuerDN,
                            ufm_sync_ks_version: keystoreObj.Version,
                            ufm_sync_ks_fingerprint_sha1: keystoreObj.FingerprintSha1 ,
                            ufm_sync_ks_fingerprint_sha256: keystoreObj.FingerprintSha256,
                            ufm_sync_ks_fingerprint_sha512: keystoreObj.FingerprintSha512,
                            ufm_sync_ks_type: keystoreObj.Type,
                            ufm_sync_ks_owner: keystoreObj.Owner,
                            ufm_sync_ks_last_modified_by: keystoreObj.LastModifiedBy,
                            ufm_sync_ks_last_modified_time: keystoreObj.LastModifiedTime,
                            ufm_sync_ks_created_by: keystoreObj.CreatedBy,
                            ufm_sync_ks_created_time: keystoreObj.CreatedTime,
                            ufm_sync_ks_status: keystoreObj.Status,
                        }, { transaction });
                    }
                } catch (err) {
                    console.log('----------------Err: for hexalias', keystoreObj.Hexalias, err.message);
                    errorKeysValue.push({ 
                        hexalias: keystoreObj.Hexalias, 
                        alias: keystoreObj.Alias,
                        errMsg: err.message,
                        owner: keystoreObj.Owner
                    })

                }
               
         
                
            } catch (error) {
                // accomodate -> 
                console.error(`Error processing Hexalias`);
            }
        });

        
        // Await all promises
        await Promise.all(updatePromises);

        // await UFMSyncDetail.bulkCreate(bulkCreateArray, {transaction})
        // if (!errorKeysValue.length) {
        //     await transaction.commit();
        // }
        await transaction.commit();
        return res.status(200).json({ message: "Certificates copied", errorKeysValue, successArray,
            last_sync_on: newUFMSyncHeader.ufm_last_synced_on
        })

    } catch(error) {
        await transaction.rollback();
        console.log('Error in service copyCertificates: ', error);
        return sendResponse(
            res, // response object
            false, // success
            HttpStatusCode.InternalServerError, // statusCode
            responseObject.INTERNAL_SERVER_ERROR, // status type
            `Internal Server Error: ${error.message}`, // message
            {}
        );
        // return res.status(500).json({ error: `Internal Server Error: ${error.message}`})
    }

}

//----------------------------------------------------------------------------------------------//
// Non exported functions:
function mapToKeystore(input) {

    const mapKeys = [
        "Hexalias",
        "Alias",
        "KeyType",
        "KeySize",
        "ValidNotBefore",
        "ValidNotAfter",
        "SerialNumber",
        "SignatureAlgorithm",

        "EllipticCurve",
        "Validity",
        "SubjectDN",
        "IssuerDN",
        "Version",
        "FingerprintSha1",
        "FingerprintSha256",
        "FingerprintSha512",
        "Type",
        "Owner",
        "LastModifiedBy",
        "LastModifiedTime",
        "CreatedBy",
        "CreatedTime",
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
    getKeyStoreValuesForTenants,
    copyCertificates
}