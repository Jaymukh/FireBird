const DailyTimeInterval = require("../models/Tenant/dailyTimeInterval");
const TenantPairMap = require("../models/Tenant/tenantPairMap");

async function clonePackagesAndArtifactsForTenantPairMap() {

    try {
        console.log('\n Inside the clonePackagesAndArtifactsForTenantPairMap function...');

        const allTenantPairs = await TenantPairMap.findAll({
            where: {
                is_deleted: false,
                tpm_is_pair_active: true
            }
        });

        if (!allTenantPairs.length) {
            console.log('No Tenant pairs to process');
            throw new Error('No Tenant pairs to process');
        }

        for (let i = 0; i < allTenantPairs.length; i++) {
            let tenantMapPair = allTenantPairs[i];
            console.log('TenantMapPair: ', JSON.stringify(tenantMapPair, null, 2));

        }

        const dailyTimeInterval = await DailyTimeInterval.findOne({
            where: {
                is_deleted: false
            }
        })
        // Define the start and end times for the range -> could be made configurable
        // const startTime = moment('05:00 PM', 'hh:mm A');
        // const endTime = moment('09:00 PM', 'hh:mm A');

        console.log('dailyTimeInterval.dti_start_time: ', dailyTimeInterval.dti_start_time);
        console.log('dailyTimeInterval.dti_end_time: ', dailyTimeInterval.dti_end_time);

        const startTime = moment(dailyTimeInterval.dti_start_time, 'hh:mm A');
        const endTime = moment(dailyTimeInterval.dti_end_time, 'hh:mm A');

        console.log('startTime: ', startTime);
        console.log('endTime: ', endTime);

        // Get the current time
        const currentTime = moment();

        // Check if the current time is within the specified range
        if (currentTime.isBetween(startTime, endTime)) {
            console.log('The package artifact info could be updated now');

        } else {
            console.log('The time is out of given start time and end time, not updating tenant package artifact info');
            // in its scheduler -> create 
        }

    } catch (error) {
        console.log('Error in clonePackagesAndArtifactsForTenantPairMap: ', error);
    }

}

module.exports = {
    clonePackagesAndArtifactsForTenantPairMap
}