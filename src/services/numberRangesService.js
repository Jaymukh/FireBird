const sequelize = require("../dbconfig/config");
const UFMSyncDetail = require("../models/UFM/ufmSyncDetail");
const UFMSyncHeader = require("../models/UFM/ufmSyncHeader");
const UFMProfile = require("../models/ufmProfile");
const { getBearerTokenForTenants } = require("../util/auth");
const { axiosInstance } = require("./cpiClient");

const getAllNumberRangesInfo = async (ufmProfileId, componentTypeId, isCalledFromApi = false) => {
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
    
        const axiosInstanceTenantTwo = axiosInstance({
            url: tenantTwoDbResponse.tenant_host_url,
            token: tenantTwoBearerToken
        });
    
        let [numberRangesTenantOneResponse, numberRangesTenantTwoResponse ] = await Promise.all([
            await axiosInstanceTenantOne.get("/api/v1/NumberRanges"),
            await axiosInstanceTenantTwo.get("/api/v1/NumberRanges")
        ])

       let mainResponse ;
       if (isCalledFromApi) {

        mainResponse = [
            { tenantOneNumberRanges: numberRangesTenantOneResponse.data.d.results },
            { tenantTwoNumberRanges: numberRangesTenantTwoResponse.data.d.results }
        ]
        return mainResponse;
       } else {

        mainResponse = [
                { tenantOneNumberRanges: numberRangesTenantOneResponse.data.d.results },
                { tenantTwoNumberRanges: numberRangesTenantTwoResponse.data.d.results }
            ]
        return mainResponse;
       }


    } catch (error) {
        console.log('Error in getAllNumberRangesInfo: ', error.message);
        return error.message;
    }
}

const getAllNumberRanges = async (req, res) => {
    try {
        const { ufmProfileId, componentTypeId } = req.params;

    const isCalledFromApi = true;
    let mainResponse = await getAllNumberRangesInfo(ufmProfileId, componentTypeId, isCalledFromApi )
        
    if (!Array.isArray(mainResponse)) {
        return res.status(500).json({ error: mainResponse})
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
        
        return res.status(200).json({ 
            data: {
                last_sync_on,
                tenantOneNumberRanges: mainResponse[0].tenantOneNumberRanges,
                tenantTwoNumberRanges: mainResponse[1].tenantTwoNumberRanges,
            }
        });

    } catch(error) {
        console.log('Error in service fn getAllNumberRanges: ', error);
    }
}

const copyNumberRanges = async (req, res) => {
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

    const createOrUpdateNumberRanges = async (numberRangeObj) => {

        const targetUrl = numberRangeObj.doesExistOnTarget 
            ? `/api/v1/NumberRanges('${numberRangeObj.Name}')` // this is for put
            : '/api/v1/NumberRanges'; // this for post
        const requestMethod = numberRangeObj.doesExistOnTarget ? 'put' : 'post';
        
        let response;
        if ( numberRangeObj.doesExistOnTarget) {
            console.log('PUTTING FOR: ', numberRangeObj.Name);
            response = await axiosInstanceTenantTwo.put(encodeURI(targetUrl), {
                "Name": numberRangeObj.Name,
                "Description": numberRangeObj.Description,
                "MaxValue": numberRangeObj.MaxValue,
                "MinValue": numberRangeObj.MinValue,
                "Rotate": numberRangeObj.Rotate,
                "CurrentValue": numberRangeObj.CurrentValue,
                "FieldLength": numberRangeObj.FieldLength ,
                // "DeployedBy": numberRangeObj.DeployedBy ,
                // "DeployedOn": numberRangeObj.DeployedOn
            })
        } else {
            delete numberRangeObj.doesExistOnTarget;
            delete numberRangeObj.DeployedBy; 
            delete numberRangeObj.DeployedOn;

            console.log('POSTING FOR: ', numberRangeObj.Name);
            response = await axiosInstanceTenantTwo.post(targetUrl, {
                ...numberRangeObj
             })
        }

        if (response) {
            console.log(`${requestMethod.toUpperCase()} response done for:`, numberRangeObj.Name);
            await UFMSyncDetail.create({
                ufm_sync_header_id: newUFMSyncHeader.ufm_sync_header_id,
                ufm_sync_nv_name: numberRangeObj.Name ,
                ufm_sync_nv_description:  numberRangeObj.Description ,
                ufm_sync_nv_max_value: numberRangeObj.MaxValue ,
                ufm_sync_nv_min_value:  numberRangeObj.MinValue,
                ufm_sync_nv_rotate:  numberRangeObj.Rotate,
                ufm_sync_nv_current_value:  numberRangeObj.CurrentValue,
                ufm_sync_nv_field_length:  numberRangeObj.FieldLength ,
                ufm_sync_nv_deployed_by:  numberRangeObj.DeployedBy ,
                // ufm_sync_nv_deployed_on: ,
            }, { transaction });
        }
    };

    const promises = payload.map(createOrUpdateNumberRanges);
    await Promise.all(promises);
    
    await transaction.commit();

    return res.status(200).json({ message: "Number ranges copied successfully."})
    } catch(err){
        await transaction.rollback();
        console.log('Error in service fn: copyNumberRanges: ', err);
        return res.status(500).json({ error: `Internal server error: ${err.message}`})
    }
}

module.exports = {
    getAllNumberRanges,
    copyNumberRanges 
}