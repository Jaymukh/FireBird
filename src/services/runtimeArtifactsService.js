const { getBearerTokenForTenants } = require('../util/auth');
const integrationPackageService = require('./IntegrationPackageService');
const { axiosInstance } = require("./cpiClient");
const {artifactTypes} = require("../constants/apiEndpoints")
const { HttpStatusCode } = require('axios');
const sequelize = require('../dbconfig/config');
const UFMProfile = require('../models/ufmProfile');
const UFMFailoverConfig = require('../models/UFM/ufmFailoverConfig');
const UFMFailoverConfigState = require('../models/UFM/ufmFailoverConfigState');
const UFMFailoverProcess = require('../models/UFM/ufmFailoverProcess');
const UFMFailoverProcessComponent = require('../models/UFM/ufmFailoverProcessComponent');
const { sendResponse } = require("../util/responseSender");
const { responseObject } = require("../constants/responseTypes");
const { 
    FAILOVER_PROCESS_STATUS, 
    FAILOVER_ENTRY_TYPE,
    SWITCH_BACK_PROCESS_STATUS, 
    SWITCH_BACK_ENTRY_TYPE
} = require("../constants/taxonomyValues");
const { Op } = require('sequelize');


const getSourceTenantRuntimeWithTargetTenantDesigntimeArtifacts = async (req, res) => {
    const { ufmProfileId } = req.params;
    try {
        const ufmProfileResponse = await UFMProfile.findOne({
            where: {
                ufm_profile_id: ufmProfileId
            },
        });

        if (!ufmProfileResponse) {
            return res.status(400).json({ error: "UFM Profile id not found" })
        }

        let { mainResponseArray, axiosInstanceTenantOne } = await integrationPackageService.getOneTenantPackagesWithArtifacts(ufmProfileResponse.ufm_profile_primary_tenant_id, true, false);

        let packagesWithArtifacts = mainResponseArray.packages; // using the packages for tenant 1

        let responseRuntime = await axiosInstanceTenantOne.get(`/api/v1/IntegrationRuntimeArtifacts`);
        let responseRuntimeResult = responseRuntime.data.d.results;
        // Create a map of runtime artifacts for quick lookup by Id
        let runtimeArtifactsMap = new Map(responseRuntimeResult.map(item => {
            let Runtime = {
                Version: item.Version,
                Type: item.Type,
                DeployedBy: item.DeployedBy,
                DeployedOn: item.DeployedOn,
                Status: item.Status,
                ErrorInformation: item.ErrorInformation
            }
            return [item.Id, Runtime]
        }));

        const configState = await UFMFailoverConfigState.findOne({
            where: {
                ufm_profile_id: ufmProfileId,
                is_last_record: true
            }
        });

        let failoverConfigData;

        if (configState && configState.config_state_id) {
            failoverConfigData = await UFMFailoverConfig.findAll({
                where: {
                    config_state_id: configState.config_state_id,
                    ufm_profile_id: ufmProfileId,
                },
            });
        }

        // let failoverConfigStateData = await UFMFailoverConfigState.findOne({
        //     where: {
        //         ufm_profile_id: ufmProfileId,
        //         is_last_record: true
        //     },
        //     include: [{
        //         model: UFMFailoverConfig,
        //         where: {
        //             ufm_profile_id: ufmProfileId,
        //         }
        //     }]
        // });

        let ufmFailoverConfigMap = new Map((failoverConfigData || []).map(item => {
            let config = {
                isRowSelected: item.config_component_row_select,
                priority: item.config_component_position,
                // configStateId: item.config_state_id
            }
            return [item.config_component_id, config];
        }));

        // Update artifact versions with runtime versions
        packagesWithArtifacts.forEach(item => {
            item.artifacts.forEach(artifactItem => {
                artifactItem.isDeployedOnPrimaryTenant = runtimeArtifactsMap.has(artifactItem.Id) ? true : false;
                if (runtimeArtifactsMap.has(artifactItem.Id)) {
                    artifactItem.Runtime = runtimeArtifactsMap.get(artifactItem.Id);
                }
                if (ufmFailoverConfigMap.has(artifactItem.Id)) {
                    const configs = ufmFailoverConfigMap.get(artifactItem.Id);
                    artifactItem.isRowSelected = configs.isRowSelected;
                    artifactItem.priority = configs.priority;
                    // artifactItem.configStateId = configs.configStateId;
                }
            });

        });
        
        // Return the updated packages with artifacts
        return res.status(HttpStatusCode.Ok).json({
            data: {
                key: mainResponseArray.key,
                packages: packagesWithArtifacts,
                configStateId: (failoverConfigData && failoverConfigData.length > 0) ? failoverConfigData[0].config_state_id : null
            }
        });
    } catch (error) {
        console.log('Service fn: getSourceTenantRuntimeWithTargetTenant error:', error);
        res.status(HttpStatusCode.NotFound).json({ 'message': 'Cannot get data.' });
    }
}

const postFailoverConfig = async (req, res) => {
    const userId = req.body.userId;
    const ufm_profile_id = req.body.ufmProfileId;
    const packagesWithArtifacts = req.body.packages;
    const transaction = await sequelize.transaction();
    try {
        await UFMFailoverConfigState.update(
            {
                is_last_record: false,
                modified_by: userId
            },
            {
                where: {
                    ufm_profile_id,
                    is_last_record: true
                },
                transaction
            }
        );

        const { config_state_id } = await UFMFailoverConfigState.create(
            {
                ufm_profile_id,
                is_last_record: true,
                created_by: userId,
                modified_by: userId
            },
            { transaction }
        );

        const configEntries = packagesWithArtifacts.flatMap(package => {
            return package.artifacts.map(artifact => {
                return {
                    config_state_id,
                    ufm_profile_id,
                    config_component_row_select: (artifact.isRowSelected ? artifact.isRowSelected : false),
                    config_component_position: (artifact.priority ? artifact.priority : null),
                    config_package_id: package.PackageId,
                    config_package_name: package.PackageName,
                    config_package_version: package.Version,
                    config_package_description: package.Description,
                    config_package_short_text: package.ShortText,
                    config_package_supported_platform: package.SupportedPlatform,
                    config_component_id: artifact.Id,
                    config_component_name: artifact.Name,
                    config_component_type: artifact.Type,
                    config_component_dt_version: artifact.Version,
                    config_component_rt_version: (artifact.Runtime ? artifact.Runtime.Version : null),
                    config_component_description: artifact.Description,
                    config_component_deployed_by: (artifact.Runtime ? artifact.Runtime.DeployedBy : null),
                    config_component_deployed_on: (artifact.Runtime ? Math.floor(new Date(artifact.Runtime.DeployedOn) / 1000) : null),
                }
            })
        });

        const configTableData = await UFMFailoverConfig.bulkCreate(configEntries, { transaction });

        if (configTableData) {
            await transaction.commit();
            return res.status(HttpStatusCode.Ok).json({ message: 'success' });
        } else {
            await transaction.rollback();
            return res.status(HttpStatusCode.InternalServerError).json({ 'message': 'Internal Server Error' });
        }

    } catch (error) {
        await transaction.rollback();
        console.log(error);
        return res.status(HttpStatusCode.InternalServerError).json({ 'message': 'Internal Server Error' });
    }

}


const schedulePlannedFailoverForTenants = async (req, res) => {
        const transaction = await sequelize.transaction();
    try {
        const { 
            ufm_profile_id, 
            config_state_id, 
            user_id,
            entry_type,
            is_planned_failover
        } = req.body;

        if (!entry_type) {
            return sendResponse(
                res, // response object
                false, // success
                HttpStatusCode.BadRequest, // statusCode
                responseObject.PARAMETER_MISSING, // status type
                `Need Process type: failover or switch back`, // message
                {}
            );
        } else if (entry_type) {
            let isCorrectEntry = false;
            if ( entry_type === "FAILOVER" || entry_type === "SWITCH_BACK") {
                isCorrectEntry = true;
            }

            if (!isCorrectEntry) {
                return sendResponse(
                    res, // response object
                    false, // success
                    HttpStatusCode.BadRequest, // statusCode
                    responseObject.WRONG_PARAMETER, // status type
                    `Need Process entry_type: FAILOVER or SWITCH_BACK`, // message
                    {}
                );
            }
 
        }

        if (!req.body.hasOwnProperty("is_planned_failover")) {
            return sendResponse(
                res, // response object
                false, // success
                HttpStatusCode.BadRequest, // statusCode
                responseObject.WRONG_PARAMETER, // status type
                `Need failover type: planned or unplanned`, // message
                {}
            );
        }

        // this query is a failsafe. In case the Failover/switchback buttons dont get enabled/disabled due
        // to some frontend issue, then this code block would not allow failover/switchback activity to happen again
        let avoidDuplicateActivityQuery = await UFMFailoverProcess.findOne( {
                where:  {
                    config_state_id : config_state_id, 
                    is_last_record: true,
                    is_process_initiated_progress_id: FAILOVER_PROCESS_STATUS.SCHEDULED
                }
               })
            
            if (avoidDuplicateActivityQuery) {
                if (avoidDuplicateActivityQuery.entry_type_id === FAILOVER_ENTRY_TYPE && entry_type === "FAILOVER") {
                    
                    return sendResponse(
                        res, // response object
                        false, // success
                        HttpStatusCode.BadRequest, // statusCode
                        responseObject.RESPONSE_NEGATIVE, // status type
                        `Already a Failover is scheduled, cannot schedule Failover again`, // message
                        {} // data
                    );
                }
    
                if (avoidDuplicateActivityQuery.entry_type_id === SWITCH_BACK_ENTRY_TYPE && entry_type === "SWITCH_BACK") {
    
                    return sendResponse(
                        res, // response object
                        false, // success
                        HttpStatusCode.BadRequest, // statusCode
                        responseObject.RESPONSE_NEGATIVE, // status type
                        `Already a Switchback is scheduled, cannot schedule Switchback again`, // message
                        {} // data
                    );
    
                }
    
            }

        // if any failover or switchback is in schedule or running
       let currentFailoverStatus = await UFMFailoverProcess.findOne( {
        where:  {
            // config_state_id : config_state_id, // irrespective of any config_state_id I should block
            entry_type_id: {
                [Op.or]: [
                    FAILOVER_ENTRY_TYPE,
                    SWITCH_BACK_ENTRY_TYPE
                  ]
            }, 
            is_process_initiated_progress_id: {
                [Op.or]: [
                    FAILOVER_PROCESS_STATUS.SCHEDULED,
                    FAILOVER_PROCESS_STATUS.RUNNING
                  ]
            },
            is_last_record: true
        }
       })

       if (currentFailoverStatus) {
        return sendResponse(
            res, // response object
            false, // success
            HttpStatusCode.BadRequest, // statusCode
            responseObject.IN_PROCESS_REJECTION, // status type
            `Already a Failover/Switchback operation in progress/scheduled, cannot proceed`, // message
            {}
        );
       }

        // creating data in order to save it for scheduling
        const ufmProfileResponse = await UFMProfile.findOne({
            where: {
                ufm_profile_id: ufm_profile_id
            },
            transaction
        });

        // if UFM profile Id not exists then send error
        if (!ufmProfileResponse) {
            return sendResponse(
                res, // response object
                false, // success
                HttpStatusCode.NotFound, // statusCode
                responseObject.RECORD_NOT_FOUND, // status type
                `UFM Profile Id: ${ufm_profile_id} not found!`, // message
                {}
            );
        }

        const configStateDataResponse = await UFMFailoverConfigState.findOne({
            where: {
                // ufm_profile_id: ufm_profile_id,
                config_state_id: config_state_id,
                is_last_record: true 
            },
            transaction
        })

        if(!configStateDataResponse) {
            return sendResponse(
                res, // response object
                false, // success
                HttpStatusCode.NotFound, // statusCode
                responseObject.RECORD_NOT_FOUND, // status type
                `config state id: ${config_state_id} data not found`, // message
                {} // data
            );
        }

        const configDataResponse = await UFMFailoverConfig.findAll({
            where: {
                config_state_id: configStateDataResponse.config_state_id,
                config_component_row_select: true // 
            },
            transaction
        });

        if (!configDataResponse) {
            return sendResponse(
                res, // response object
                false, // success
                HttpStatusCode.NotFound, // statusCode
                responseObject.RECORD_NOT_FOUND, // status type
                `config state Id: ${config_state_id} data not found for ufm failover config`, // message
                {} // data
            );
        }

        let processEntryType = 0;
        let processString = '';

        if (entry_type === "FAILOVER") {
            processString = 'Failover';
            processEntryType = FAILOVER_ENTRY_TYPE;
            

        } else if (entry_type === "SWITCH_BACK") {
            processString = 'Switch Back';
            processEntryType = SWITCH_BACK_ENTRY_TYPE;

        }

        await UFMFailoverProcess.update(
            { is_last_record: false },
            { where: 
                { 
                ufm_profile_id: ufm_profile_id,
                config_state_id: config_state_id,
                // entry_type_id: SWITCH_BACK_ENTRY_TYPE,
                is_process_initiated_progress_id: {
                    [Op.or]: [
                        SWITCH_BACK_PROCESS_STATUS.COMPLETED,
                        SWITCH_BACK_PROCESS_STATUS.FAILED
                      ]
                },
                is_last_record: true,
                 // potential place for is_planned_failover: is_planned_failover,
            }
            , transaction 
        });


        const failoverProcess = await UFMFailoverProcess.create(
            {   
                config_state_id: configStateDataResponse.config_state_id,
                ufm_profile_id: configStateDataResponse.ufm_profile_id,
                is_last_record: true, // 
                is_planned_failover: is_planned_failover,
                entry_type_id: processEntryType , 
                is_process_initiated_progress_id: FAILOVER_PROCESS_STATUS.SCHEDULED,
                process_started_on: Math.floor(Date.now() / 1000), // save as epoch time
                process_started_by: user_id,
                process_completed_on: null,
                created_by: user_id
            },
            { transaction }
        );

        const failoverProcessComponentData = [];
        configDataResponse.forEach( item => {
        let entry = {
                failover_process_id: failoverProcess.failover_process_id,
                config_id: item.config_id,
                config_package_id: item.config_package_id,
                config_package_name: item.config_package_name,
                config_component_id: item.config_component_id,
                config_component_name: item.config_component_name,
                config_component_type: item.config_component_type,
                config_component_position: item.config_component_position, // changed here
                config_component_dt_version: item.config_component_dt_version,
                primary_tenant_runtime_status: "PENDING", // state assigned by us 
                primary_tenant_runtime_error: null,
                primary_tenant_runtime_started_on: null,
                primary_tenant_runtime_completed_on: null,
                primary_tenant_runtime_status_last_updated_on: null,
                secondary_tenant_runtime_status: "PENDING", // state assigned by us
                secondary_tenant_runtime_error: null,
                secondary_tenant_runtime_started_on: null,
                secondary_tenant_runtime_completed_on: null,
                secondary_tenant_runtime_status_last_updated_on: null,
                created_on: Math.floor(Date.now() / 1000),
                created_by: user_id 
            }
            failoverProcessComponentData.push(entry);
        })

        try {
            const failoverProcessComponentsEntries = await UFMFailoverProcessComponent.bulkCreate(
                failoverProcessComponentData, { transaction }
            );
        } catch(error) {
            console.log('Error creating bulk records for failoverProcessComponent', error)
            throw Error('Error in creating bulk records for failoverProcessComponent')
        }


    transaction.commit();

    return res.status(200).json({ message: `${processString} scheduled successfully`});

    } catch(error) {
        console.log('Error in schedulePlannedFailoverForTenants: ', error);
        transaction.rollback();
        return sendResponse(
            res, // response object
            false, // success
            HttpStatusCode.InternalServerError, // statusCode
            responseObject.INTERNAL_SERVER_ERROR, // status type
            `Internal Server Error in schedule planned failover: ${error.message}`, // message
            {}
        );

    }
}

const getFailoverStatusForTenants = async (req,res) => {
    let responseMessage = ``;
    try {
        let data = {};
        let { ufmProfileId } = req.params;
        ufmProfileId = Number(ufmProfileId);

        
        // supersede everything --> disable both buttons -> if anything is running/scheduled
        let failoverArtifacts = [];
        let whereConditionSupersedingCase = {
            entry_type_id: {
                [Op.or]: [
                    FAILOVER_ENTRY_TYPE,
                    SWITCH_BACK_ENTRY_TYPE
                    ]
            },
            is_process_initiated_progress_id: {
                [Op.or]: [
                    FAILOVER_PROCESS_STATUS.SCHEDULED, // represents failover/switchback 
                    FAILOVER_PROCESS_STATUS.RUNNING     // represents failover/switchback 
                    ]
            },
            is_last_record: true
        }

        const failoverSupersedeQuery = await UFMFailoverProcess.findOne({
            where: whereConditionSupersedingCase
        });

        if (failoverSupersedeQuery) {

            failoverArtifacts = await UFMFailoverProcessComponent.findAll({
                where: {
                    failover_process_id:  failoverSupersedeQuery?.failover_process_id
                } 
            });
    
            data = {
            isPlannedFailover: failoverSupersedeQuery.is_planned_failover,
            processes: [
                {
                    type:"FAILOVER",
                    enableButtonFlag: false
                },
                {
                    type:"SWITCH_BACK",
                    enableButtonFlag: false
                }
            ],
            lineItemInfo: transformData(failoverArtifacts), // showing the current deployment status of artifacts
        }
        responseMessage = `A failover/switchback is running/scheduled, cannot enable both buttons`;
        
        // at last send the response data
        return sendResponse(
            res, // response object
            true, // success
            HttpStatusCode.Ok, // statusCode
            responseObject.RESPONSE_POSITIVE, // status type
            responseMessage, // message
            data
        );
        } // retain this superseding condition

            
       const ufmRecord = await UFMProfile.findOne({
        where: {
            ufm_profile_id : ufmProfileId
        }
       })
       
    //   let answer = await getRealtimeArtifactDeploymentStatus(ufmRecord);
    //   return res.status(200).json({ data: answer} );

       if (!ufmRecord) {
        responseMessage = `UFM profile id: ${ufmProfileId} does not exist`;
        return sendResponse(
            res, // response object
            true, // success
            HttpStatusCode.NotFound, // statusCode
            responseObject.RECORD_NOT_FOUND, // status type
            responseMessage, // message
            {}
        );
       }
       

        // if ufm Profile id is found: 
        // check for the latest record in the failover process for the ufm profile
       let latestActivity = await UFMFailoverProcess.findOne({
        where : {
            ufm_profile_id : ufmRecord.ufm_profile_id
        },
        order: [['process_started_on', 'DESC']]
       });

       if (!latestActivity) {
        data = {
            processes: [
                {
                    type:"FAILOVER",
                    enableButtonFlag: true
                },
                {
                    type:"SWITCH_BACK",
                    enableButtonFlag: false
                }
            ],
            lineItemInfo: [] // in initial condition 
        }
        responseMessage = `The artifacts are in initial state and ready to schedule a failover process.`
        return sendResponse(
            res, // response object
            true, // success
            HttpStatusCode.Ok, // statusCode
            responseObject.RESPONSE_POSITIVE, // status type
            responseMessage, // message
            data
        );
       }

        // check condition to disable failover button when failover is completed/failed for a
        // particular config state id. 
        let whereConditionButtonDisable = {
            // entry_type_id: FAILOVER_ENTRY_TYPE,
            config_state_id: latestActivity.config_state_id,
            is_process_initiated_progress_id: {
                [Op.or]: [
                    FAILOVER_PROCESS_STATUS.COMPLETED, 
                    FAILOVER_PROCESS_STATUS.FAILED     
                  ]
            },
            is_last_record: true
        }

        let buttonQueryResponse =  await UFMFailoverProcess.findOne({
            where: whereConditionButtonDisable
        });

        if (buttonQueryResponse) {

            failoverArtifacts = await UFMFailoverProcessComponent.findAll({
                where: {
                    failover_process_id:  buttonQueryResponse?.failover_process_id
                } 
            });

            if (buttonQueryResponse.entry_type_id === FAILOVER_ENTRY_TYPE) {
                if(  buttonQueryResponse.is_process_initiated_progress_id === FAILOVER_PROCESS_STATUS.COMPLETED 
                 ||  buttonQueryResponse.is_process_initiated_progress_id === FAILOVER_PROCESS_STATUS.FAILED ) {
                     data = {
                        isPlannedFailover: buttonQueryResponse.is_planned_failover,
                        processes: [
                            {
                                type:"FAILOVER",
                                enableButtonFlag: false
                            },
                            {
                                type:"SWITCH_BACK",
                                enableButtonFlag: true
                            }
                        ],
                        lineItemInfo: transformData(failoverArtifacts),
                     }

                     responseMessage =`Failover is done. Can schedule a Switchback`;

                    }
            }

            if (buttonQueryResponse.entry_type_id === SWITCH_BACK_ENTRY_TYPE) {
              if(  buttonQueryResponse.is_process_initiated_progress_id === SWITCH_BACK_PROCESS_STATUS.COMPLETED 
               ||  buttonQueryResponse.is_process_initiated_progress_id === SWITCH_BACK_PROCESS_STATUS.FAILED ) {
                data = {
                    isPlannedFailover: buttonQueryResponse.is_planned_failover,
                    processes: [
                        {
                            type:"FAILOVER",
                            enableButtonFlag: true
                        },
                        {
                            type:"SWITCH_BACK",
                            enableButtonFlag: false
                        }
                    ],
                    lineItemInfo: transformData(failoverArtifacts)
                }

                responseMessage =`Switchback is done. Can schedule a Failover`;

               }
            } 
   
        }

        return sendResponse(
            res, // response object
            true, // success
            HttpStatusCode.Ok, // statusCode
            responseObject.RESPONSE_POSITIVE, // status type
            responseMessage, // message
            data
         );

    } catch( error ) {
        console.log('Error in get failover status for tenants', error);
        responseMessage = `Error in get failover status for tenants. ${error.message}`
        return sendResponse(
            res, // response object
            false, // success
            HttpStatusCode.InternalServerError, // statusCode
            responseObject.INTERNAL_SERVER_ERROR, // status type
            responseMessage, // message
            {}
        );
    }

}

async function getRealtimeArtifactDeploymentStatus (ufmProfileResponse) {

    try {
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

       const ufmFailoverConfigStateResponse = await UFMFailoverConfigState.findOne({
            where: {
                ufm_profile_id: ufmProfileResponse.ufm_profile_id,
                is_last_record: true,
            }
       });

       if (!ufmFailoverConfigStateResponse) {
        throw Error('No config state saved for the ufm profile id');
       }

       const ufmFailoverConfigResponse = await UFMFailoverConfig.findAll({
        where:  {
            config_state_id: ufmFailoverConfigStateResponse.config_state_id,
            ufm_profile_id: ufmProfileResponse.ufm_profile_id,
            config_component_row_select: true,
            config_component_type: 'IntegrationDesigntimeArtifacts'
        }
       })

       if (!ufmFailoverConfigResponse) {
        throw Error('No config is saved for the config_state_id');
       }

       const dataArray = await Promise.all(ufmFailoverConfigResponse.map(async (ufmConfigItem) => {
        const artifactUrl = `/api/v1/IntegrationRuntimeArtifacts('${ufmConfigItem.config_component_id}')`;

        const data = {
            config_id: null,  // since we are trying to send realtime data, it would be null
            failover_process_id: null, // since we are trying to send realtime data, it would be null
            config_package_id: ufmConfigItem.config_package_id,
            config_package_name: ufmConfigItem.config_package_name,
            config_component_id: ufmConfigItem.config_component_id,
            config_component_name: ufmConfigItem.config_component_name,
            config_component_type: ufmConfigItem.config_component_type,
            config_component_position: ufmConfigItem.config_component_position,
            config_component_dt_version: ufmConfigItem.config_component_dt_version,
        };

        const [primaryData, secondaryData] = await Promise.all([
            getDeploymentStatus(axiosInstanceTenantOne, artifactUrl, 'primary_tenant'),
            getDeploymentStatus(axiosInstanceTenantTwo, artifactUrl, 'secondary_tenant')
        ]);

        return { ...data, ...primaryData, ...secondaryData };
    }));
       
    return dataArray;

    } catch(error) {
        console.log('\nError in function getRealtimeArtifactDeploymentStatus: ', error.message)
        return [];
    }
}

async function getDeploymentStatus(axiosInstance, artifactUrl, tenantType) {
    const data = {
        [`${tenantType}_runtime_status`]: null,
        [`${tenantType}_runtime_error`]: null,
        [`${tenantType}_runtime_started_on`]: null,
        [`${tenantType}_runtime_completed_on`]: null,
        [`${tenantType}_runtime_status_last_updated_on`]: null
    };

    try {
        const response = await axiosInstance.get(artifactUrl);
        if (response && response.data.d.Status === "STARTED") {
            data[`${tenantType}_runtime_status`] = "DEPLOYED";
        } else {
            data[`${tenantType}_runtime_status`] = "DEPLOYMENT_ERROR";
        }
    } catch (error) {
        if (error?.response?.status === 404) {
            data[`${tenantType}_runtime_status`] = "UNDEPLOYED";
        } else {
            data[`${tenantType}_runtime_error`] = error.message.substring(0, 1024);
        }
    }

    return data;
}

function transformData (data) {
    const result = {
        packages: []
      };
      
      data.forEach(item => {
        const packageIndex = result.packages.findIndex(pkg => pkg.config_package_id === item.config_package_id);
        
        const artifact = {
          config_component_position: item.config_component_position,
          config_component_id: item.config_component_id,
          config_component_name: item.config_component_name,
          config_component_type: item.config_component_type,
          config_component_dt_version: item.config_component_dt_version,
          primary_tenant_runtime_status: item.primary_tenant_runtime_status,
          primary_tenant_runtime_error: item.primary_tenant_runtime_error,
          primary_tenant_runtime_started_on: item.primary_tenant_runtime_started_on,
          primary_tenant_runtime_completed_on: item.primary_tenant_runtime_completed_on,
          primary_tenant_runtime_status_last_updated_on: item.primary_tenant_runtime_status_last_updated_on,
          secondary_tenant_runtime_status: item.secondary_tenant_runtime_status,
          secondary_tenant_runtime_error: item.secondary_tenant_runtime_error,
          secondary_tenant_runtime_started_on: item.secondary_tenant_runtime_started_on,
          secondary_tenant_runtime_completed_on: item.secondary_tenant_runtime_completed_on,
          secondary_tenant_runtime_status_last_updated_on: item.secondary_tenant_runtime_status_last_updated_on
        };
        
        if (packageIndex === -1) {
          result.packages.push({
            config_package_id: item.config_package_id,
            config_package_name: item.config_package_name,
            created_on: item.created_on,
            created_by: item.created_by,
            artifacts: [artifact]
          });
        } else {
          result.packages[packageIndex].artifacts.push(artifact);
        }
      });

      return result;


}

module.exports = {
    getSourceTenantRuntimeWithTargetTenantDesigntimeArtifacts,
    schedulePlannedFailoverForTenants,
    postFailoverConfig,
    getFailoverStatusForTenants
}