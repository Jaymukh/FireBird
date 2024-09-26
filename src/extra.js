const heartBeatServiceProcedure = async (commonInputData) => {
    let isHeartBeatActivityPerformed = true;

    let activity_type = '';
    try {
        if (commonInputData.activity_type === FAILOVER_ENTRY_TYPE) {
            activity_type = 'Failover';
            console.log('Heartbeat activity for Failover');
            try {
                //check if the heartbeat is present in the secondary 
                const healthProbeUrl = `/api/v1/IntegrationRuntimeArtifacts('ping_healthprobe')`;
                let responseHealthProbe = await commonInputData.axiosInstanceSecondaryTenant.get(healthProbeUrl);
    
                if (responseHealthProbe) {
                    isHeartBeatActivityPerformed = true;
                    console.log('\nFailover: Heart beat is there in secondary tenant\n');
                } 
            } catch(error) {
                if (error.response && error.response.status === 404) {
                    errorMessage = `Artifact id: ping_healthprobe is already undeployed (404 error) or not found.`;
                    console.error(errorMessage);
                } else {
                    console.error(`Error in getting ping_healthprobe.`);
              
                }
                // if error, the health probe to deployed state in secondary
                const deployHealthProbeUrl = `/api/v1/DeployIntegrationDesigntimeArtifact?Id='ping_healthprobe'&Version='1.0.10'`; // remove hardcoding
                let deployHealthProbe = await commonInputData.axiosInstanceSecondaryTenant.post(deployHealthProbeUrl);

                if (deployHealthProbe) {
                    console.log('\nFailover: health probe deployed');
                    isHeartBeatActivityPerformed = true;
                }
            }

            // undeploy from primary tenant
            try {
                const undeployHealthProbeUrl = `/api/v1/IntegrationRuntimeArtifacts('ping_healthprobe')`
                let undeployHealthProbe = await commonInputData.axiosInstancePrimaryTenant.delete(undeployHealthProbeUrl);
    
                if (undeployHealthProbe) {
                    console.log('\nUndeployed artifact: ping_healthprobe from primary tenant');
                }

                isHeartBeatActivityPerformed = true;
            } catch(error) {
                if (error.response && error.response.status === 404) {
                    errorMessage = `Artifact id: ping_healthprobe is already undeployed (404 error) or not found.`;
                    console.error(errorMessage);
                    isHeartBeatActivityPerformed = true;
                } else {
                    console.error(`Error in getting ping_healthprobe.`);
              
                }
            }
       
            return isHeartBeatActivityPerformed;
        }
    
        if (commonInputData.activity_type === SWITCH_BACK_ENTRY_TYPE) {
            activity_type = 'Switchback';
            console.log('\nHeartbeat activity for switchback');
          
                // deploy heartbeat back to the primary site
                const deployHealthProbeUrl = `/api/v1/DeployIntegrationDesigntimeArtifact?Id='ping_healthprobe'&Version='1.0.10'`; 
                let deployHealthProbe = await commonInputData.axiosInstanceSecondaryTenant.post(deployHealthProbeUrl); // deploy to tenant 1

                if (deployHealthProbe) {
                    console.log('\nDeployed heartbeat service to primary site')
                }

                try {
                    // undeploy heartbeat from the secondary site
                    const undeployHealthProbeUrl = `/api/v1/IntegrationRuntimeArtifacts('ping_healthprobe')`
                    let undeployHealthProbe = await commonInputData.axiosInstancePrimaryTenant.delete(undeployHealthProbeUrl); // undeploy from tenant 2

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