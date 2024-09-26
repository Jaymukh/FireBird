const UFMFailoverProcess = require("../models/UFM/ufmFailoverProcess");
const UFMProfile = require("../models/ufmProfile");
const { Op } = require('sequelize');
const  sequelize  = require("../dbconfig/config");
const unzipper = require('unzipper');
const { Writable } = require('stream');
const { FAILOVER_ENTRY_TYPE, 
    SWITCH_BACK_ENTRY_TYPE, 
    FAILOVER_PROCESS_STATUS,
    SWITCH_BACK_PROCESS_STATUS,
    IFLOW_UTIL_IMP
} = require("../constants/taxonomyValues");
const { getBearerTokenForTenants, getBearerTokenForIFlow } = require("../util/auth");
const { axiosInstance } = require("../services/cpiClient");
const UFMFailoverProcessComponent = require("../models/UFM/ufmFailoverProcessComponent");
const Taxonomy = require("../models/taxonomy");


const processFailoverJob = async () => {

    try {

        // insert that SyncModels function

    while(true) {
       
        // const transaction = await sequelize.transaction();
        // check if any of the failover/switchback is in RUNNING: skip the entire block
        const FOSB_running_query = await UFMFailoverProcess.findOne({
            where: {
                entry_type_id: {
                    [Op.or]: [
                        FAILOVER_ENTRY_TYPE,
                        SWITCH_BACK_ENTRY_TYPE
                      ]
                }, 
                is_process_initiated_progress_id: FAILOVER_PROCESS_STATUS.RUNNING,
                is_last_record: true
            },
            order: [
                ['created_on', 'ASC'] // FIFO type
            ],
        })

            if (FOSB_running_query) {
                console.log('\nA task is already running')
                break;
            }


        // check if any of the failover/switchback is in scheduled
        const FOSB_query = await UFMFailoverProcess.findOne({
            where: {
                entry_type_id: {
                    [Op.or]: [
                        FAILOVER_ENTRY_TYPE,
                        SWITCH_BACK_ENTRY_TYPE
                      ]
                }, 
                is_process_initiated_progress_id: FAILOVER_PROCESS_STATUS.SCHEDULED,
                is_last_record: true
            },
            order: [
                ['created_on', 'ASC'] // FIFO type
            ],
            // transaction
        })
        


        if (FOSB_query) {
              // update the scheduled failover/switchback to running
            console.log('\n---> ', FAILOVER_PROCESS_STATUS.RUNNING, 
                FOSB_query.failover_process_id,  
                FOSB_query.is_planned_failover
            )

            const updateFailoverProcessTable = await UFMFailoverProcess.update(
                {
                    is_process_initiated_progress_id: FAILOVER_PROCESS_STATUS.RUNNING
                },
                {
                    where: {
                        failover_process_id: FOSB_query.failover_process_id
                    },
                    // transaction
                }
            );

            // await transaction.commit();

            const commonInputData = await getCommonInformationForActivity(FOSB_query);
  
            switch(FOSB_query.entry_type_id) {

                // thing to consider here will be primary and secondary tenant

                case FAILOVER_ENTRY_TYPE: 
                                        console.log('\nPerforming failover'); 
                                        await performFailoverActivity(commonInputData);
                                        break;

                case SWITCH_BACK_ENTRY_TYPE: 
                                        console.log('\nPerforming switchback'); 
                                        await performSwitchbackActivity(commonInputData);
                                        break;

                default: console.log('\nFailover default');
            }
            
        } else {
            console.log('\nNothing to process for node-cron');
        }

            break; // for ensuring the while true -> breaks 
        } // single run while loop ends here



    } catch(error) {
        // await transaction.rollback();
        console.log('\nError in processFailover job function ', error);
    }

}

const getCommonInformationForActivity = async (FOSB_query) => {
    let commonInputData = {};
    try{
        const ufmProfileResponse = await UFMProfile.findOne( {
            where: {
                ufm_profile_id: FOSB_query.ufm_profile_id
            },
        })
    
        if (!ufmProfileResponse) {
            throw Error(`Ufm profile id: ${FOSB_query.ufm_profile_id} not found`)
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

       const axiosInstanceTenantOneGlobalVariable = axiosInstance({
        url: tenantOneDbResponse.tenant_host_url,
        responseType: 'stream',
        token: tenantOneBearerToken
       })

       const axiosInstanceTenantTwoGlobalVariable = axiosInstance({
        url: tenantTwoDbResponse.tenant_host_url,
        responseType: 'stream',
        token: tenantTwoBearerToken
       })

       const axiosInstanceTenantTwo = axiosInstance({
           url: tenantTwoDbResponse.tenant_host_url,
           token: tenantTwoBearerToken
       });

       const tenantOneUtilBearerToken = await getBearerTokenForIFlow (tenantOneDbResponse);

       const axiosInstanceUtilTenantOne = axiosInstance({
        url: tenantOneDbResponse.tenant_util_host_url,
        token: tenantOneUtilBearerToken
       })

       const tenantTwoUtilBearerToken = await getBearerTokenForIFlow (tenantTwoDbResponse);
       
       const axiosInstanceUtilTenantTwo = axiosInstance({
        url: tenantTwoDbResponse.tenant_util_host_url,
        token: tenantTwoUtilBearerToken
       })
    //    ufm_profile_primary_tenant_id -> is the primary site
    //  ufm_profile_secondary_tenant_id -> is the secondary site
        
        if (FOSB_query.entry_type_id === FAILOVER_ENTRY_TYPE) {
            commonInputData = {
                primaryTenantId: ufmProfileResponse.ufm_profile_primary_tenant_id,
                secondaryTenantId: ufmProfileResponse.ufm_profile_secondary_tenant_id,
                activity_type: FAILOVER_ENTRY_TYPE,
                axiosInstancePrimaryTenant: axiosInstanceTenantOne, // tenant 1 would act as source
                axiosInstancePrimaryTenantGlobalVariable: axiosInstanceTenantOneGlobalVariable,
                axiosInstanceSecondaryTenant: axiosInstanceTenantTwo, // tenant 2 would act as target
                axiosInstanceUtilSecondaryTenant: axiosInstanceUtilTenantTwo,
                failoverProcessId: FOSB_query.failover_process_id,
                isPlannedFailover: FOSB_query.is_planned_failover
            }
        } 
    
        // in switch back, tenantTwo would serve as tenantOne and tenantOne as tenantTwo (reverse of failover)
        
        if (FOSB_query.entry_type_id === SWITCH_BACK_ENTRY_TYPE) {
            commonInputData = {
                primaryTenantId: ufmProfileResponse.ufm_profile_secondary_tenant_id,
                secondaryTenantId: ufmProfileResponse.ufm_profile_primary_tenant_id,
                activity_type: SWITCH_BACK_ENTRY_TYPE,
                axiosInstancePrimaryTenant: axiosInstanceTenantTwo, // tenant 2 would act as source
                axiosInstancePrimaryTenantGlobalVariable: axiosInstanceTenantTwoGlobalVariable,
                axiosInstanceSecondaryTenant: axiosInstanceTenantOne, // tenant 1 would act as target
                axiosInstanceUtilSecondaryTenant: axiosInstanceUtilTenantOne,
                failoverProcessId: FOSB_query.failover_process_id,
                isPlannedFailover: FOSB_query.is_planned_failover
            }
        }
    
        return commonInputData;
    } catch(error) {
        console.log('\nError in getting common information', error);
        return error.message;
    }

  
}


const performFailoverActivity = async (commonInputData) => {
    let isCopiedGlobalVariables = false;
    let isHeartBeatActivityPerformed = false;

    while(true) {
    isHeartBeatActivityPerformed = await heartBeatServiceProcedure(commonInputData);

    if (isHeartBeatActivityPerformed) {
        console.log('\nHeart beat activity performed');
    } else {
        // skip other steps if heartbeat service is not up
        break;
    }

//     let isUndeployed;

//     if (commonInputData.isPlannedFailover) { // if it is false, then we are doing unplanned failover
//         console.log('\nFor Planned failover activity: type-> Failover');
//     // undeploy artifact from primary tenant
//     isUndeployed = await undeployArtifacts(commonInputData);

//     if (isUndeployed) {
//         console.log('\nUndeployed runtime artifacts from primary site');
//     }
//   }

//     let isCopiedGlobalVariables = await copyGlobalVariables(commonInputData);

//     if (isCopiedGlobalVariables) {
//         console.log('\nGlobal variables copied')
//     }

//     const isNumberRangesCopied = await copyNumberRanges(commonInputData);

//     if (isNumberRangesCopied) {
//         console.log('\nNumber Ranges copied');
//     }
    
//     let isDeployed = await deployArtifacts(commonInputData);

//     if (isDeployed) {
//         console.log('\ndeployed artifacts on secondary tenant');
//     }

    break;
   }

      //success conditions
      
    //   let successConditions = isHeartBeatActivityPerformed 
    //   && isCopiedGlobalVariables 
    //   && isNumberRangesCopied 
    //   && isDeployed 
    //   && (commonInputData.isPlannedFailover ? isUndeployed : true); // true value from this line -> for unplanned 
    
      let successConditions = true;

      if (successConditions) {
        console.log('\nFailover completed successfully');
        const updateFailoverProcessTable = await UFMFailoverProcess.update(
            {
                is_process_initiated_progress_id: FAILOVER_PROCESS_STATUS.COMPLETED,
                process_completed_on: Math.floor(Date.now() / 1000)
            },
            {
                where: {
                    failover_process_id: commonInputData.failoverProcessId
                },
                // transaction
            }
        );
    } else {
        const updateFailoverProcessTable = await UFMFailoverProcess.update(
            {
                is_process_initiated_progress_id: FAILOVER_PROCESS_STATUS.FAILED,
                process_completed_on: Math.floor(Date.now() / 1000)
            },
            {
                where: {
                    failover_process_id: commonInputData.failoverProcessId
                },
                // transaction
            }
        );
    }

}

// this function collects all the required info/resources at one places -> to make the code modular

const performSwitchbackActivity = async (commonInputData) => {

//     let isUndeployed;
//     if (commonInputData.isPlannedFailover) { // if it is false, then we are doing unplanned failover
//         console.log('\nFor Planned failover activity: type-> Switchback');

//     isUndeployed = await undeployArtifacts(commonInputData) ;

//     if (isUndeployed) {
//         console.log('\nSWITCH_BACK: Undeployed artifacts from secondary site');
//     }
//   }

//     const isCopiedGlobalVariables = await copyGlobalVariables(commonInputData);

//     if (isCopiedGlobalVariables) {
//         console.log('\nSWITCH_BACK: Global variables copied from secondary to primary site')
//     }

//     const isNumberRangesCopied = await copyNumberRanges(commonInputData);

//     if (isNumberRangesCopied) {
//         console.log('\nSWITCH_BACK: Number Ranges copied');
//     }

//     let isDeployed = await deployArtifacts(commonInputData);

//     if (isDeployed) {
//         console.log('\ndeployed artifacts on secondary tenant');
//     }

    const isHeartBeatActivityPerformed = await heartBeatServiceProcedure(commonInputData);

    if (isHeartBeatActivityPerformed) {
        console.log('\nHeart beat activity performed');
    }

       //success conditions
    //    let  successConditions = isHeartBeatActivityPerformed 
    //    && isCopiedGlobalVariables 
    //    && isNumberRangesCopied 
    //    && isDeployed 
    //    && (commonInputData.isPlannedFailover ? isUndeployed : true); // true value from this line -> for unplanned 
    
    let successConditions = true;
       if (successConditions) {
        console.log('\nSwitchback completed successfully');
        const updateFailoverProcessTable = await UFMFailoverProcess.update(
            {
                is_process_initiated_progress_id: SWITCH_BACK_PROCESS_STATUS.COMPLETED,
                process_completed_on: Math.floor(Date.now() / 1000)
            },
            {
                where: {
                    failover_process_id: commonInputData.failoverProcessId
                },
                // transaction
            }
        );
    } else {
        console.log('\nSwitchback activity failed');
        const updateFailoverProcessTable = await UFMFailoverProcess.update(
            {
                is_process_initiated_progress_id: SWITCH_BACK_PROCESS_STATUS.FAILED,
                process_completed_on: Math.floor(Date.now() / 1000)
            },
            {
                where: {
                    failover_process_id: commonInputData.failoverProcessId
                },
                // transaction
            }
        );
    }

}

// now logic in backend-one
/*
const heartBeatServiceProcedure = async (commonInputData) => {
    let isHeartBeatActivityPerformed = true;
    const utilEntry = await Taxonomy.findOne({
        where: {
            taxonomy_id: IFLOW_UTIL_IMP.PING_HEALTHPROBE
        }
    })

    if (!utilEntry) {
        console.log('\nPing healthprobe is not present in taxonomy')
        isHeartBeatActivityPerformed = false; 
        return isHeartBeatActivityPerformed;
    }

    const createDelay = ms => new Promise(resolve => setTimeout(resolve, ms));
    let activity_type = '';
    try {
        if (commonInputData.activity_type === FAILOVER_ENTRY_TYPE) {
            activity_type = 'Failover';
            console.log('Heartbeat activity for Failover');
            let flag = true;
           
            let trialCount = 0;
               while (flag) {
                try {
                    // try to deploy for secondary site
                    const deployHealthProbeUrl = `/api/v1/DeployIntegrationDesigntimeArtifact?Id='${utilEntry.taxonomy_name}'&Version='${utilEntry.taxonomy_value}'`; // remove hardcoding
                    let deployHealthProbe = await commonInputData.axiosInstanceSecondaryTenant.post(deployHealthProbeUrl);
                    // Introduce a 2000ms delay
                    await createDelay(2000);
                    console.log(
                        'deployHealthProbeUrl:', deployHealthProbeUrl
                    )

                    const healthProbeUrl = `/api/v1/IntegrationRuntimeArtifacts('${utilEntry.taxonomy_name}')`;
                    let responseHealthProbe = await commonInputData.axiosInstanceSecondaryTenant.get(healthProbeUrl);

                    console.log('responseHealthProbe: ', responseHealthProbe);
                    trialCount++;
                    console.log('\nTrial count: ', trialCount)
                    if (responseHealthProbe.status === 200 || responseHealthProbe.status === 202) {
                        console.log('\nget status for ping_healthprobe done')
                        flag = false;
                    }

                    if (trialCount >= 10) {
                        flag = false;
                    }
                    
                } catch(error) {
                    if (error.response && error.response.status === 404) {
                        flag = true;
                        trialCount++;
                        if (trialCount >= 10) {
                            flag = false;
                        }
                }

            }
            // flag = false;
        }
            const undeployHealthProbeUrl = `/api/v1/IntegrationRuntimeArtifacts('${utilEntry.taxonomy_name}')`
            let undeployHealthProbe = await commonInputData.axiosInstancePrimaryTenant.delete(undeployHealthProbeUrl);
            await createDelay(1000);

            if (undeployHealthProbe) {
                console.log('\nUndeployed artifact: ping_healthprobe from primary tenant');
                return true;
            }

            return true;
        }
    
        if (commonInputData.activity_type === SWITCH_BACK_ENTRY_TYPE) {
            activity_type = 'Switchback';
            console.log('\nHeartbeat activity for switchback');
          
                // deploy heartbeat back to the primary site
                const deployHealthProbeUrl = `/api/v1/DeployIntegrationDesigntimeArtifact?Id='${utilEntry.taxonomy_name}'&Version='${utilEntry.taxonomy_value}'`; 
                let deployHealthProbe = await commonInputData.axiosInstanceSecondaryTenant.post(deployHealthProbeUrl); // deploy to tenant 1

                await createDelay(2000);

                if (deployHealthProbe) {
                    console.log('\nDeployed heartbeat service to primary site')
                }

                try {
                    // undeploy heartbeat from the secondary site
                    const undeployHealthProbeUrl = `/api/v1/IntegrationRuntimeArtifacts('${utilEntry.taxonomy_name}')`
                    let undeployHealthProbe = await commonInputData.axiosInstancePrimaryTenant.delete(undeployHealthProbeUrl); // undeploy from tenant 2

                    await createDelay(1000);

                    if (undeployHealthProbe) {
                        console.log('\nUndeployed heartbeat service from secondary');
                    }
                } catch(error) {
                    if (error.response && error.response.status === 404) {
                        errorMessage = `Artifact id: ping_healthprobe is already undeployed (404 error) or not found.`;
                        console.error(errorMessage);
                        isHeartBeatActivityPerformed = true;
                    } else {
                        console.error(`Error in getting ping_healthprobe.`);
                        isHeartBeatActivityPerformed = true;
                    }
                }

                isHeartBeatActivityPerformed = true;
        }
    } catch(error) {
        isHeartBeatActivityPerformed = false;
        console.log(`\nError in heart beat service procedure for ${activity_type}: `, error);
        return isHeartBeatActivityPerformed;
    }

    return isHeartBeatActivityPerformed;

}
*/


const heartBeatServiceProcedure = async (commonInputData) => {


const createDelay = ms => new Promise(resolve => setTimeout(resolve, ms));
let activity_type = '';

try {
    let isHeartBeatActivityPerformed = true;
    const utilEntry = await Taxonomy.findOne({
        where: {
            taxonomy_id: IFLOW_UTIL_IMP.PING_HEALTHPROBE
        }
    })

    if (!utilEntry) {
        console.log('\nPing healthprobe is not present in taxonomy')
        isHeartBeatActivityPerformed = false; 
        return isHeartBeatActivityPerformed;
    }


    if (commonInputData.activity_type === FAILOVER_ENTRY_TYPE) {
        activity_type = 'Failover';
        console.log('Heartbeat activity for Failover');
        
        let isDeployedFlag = false;  

        // trying three times for deployment
        for (let i = 0 ; i < 3; i++) {
            console.log('For I: ', i)
            isDeployedFlag = false;
            try {
            const deployHealthProbeUrl = `/api/v1/DeployIntegrationDesigntimeArtifact?Id='${utilEntry.taxonomy_name}'&Version='${utilEntry.taxonomy_value}'`;

            let deployHealthProbe = await commonInputData.axiosInstanceSecondaryTenant.post(deployHealthProbeUrl);

            // Introduce a 2000ms delay
            await createDelay(2000);

            if ( deployHealthProbe ) {
                console.log(`${utilEntry.taxonomy_name} is deployed on the secondary site.`)
            }

            } catch (error) {
                console.log('\nError in deploying healthprobe: ', error.message);
                isDeployedFlag = false;
            }

            // check whether the healthprobe is actually deployed
            try {
                const healthProbeUrl = `/api/v1/IntegrationRuntimeArtifacts('${utilEntry.taxonomy_name}')`;
                let responseHealthProbe = await commonInputData.axiosInstanceSecondaryTenant.get(healthProbeUrl);

                await createDelay(2000);

                if (responseHealthProbe.status === 200 || responseHealthProbe.status === 202) {
                    console.log('\nresponseHealthProbe: ', responseHealthProbe.status);
                    console.log('\nget status for ping_healthprobe done');
                    isDeployedFlag = true;
                    break;
                }
            } catch(error) {
                console.log('\nError in getting healthprobe status: ', error.message);
                isDeployedFlag = false;
            }

        }

        if (!isDeployedFlag) {
            return false;
        }

        let isUndeployedFlag = false;
        
        for (let i = 0 ; i < 3; i++) {
            console.log('For I::: ', i)

            try {
                const undeployHealthProbeUrl = `/api/v1/IntegrationRuntimeArtifacts('${utilEntry.taxonomy_name}')`;

                let undeployHealthProbe = await commonInputData.axiosInstancePrimaryTenant.delete(undeployHealthProbeUrl);
        
                await createDelay(2000);
        
                if (undeployHealthProbe) {
                    console.log(`\nUndeployed artifact: ${utilEntry.taxonomy_name} from primary tenant`);
                    isUndeployedFlag = true;
                    break;
                }

            } catch(error) {
                console.log(`\nError in undeploying artifact ${utilEntry.taxonomy_name} from primary tenant`);
                isUndeployedFlag = false;
            }

        }

        if (!isUndeployedFlag) {
            return false;
        }
 
        if (isDeployedFlag && isUndeployedFlag) {
            console.log("TRUE.....")
            return true;
        } else {
            console.log("FALSE.....")
            return false; // failover heartbeat activity unsuccessful
        }
    }

    if (commonInputData.activity_type === SWITCH_BACK_ENTRY_TYPE) {
        activity_type = 'Switchback';
        console.log('\nHeartbeat activity for switchback');

        try {
        // deploy heartbeat back to the primary site
        const deployHealthProbeUrl = `/api/v1/DeployIntegrationDesigntimeArtifact?Id='${utilEntry.taxonomy_name}'&Version='${utilEntry.taxonomy_value}'`; 
        let deployHealthProbe = await commonInputData.axiosInstanceSecondaryTenant.post(deployHealthProbeUrl); // deploy to tenant 1

        await createDelay(2000);
        } catch(error) {
            console.log('\n')
        }


    return true;
    }

} catch (error) {
    console.log('Error in service function: ', error.message);
    isHeartBeatActivityPerformed = false;
}

return isHeartBeatActivityPerformed;

}

/*
const heartBeatServiceProcedure = async (commonInputData) => {
    let isHeartBeatActivityPerformed = true;
    const utilEntry = await Taxonomy.findOne({
        where: {
            taxonomy_id: IFLOW_UTIL_IMP.PING_HEALTHPROBE
        }
    })

    if (!utilEntry) {
        console.log('\nPing healthprobe is not present in taxonomy')
        isHeartBeatActivityPerformed = false; 
        return isHeartBeatActivityPerformed;
    }

    const createDelay = ms => new Promise(resolve => setTimeout(resolve, ms));
    let activity_type = '';
    try {
        if (commonInputData.activity_type === FAILOVER_ENTRY_TYPE) {
            activity_type = 'Failover';
            console.log('Heartbeat activity for Failover');
            let flag = true;
           
            
               while (flag) {
                try {
                    // try to deploy for secondary site
                    const deployHealthProbeUrl = `/api/v1/DeployIntegrationDesigntimeArtifact?Id='${utilEntry.taxonomy_name}'&Version='${utilEntry.taxonomy_value}'`; // remove hardcoding
                    let deployHealthProbe = await commonInputData.axiosInstanceSecondaryTenant.post(deployHealthProbeUrl);
                    // Introduce a 2000ms delay
                    await createDelay(2000);

                    const healthProbeUrl = `/api/v1/IntegrationRuntimeArtifacts('${utilEntry.taxonomy_name}')`;
                    let responseHealthProbe = await commonInputData.axiosInstanceSecondaryTenant.get(healthProbeUrl);

                    if (responseHealthProbe.status === 200 || responseHealthProbe.status === 202) {
                        console.log('\nget status for ping_healthprobe done')
                        flag = false;
                    }

                } catch(error) {
                    if (error.response && error.response.status === 404) {
                        flag = true;
                }

            }
            // flag = false;
        }
            const undeployHealthProbeUrl = `/api/v1/IntegrationRuntimeArtifacts('ping_healthprobe')`
            let undeployHealthProbe = await commonInputData.axiosInstancePrimaryTenant.delete(undeployHealthProbeUrl);
            await createDelay(1000);

            if (undeployHealthProbe) {
                console.log('\nUndeployed artifact: ping_healthprobe from primary tenant');
                return true;
            }

            return true;
        }
    
        if (commonInputData.activity_type === SWITCH_BACK_ENTRY_TYPE) {
            activity_type = 'Switchback';
            console.log('\nHeartbeat activity for switchback');
          
                // deploy heartbeat back to the primary site
                const deployHealthProbeUrl = `/api/v1/DeployIntegrationDesigntimeArtifact?Id='ping_healthprobe'&Version='1.0.10'`; 
                let deployHealthProbe = await commonInputData.axiosInstanceSecondaryTenant.post(deployHealthProbeUrl); // deploy to tenant 1

                await createDelay(2000);

                if (deployHealthProbe) {
                    console.log('\nDeployed heartbeat service to primary site')
                }

                try {
                    // undeploy heartbeat from the secondary site
                    const undeployHealthProbeUrl = `/api/v1/IntegrationRuntimeArtifacts('ping_healthprobe')`
                    let undeployHealthProbe = await commonInputData.axiosInstancePrimaryTenant.delete(undeployHealthProbeUrl); // undeploy from tenant 2

                    await createDelay(1000);

                    if (undeployHealthProbe) {
                        console.log('\nUndeployed heartbeat service from secondary');
                    }
                } catch(error) {
                    if (error.response && error.response.status === 404) {
                        errorMessage = `Artifact id: ping_healthprobe is already undeployed (404 error) or not found.`;
                        console.error(errorMessage);
                        isHeartBeatActivityPerformed = true;
                    } else {
                        console.error(`Error in getting ping_healthprobe.`);
                        isHeartBeatActivityPerformed = true;
                    }
                }

                isHeartBeatActivityPerformed = true;
        }
    } catch(error) {
        isHeartBeatActivityPerformed = false;
        console.log(`\nError in heart beat service procedure for ${activity_type}: `, error);
        return isHeartBeatActivityPerformed;
    }

    return isHeartBeatActivityPerformed;

}
*/

function compareNumberRanges(source, target) {
    // Create a Set of names in the target array for quick lookup
    const targetNames = new Set(target.map(item => item.Name));

    // Iterate over the source array and add the doesExistOnTarget key
    const result = source.map(item => {
        return {
            ...item,
            doesExistOnTarget: targetNames.has(item.Name)
        };
    });

    return result;
}

const copyNumberRanges = async (commonInputData) => {

    // if (commonInputData.activity_type === FAILOVER_ENTRY_TYPE) {
        try{
            let [numberRangesTenantOneResponse, numberRangesTenantTwoResponse ] = await Promise.all([
                await commonInputData.axiosInstancePrimaryTenant.get("/api/v1/NumberRanges"),
                await commonInputData.axiosInstanceSecondaryTenant.get("/api/v1/NumberRanges")
            ])
    
            numberRangesPrimaryTenant = numberRangesTenantOneResponse.data.d.results;
            numberRangesSecondaryTenant = numberRangesTenantTwoResponse.data.d.results;
    
            // compare the number ranges array gotten above
            resultArray = compareNumberRanges(numberRangesPrimaryTenant, numberRangesSecondaryTenant)
    
            //  do post or put call based on the existence of doesExistOnTarget flag 
            const createOrUpdateNumberRanges = async (numberRangeObj) => {
    
                const targetUrl = numberRangeObj.doesExistOnTarget 
                    ? `/api/v1/NumberRanges('${numberRangeObj.Name}')` // this is for put
                    : '/api/v1/NumberRanges'; // this for post

                const requestMethod = numberRangeObj.doesExistOnTarget ? 'put' : 'post';
                
                let response;
                if ( numberRangeObj.doesExistOnTarget) {
                    response = await commonInputData.axiosInstanceSecondaryTenant.put(encodeURI(targetUrl), {
                        "Name": numberRangeObj.Name,
                        "Description": numberRangeObj.Description,
                        "MaxValue": numberRangeObj.MaxValue,
                        "MinValue": numberRangeObj.MinValue,
                        "Rotate": numberRangeObj.Rotate,
                        "CurrentValue": numberRangeObj.CurrentValue,
                        "FieldLength": numberRangeObj.FieldLength
                    })
                } else {
                    // deleting these keys/attributes because they are not required in post payload
                    delete numberRangeObj.doesExistOnTarget;
                    delete numberRangeObj.DeployedBy; 
                    delete numberRangeObj.DeployedOn;
        
                    response = await commonInputData.axiosInstanceSecondaryTenant.post(targetUrl, {
                        ...numberRangeObj
                     })
                }
    
                console.log(`${requestMethod} operation done for number range: ${numberRangeObj.Name}`);
            };
    
            const promises = resultArray.map(createOrUpdateNumberRanges);
            await Promise.all(promises);
    
    
            return true;
        } catch(error) {
            console.log('\nError during copying Number Ranges', error);
            return false;
        }
        

}

const copyGlobalVariables = async (commonInputData) => {
    // if (commonInputData.activity_type === FAILOVER_ENTRY_TYPE) {

        let variablesTenantOneResponse = await commonInputData.axiosInstancePrimaryTenant.get("/api/v1/Variables");
        let variablesTenantOne = variablesTenantOneResponse.data.d.results;

        // Global variables to be copied only, as of now
        variablesTenantOne = variablesTenantOne.filter( item => item.Visibility === 'Global')

        const copiedVariables = [];
        const notCopiedVariables = [];

        async function copyVariables(variableObj) {
            try {
              const url = `/api/v1/Variables(VariableName='${variableObj.VariableName}',IntegrationFlow='${variableObj.IntegrationFlow}')/$value`;
          
              const response = await commonInputData.axiosInstancePrimaryTenantGlobalVariable.get(url);
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
    
              // prepare data for post call using util to Tenant two
              const inputData = {
                data: [
                  {
                    VariableName: variableObj.VariableName,
                    VariableValue: variableValue
                  }
                ]
              };
          
              // make a post call to our util endpoint on tenant two to post the variable
              const setVariable = await commonInputData.axiosInstanceUtilSecondaryTenant.post('http/Util/SetVariable', inputData);
          
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

          const promises = variablesTenantOne.map(copyVariables);
          await Promise.all(promises);
          return true;
    // }


    // if (commonInputData.activity_type === SWITCH_BACK_ENTRY_TYPE) {

    //     return true;
    // }

    return true;
}

const undeployArtifacts = async (commonInputData) => {

// create a batch for undeployment of runtime artifacts
if (commonInputData.activity_type === FAILOVER_ENTRY_TYPE) {
    const failoverProcessComponent = await UFMFailoverProcessComponent.findAll({
        where:{
            failover_process_id: commonInputData.failoverProcessId
        },
        order: [['failover_process_component_id', 'DESC']],
    })

    if (!failoverProcessComponent) {
        console.log('\nFailover process component data not found for failover process id:', commonInputData.failover_process_id)
    }

    // update the fields for timestamps
    await UFMFailoverProcessComponent.update(
        {
            primary_tenant_runtime_started_on: null,
            primary_tenant_runtime_completed_on: null,
            primary_tenant_runtime_error: null

        },
        {
            where: {
                failover_process_id: commonInputData.failoverProcessId
            }
        }
    );

    let counterArtifacts = 0;
    const promisesForUndeploying = failoverProcessComponent.map(async (component) => {
        try {
            // In case an artifact is already undeployed, undeploying it would result in 404

            await UFMFailoverProcessComponent.update(
                {
                    primary_tenant_runtime_started_on:  Math.floor(Date.now() / 1000)
                },
                {
                    where: {
                        failover_process_component_id: component.failover_process_component_id
                    }
                }
            );

            counterArtifacts++;

            let undeployArtifactsUrl = `/api/v1/IntegrationRuntimeArtifacts('${component.config_component_id}')`;
            let undeployedArtifact = await commonInputData.axiosInstancePrimaryTenant.delete(undeployArtifactsUrl);

            if (undeployedArtifact) {
                console.log(`Artifact undeployed is: `, component.config_component_id);
                
                await UFMFailoverProcessComponent.update(
                    {
                        primary_tenant_runtime_completed_on:  Math.floor(Date.now() / 1000),
                        primary_tenant_runtime_status: "UNDEPLOYED"
                    },
                    {
                        where: {
                            failover_process_component_id: component.failover_process_component_id
                        }
                    }
                );
            }

        } catch (error) {
            let errorMessage = '';

            if (error.response && error.response.status === 404) {
                errorMessage = `Artifact id: ${component.config_component_id} is already undeployed (404 error) or not found.`;
                console.error(errorMessage);
            } else {
                console.error(`Error undeploying artifact with id ${component.config_component_id}:`);
                let errorString = JSON.stringify(error);
                errorMessage = errorString.substring(0, 1024);
            }

            await UFMFailoverProcessComponent.update(
                {
                    primary_tenant_runtime_error: errorMessage,
                    primary_tenant_runtime_status: "ALREADY_UNDEPLOYED"
                },
                {
                    where: {
                        failover_process_component_id: component.failover_process_component_id
                    }
                }
            );
        }
    });

    // since there is no particular order of undeployment, we are using promise.all 
    await Promise.all(promisesForUndeploying);
    console.log('\nCounter artifacts: ', counterArtifacts)
    return true;

    
} // if part for failover ends here

if (commonInputData.activity_type === SWITCH_BACK_ENTRY_TYPE) {

 const failoverProcessComponent = await UFMFailoverProcessComponent.findAll({
        where:{
            failover_process_id: commonInputData.failoverProcessId
        },
        order: [['failover_process_component_id', 'DESC']],
        // limit: 30
    })

    if (!failoverProcessComponent) {
        console.log('\nFailover process component data not found for failover process id:', commonInputData.failover_process_id)
    }

    // update the fields for timestamps
    await UFMFailoverProcessComponent.update(
        {
            secondary_tenant_runtime_started_on: null,
            secondary_tenant_runtime_completed_on: null,
            secondary_tenant_runtime_error: null

        },
        {
            where: {
                failover_process_id: commonInputData.failoverProcessId
            }
        }
    );

    let counterArtifacts = 0;
    const promisesForUndeploying = failoverProcessComponent.map(async (component) => {
        try {
            // In case an artifact is already undeployed, undeploying it would result in 404

            await UFMFailoverProcessComponent.update(
                {
                    secondary_tenant_runtime_started_on:  Math.floor(Date.now() / 1000)
                },
                {
                    where: {
                        failover_process_component_id: component.failover_process_component_id
                    }
                }
            );

            counterArtifacts++;

            let undeployArtifactsUrl = `/api/v1/IntegrationRuntimeArtifacts('${component.config_component_id}')`;
            let undeployedArtifact = await commonInputData.axiosInstancePrimaryTenant.delete(undeployArtifactsUrl);

            if (undeployedArtifact) {
                console.log(`Artifact undeployed is: `, component.config_component_id);
                
                await UFMFailoverProcessComponent.update(
                    {
                        secondary_tenant_runtime_completed_on:  Math.floor(Date.now() / 1000),
                        secondary_tenant_runtime_status: "UNDEPLOYED"
                    },
                    {
                        where: {
                            failover_process_component_id: component.failover_process_component_id
                        }
                    }
                );
            }

        } catch (error) {
            let errorMessage = '';

            if (error.response && error.response.status === 404) {
                errorMessage = `Artifact id: ${component.config_component_id} is already undeployed (404 error) or not found.`;
                console.error(errorMessage);
            } else {
                console.error(`Error undeploying artifact with id ${component.config_component_id}:`);
                let errorString = JSON.stringify(error);
                errorMessage = errorString.substring(0, 1024);
            }

            await UFMFailoverProcessComponent.update(
                {
                    secondary_tenant_runtime_error: errorMessage,
                    secondary_tenant_runtime_status: "ALREADY_UNDEPLOYED"
                },
                {
                    where: {
                        failover_process_component_id: component.failover_process_component_id
                    }
                }
            );
        }
    });

    // since there is no particular order of undeployment, we are using promise.all 
    await Promise.all(promisesForUndeploying);
    console.log('\nCounter artifacts: ', counterArtifacts)
    return true;
}

return true;
}


const deployArtifacts = async (commonInputData) => {
    // deployment of artifacts is done in the manner -> one by one by priority

    if (commonInputData.activity_type === FAILOVER_ENTRY_TYPE) {
        try {

            const failoverProcessComponent = await UFMFailoverProcessComponent.findAll({
                where:{
                    failover_process_id: commonInputData.failoverProcessId
                },
                order: [['config_component_position', 'ASC']],
            });

            if (!failoverProcessComponent) {
                console.log('\nFailover process component data not found for failover process id:', commonInputData.failover_process_id)
                // throw Error(`Failover process component data not found for failover process id: ${commonInputData.failover_process_id}`)
            }

              // update the fields for timestamps
        await UFMFailoverProcessComponent.update(
            {
                secondary_tenant_runtime_started_on: null,
                secondary_tenant_runtime_completed_on: null,
                secondary_tenant_runtime_error: null

            },
            {
                where: {
                    failover_process_id: commonInputData.failoverProcessId
                }
            }
        );

        // for loop -> in order to hit APIs one by one 
        for (let i = 0; i < failoverProcessComponent.length; i++) {
            try {
                await UFMFailoverProcessComponent.update(
                    {
                        secondary_tenant_runtime_started_on: Math.floor(Date.now() / 1000)
                    },
                    {
                        where: {
                            failover_process_component_id: failoverProcessComponent[i].failover_process_component_id
                        }
                    }
                );
        
                let deployArtifactsUrl = `/api/v1/DeployIntegrationDesigntimeArtifact?Id='${failoverProcessComponent[i].config_component_id}'&Version='${failoverProcessComponent[i].config_component_dt_version}'`;
                
                let deployedArtifact = await commonInputData.axiosInstanceSecondaryTenant.post(deployArtifactsUrl);
        
                if (deployedArtifact) {
                    console.log(`Artifact deployed is: `, failoverProcessComponent[i].config_component_id);
                    
                    await UFMFailoverProcessComponent.update(
                        {
                            secondary_tenant_runtime_completed_on: Math.floor(Date.now() / 1000),
                            secondary_tenant_runtime_status: "DEPLOYED"
                        },
                        {
                            where: {
                                failover_process_component_id: failoverProcessComponent[i].failover_process_component_id
                            }
                        }
                    );
                }
            } catch (error) {
                let errorMessage = '';
        
                if (error.response && error.response.status === 404) {
                    errorMessage = `Artifact id: ${failoverProcessComponent[i].config_component_id} is not found.`;
                    console.error(errorMessage);
                } else {
                    console.error(`Error deploying artifact with id ${failoverProcessComponent[i].config_component_id}:`);
        
                    let errorString = JSON.stringify(error);
                    errorMessage = errorString.substring(0, 1024);
                }
        
                await UFMFailoverProcessComponent.update(
                    {
                        secondary_tenant_runtime_error: errorMessage,
                        secondary_tenant_runtime_status: "DEPLOYMENT_ERROR"
                    },
                    {
                        where: {
                            failover_process_component_id: failoverProcessComponent[i].failover_process_component_id
                        }
                    }
                );
            }
        } // for loop ends here
        


        } catch(error) {
            console.log('\nError in deploying artifacts on secondary : ', error.message)
        }

        return true;
    } // if ends here - for failover 

    if (commonInputData.activity_type === SWITCH_BACK_ENTRY_TYPE) {
        try {

            const failoverProcessComponent = await UFMFailoverProcessComponent.findAll({
                where:{
                    failover_process_id: commonInputData.failoverProcessId
                },
                order: [['config_component_position', 'ASC']],
            });

            if (!failoverProcessComponent) {
                console.log('\nFailover process component data not found for failover process id:', commonInputData.failover_process_id)
                // throw Error(`Failover process component data not found for failover process id: ${commonInputData.failover_process_id}`)
            }

              // update the fields for timestamps
        await UFMFailoverProcessComponent.update(
            {
                primary_tenant_runtime_started_on: null,
                primary_tenant_runtime_completed_on: null,
                primary_tenant_runtime_error: null

            },
            {
                where: {
                    failover_process_id: commonInputData.failoverProcessId
                }
            }
        );

        // for loop -> in order to hit APIs one by one 
        for (let i = 0; i < failoverProcessComponent.length; i++) {
            try {
                await UFMFailoverProcessComponent.update(
                    {
                        primary_tenant_runtime_started_on: Math.floor(Date.now() / 1000)
                    },
                    {
                        where: {
                            failover_process_component_id: failoverProcessComponent[i].failover_process_component_id
                        }
                    }
                );
        
                let deployArtifactsUrl = `/api/v1/DeployIntegrationDesigntimeArtifact?Id='${failoverProcessComponent[i].config_component_id}'&Version='${failoverProcessComponent[i].config_component_dt_version}'`;
                
                let deployedArtifact = await commonInputData.axiosInstanceSecondaryTenant.post(deployArtifactsUrl);
        
                if (deployedArtifact) {
                    console.log(`Artifact deployed is: `, failoverProcessComponent[i].config_component_id);
                    
                    await UFMFailoverProcessComponent.update(
                        {
                            primary_tenant_runtime_completed_on: Math.floor(Date.now() / 1000),
                            primary_tenant_runtime_status: "DEPLOYED"
                        },
                        {
                            where: {
                                failover_process_component_id: failoverProcessComponent[i].failover_process_component_id
                            }
                        }
                    );
                }
            } catch (error) {
                let errorMessage = '';
        
                if (error.response && error.response.status === 404) {
                    errorMessage = `Artifact id: ${failoverProcessComponent[i].config_component_id} is not found.`;
                    console.error(errorMessage);
                } else if (error.response && error.response.status === 500) {

                    errorMessage = error.response?.data?.error?.message?.value;
                    console.log(`\nDeployment function: error 500, artifact id: ${failoverProcessComponent[i].config_component_id}`, errorMessage);

                } else {
                    console.error(`Error deploying artifact with id ${failoverProcessComponent[i].config_component_id}:`);
        
                    let errorString = JSON.stringify(error);
                    errorMessage = errorString.substring(0, 1024);
                }
        
                await UFMFailoverProcessComponent.update(
                    {
                        primary_tenant_runtime_error: errorMessage,
                        primary_tenant_runtime_status: "DEPLOYMENT_ERROR"
                    },
                    {
                        where: {
                            failover_process_component_id: failoverProcessComponent[i].failover_process_component_id
                        }
                    }
                );
            }
        } // for loop ends here
        


        } catch(error) {
            console.log('\nError in deploying artifacts on secondary : ', error.message)
        }

        return true;
    }

    return true;
}


module.exports =  {
    processFailoverJob
}