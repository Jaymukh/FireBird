const sequelize = require("../dbconfig/config");
const UFMProfile = require("../models/ufmProfile");
const { getBearerTokenForTenants, getBearerTokenForIFlow } = require("../util/auth");
const { axiosInstance } = require("./cpiClient");
const unzipper = require('unzipper');
const { Writable } = require('stream');
const { sendResponse } = require("../util/responseSender");
const { HttpStatusCode } = require("axios");
const { responseObject } = require("../constants/responseTypes");
const UFMSyncHeader = require("../models/UFM/ufmSyncHeader");

const getAllVariablesInfo = async (ufmProfileId,componentTypeId, isCalledFromApi = false) => {
    try {

        const ufmProfileResponse = await UFMProfile.findOne( {
            where: {
                ufm_profile_id: ufmProfileId
            }
        })
        
        if (!ufmProfileResponse) {
            throw Error('UFM profile not found');
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
    
        const axiosInstanceForStreamTenantOne = axiosInstance({
            url: tenantOneDbResponse.tenant_host_url,
            responseType: 'stream',
            token: tenantOneBearerToken
        });

        const axiosInstanceTenantTwo = axiosInstance({
            url: tenantTwoDbResponse.tenant_host_url,
            token: tenantTwoBearerToken
        });

        const axiosInstanceForStreamTenantTwo = axiosInstance({
            url: tenantTwoDbResponse.tenant_host_url,
            responseType: 'stream',
            token: tenantTwoBearerToken
        })
    
        let [variablesTenantOneResponse, variablesTenantTwoResponse ] = await Promise.all([
            await axiosInstanceTenantOne.get("/api/v1/Variables"),
            await axiosInstanceTenantTwo.get("/api/v1/Variables")
        ]);

        async function extractVariableValues(variableObj, axiosInstance) {
            try {
                const url = `/api/v1/Variables(VariableName='${variableObj.VariableName}',IntegrationFlow='${variableObj.IntegrationFlow}')/$value`;
            
                const response = await axiosInstance.get(url);
                if (!response.data) {
                  throw new Error('No data received for variable');
                }
            
      // This portion sets up a writable stream to capture the content of the file inside the zip archive.
                let fileContent = '';
                const writableStream = new Writable({
                  write(chunk, encoding, callback) {
                    fileContent += chunk.toString();
                    callback();
                  }
                });
      
       //This portion sets up a writable stream to capture the content of the file inside the zip archive.     
                await new Promise((resolve, reject) => {
                  response.data
                    .pipe(unzipper.ParseOne('headers.prop'))
                    .pipe(writableStream)
                    .on('finish', resolve)
                    .on('error', reject);
                });
                
      //This portion parses the accumulated content of the extracted file (fileContent) into a key-value object.
                const variables = fileContent.split('\n').reduce((acc, line) => {
                  const [key, value] = line.split('=');
                  if (key && value) acc[key.trim()] = value.trim();
                  return acc;
                }, {});
            
                // if variable value is undefined, assign it an empty string
                const variableValue = variables[variableObj.VariableName] || '';
                return {...variableObj, variableValue };
              } catch (error) {
                console.error('Error extracting variable value:', 
                    variableObj.VariableName, 
                    error.message
                );
                return null;
              }

        } 

        let tenantOneVariables = variablesTenantOneResponse.data.d.results;
        let tenantTwoVariables = variablesTenantTwoResponse.data.d.results;

        // extracting only global variables from the result of api response
        tenantOneVariables = tenantOneVariables.filter( item => item.Visibility === 'Global');
        tenantTwoVariables = tenantTwoVariables.filter( item => item.Visibility === 'Global');

        const promisesT1 = tenantOneVariables.map(variableObj => extractVariableValues(variableObj, axiosInstanceForStreamTenantOne));
        const promisesT2 = tenantTwoVariables.map(variableObj => extractVariableValues(variableObj, axiosInstanceForStreamTenantTwo));
        
        let [tenantOneVariableValues, tenantTwoVariableValues] = await Promise.all([
            Promise.all(promisesT1), 
            Promise.all(promisesT2)
        ]);

       let mainResponse ;
       if (isCalledFromApi) {

        mainResponse = [
            { tenantOneVariables: tenantOneVariableValues },
            { tenantTwoVariables: tenantTwoVariableValues }
        ]
        return mainResponse;
       } else {
            mainResponse = [
                { tenantOneVariables: tenantOneVariableValues },
                { tenantTwoVariables: tenantTwoVariableValues }
            ]
        return mainResponse
       }


    } catch (error) {
        console.log('Error in getAllVariablesInfo: ', error.message);
        return error.message;
    }
}

const getAllVariables = async (req, res) => {
    try {
        const { ufmProfileId, componentTypeId } = req.params;

    const isCalledFromApi = true;
    let mainResponse = await getAllVariablesInfo(ufmProfileId, componentTypeId, isCalledFromApi )
        
    if (!Array.isArray(mainResponse)) {
        return sendResponse(
            res, // response object
            false, // success
            HttpStatusCode.InternalServerError, // statusCode
            responseObject.INTERNAL_SERVER_ERROR, // status type
            mainResponse, // message contained in mainResponse
            {}
        );
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

    return sendResponse(
        res, // response object
        true, // success
        HttpStatusCode.Ok, // statusCode
        responseObject.API_RESPONSE_OK, // status type
        `Variables for the given ufm profile id: ${ufmProfileId} tenants`, // message
        {   last_sync_on,
            tenantOneVariables: mainResponse[0].tenantOneVariables,
            tenantTwoVariables: mainResponse[1].tenantTwoVariables,
        } // data
    )
        // return res.status(200).json({ 
        //     data: {
        //         tenantOneVariables: mainResponse[0].tenantOneVariables,
        //         tenantTwoVariables: mainResponse[1].tenantTwoVariables,
        //     }
        // });

    } catch(error) {
        console.log('Error in service fn getAllVariables: ', error);
        return sendResponse(
            res, // response object
            false, // success
            HttpStatusCode.InternalServerError, // statusCode
            responseObject.INTERNAL_SERVER_ERROR, // status type
            `Internal Server Error: in getting all global variables.`, // message
            {}
        );
        // return res.status(500).json({ error: `Internal Server Error: ${error.message}`})
    }

}

// here, we are copying variables from source to target tenant irrespective of whether they exist or not
// on target tenant

const copyVariablesFromSourceToTarget = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
    const { ufm_profile_id, component_type_id, user_id } = req.body;
        
    console.log(`ufm_profile_id: ${ufm_profile_id}, component_type_id: ${component_type_id}`);
    
    const ufmProfileResponse = await UFMProfile.findOne( {
        where: {
            ufm_profile_id: ufm_profile_id
        },
        transaction
    })
    
    if (!ufmProfileResponse) {
        return sendResponse(
            res, // response object
            false, // success
            HttpStatusCode.NotFound, // statusCode
            responseObject.RECORD_NOT_FOUND, // status type
            "UFM Profile id not found", // message contained in mainResponse
            {}
        );
        // return res.status(400).json({ error: "UFM Profile id not found"})
    }

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

    const [
         tenantOneBearerToken, tenantTwoBearerToken,
         tenantOneDbResponse, tenantTwoDbResponse 
    ] = await getBearerTokenForTenants(
        ufmProfileResponse.ufm_profile_primary_tenant_id, 
        ufmProfileResponse.ufm_profile_secondary_tenant_id);
    
    const tenantTwoUtilBearerToken = await getBearerTokenForIFlow (tenantTwoDbResponse) ;
    
    // This instance is to be used for setting up variable value in Tenant Two
    const axiosInstanceUtilTenantTwo = axiosInstance({
        url: tenantTwoDbResponse.tenant_util_host_url,
        token: tenantTwoUtilBearerToken
    })

    const axiosInstanceTenantOne = axiosInstance({
        url: tenantOneDbResponse.tenant_host_url,
        responseType: 'stream',
        token: tenantOneBearerToken
    });

  // since in the list call we are having global variables extracted, only the global variables
  // would be copied in this function copyVariablesFromSourceToTarget
  
    let isCalledFromApi = false; // because we need values only from the function getAllVariablesInfo
    let allVariables = await getAllVariablesInfo(ufm_profile_id, component_type_id, isCalledFromApi);
    let variablesFromTenantOne = allVariables[0].tenantOneVariables;
    const copiedVariables = [];
    const notCopiedVariables = [];

    async function processVariable(variableObj) {
        try {
          const url = `/api/v1/Variables(VariableName='${variableObj.VariableName}',IntegrationFlow='${variableObj.IntegrationFlow}')/$value`;
      
          const response = await axiosInstanceTenantOne.get(url);
          if (!response.data) {
            throw new Error('No data received for variable');
          }
      
// This portion sets up a writable stream to capture the content of the file inside the zip archive.
          let fileContent = '';
          const writableStream = new Writable({
            write(chunk, encoding, callback) {
              fileContent += chunk.toString();
              callback();
            }
          });

 //This portion sets up a writable stream to capture the content of the file inside the zip archive.     
          await new Promise((resolve, reject) => {
            response.data
              .pipe(unzipper.ParseOne('headers.prop'))
              .pipe(writableStream)
              .on('finish', resolve)
              .on('error', reject);
          });
          
//This portion parses the accumulated content of the extracted file (fileContent) into a key-value object.
          const variables = fileContent.split('\n').reduce((acc, line) => {
            const [key, value] = line.split('=');
            if (key && value) acc[key.trim()] = value.trim();
            return acc;
          }, {});
          console.log('\nVariables: ', variables)    
      
          // if variable value is undefined, assign it an empty string
          let variableValue = variables[variableObj.VariableName] || '';
         
          // prepare data for post call using util to Tenant two
          let inputData = {
            data: [
              {
                VariableName: variableObj.VariableName,
                VariableValue: variableValue
              }
            ]
          };

          console.log('Variable inputData: ', inputData);
          console.log('Variable parsed: ', JSON.parse(inputData));

      
          // make a post call to our util endpoint on tenant two to post the variable
          const setVariable = await axiosInstanceUtilTenantTwo.post('http/Util/SetVariable', JSON.parse(inputData));
      
          if (setVariable) {
            console.log('Variable set in tenant two using iflow for', variableObj.VariableName);
            copiedVariables.push(`${variableObj.VariableName}`); // push data into success array
          } else {
            console.log('Variable NOT set in tenant two using iflow for', variableObj.VariableName);
          }
        } catch (error) {
          console.error('Error processing variable:', variableObj.VariableName, error.message);
          notCopiedVariables.push( variableObj.VariableName);
        }
      }

      const promises = variablesFromTenantOne.map(processVariable);
      await Promise.all(promises);

      await transaction.commit()
      return sendResponse(
        res, // response object
        true, // success
        HttpStatusCode.Ok, // statusCode
        responseObject.API_RESPONSE_OK, // status type
        `Variables Copied successfully`, // message
        copiedVariables
    )

    // return res.status(200).json({ message: "Variables Copied successfully", copiedVariables})
    } catch(error) {
        await transaction.rollback()
        console.log('Error in service fn: copyVariablesFromSourceToTarget: ', error);
        return sendResponse(
            res, // response object
            false, // success
            HttpStatusCode.InternalServerError, // statusCode
            responseObject.INTERNAL_SERVER_ERROR, // status type
            `${error.message}`, // message
            {}
        );
        // return res.status(500).json({ error: `Internal Server Error: ${error.message}`})
    }

}

module.exports = {
    getAllVariables,
    copyVariablesFromSourceToTarget
}