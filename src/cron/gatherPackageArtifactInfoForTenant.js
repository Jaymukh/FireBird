const Tenant = require("../models/tenant");
const TenantPackageArtifactInfo = require("../models/Tenant/tenantPacakgeArtifactInfo");
const { PROCESS_STATUS } = require("../constants/taxonomyValues");
const moment = require('moment');
const { getOAuth, getOAuthForIFlow, getBearerToken } = require("../util/auth");
const { decryptData, getEncryptionIV } = require("../util/decode");
const { axiosInstance } = require("../services/cpiClient");
const TenantPackage = require("../models/Tenant/tenantPackage");
const TenantArtifact = require("../models/Tenant/tenantArtifact");
const { Op } = require('sequelize');
const DailyTimeInterval = require("../models/Tenant/dailyTimeInterval");


// SCHEDULED: 18001,
// RUNNING: 18002,
// COMPLETED: 18003,
// FAILED: 18004,
// RETRYING: 18005

const getPackageAndArtifactInformationForTenant = async () => {
    console.log('\nGetting package and artifact information for all tenants');
    try {
        // get all tenant records which are not deleted (soft deleted)
        const allTenants = await Tenant.findAll({
            where: {
                is_deleted: false
            }
        })

        // if a tenant is deleted -> mark in TenantPackageArtifactInfo -> true for is_deleted

        if (!allTenants) {
            throw new Error('some Error in getting records for table tenant');
        }

        if (!allTenants.length) {
            throw Error('No Tenants records to process. Create a tenant first');
        } else {
            console.log('Data in tenant table');
        }

        const allTenantsInSchedulerTable = await TenantPackageArtifactInfo.findAll({
            where: {
                is_deleted: false,
                // tpa_is_tenant_connection_ok: true
            },
            logging: (sql) => {
                console.log('Executing SQL query:', sql);
            }
        });


        // if no record found in scheduler table -> insert all tenant records and put them in scheduling
        if (!allTenantsInSchedulerTable.length) {
            console.log('Reaching here');
            let schedulerBulkData = [];

            allTenants.forEach(tenantItem => {
                data = {};

                // row data for TenantPackageArtifactInfo
                data.tpa_tenant_id = tenantItem.tenant_id
                data.tpa_last_sync_on = null;
                data.tpa_progress_status_id = PROCESS_STATUS.SCHEDULED; // put the tenant line item in schedule
                data.tpa_error = null;
                data.is_deleted = false;
                data.created_by = null;
                data.modified_by = null;
                data.created_on = Math.floor(Date.now() / 1000);
                data.modified_on = Math.floor(Date.now() / 1000);

                schedulerBulkData.push(data);
            })

            let bulkCreated = await TenantPackageArtifactInfo.bulkCreate(schedulerBulkData);
            console.log('Bulk created items: ', bulkCreated.length)
        }

        const dailyTimeInterval = await DailyTimeInterval.findOne({
            where: {}
        })
        // Define the start and end times for the range -> could be made configurable
        // const startTime = moment('05:00 PM', 'hh:mm A');
        // const endTime = moment('09:00 PM', 'hh:mm A');

        console.log('dailyTimeInterval.dti_start_time: ', dailyTimeInterval.dti_start_time);
        console.log('dailyTimeInterval.dti_end_time: ', dailyTimeInterval.dti_end_time);

        const startTime = moment(dailyTimeInterval.dti_start_time, 'hh:mm A');
        const endTime = moment(dailyTimeInterval.dti_end_time, 'hh:mm A');


        console.log('startTIme: ', startTime);
        console.log('endTime: ', endTime);

        // Get the current time
        const currentTime = moment();

        // Check if the current time is within the specified range
        if (currentTime.isBetween(startTime, endTime)) {
            console.log('The package artifact info could be updated now');

            // get all data from scheduler table to update all the tenant connection
            // const getAllScheduler = await TenantPackageArtifactInfo.findAll({
            //     where: {
            //         is_deleted: false
            //     }
            // });

            // if (getAllScheduler.length) {
            //     const promises = getAllScheduler.map( item => checkValidTenant(item))
            //     await Promise.all(promises)
            // }

            await processTenantForPackageArtifactsInfoDaily();
        } else {
            console.log('The time is out of given start time and end time, not updating tenant package artifact info');
            await processTenantForPackageArtifactAtCall();
        }


    } catch (error) {
        console.error('Error in tenant package artifact scheduler: ', error)
        console.error('\nError in fn: getPackageAndArtifactInformationForTenant: ', error.message);
    }

}


const processTenantForPackageArtifactsInfoDaily = async () => {
    try {
        while (true) {
            console.log('processTenantForPackageArtifactsInfoDaily');
            // query first whether it is running or not
            // const getIfAnyRunning = await TenantPackageArtifactInfo.findAll({
            //     where: {
            //         is_deleted: false,
            //         tpa_progress_status_id: PROCESS_STATUS.RUNNING,
            //         tpa_is_tenant_connection_ok: true
            //     },
            //     logging:  (sql) => {
            //         console.log(`Executing SQL query for ${TenantPackageArtifactInfo.tableName}`, sql);
            //     }
            // })

            // if (getIfAnyRunning.length > 0) {
            //     console.log('Already running ... will process them in next run if possible');
            //     break;
            // }

            // for now blindly update
            const updateAll = await TenantPackageArtifactInfo.update({
                tpa_progress_status_id: PROCESS_STATUS.SCHEDULED
            }, {
                where: {
                    is_deleted: false,
                    tpa_is_tenant_connection_ok: true,
                    tpa_progress_status_id: {
                        [Op.or]: [
                            PROCESS_STATUS.COMPLETED,
                            PROCESS_STATUS.FAILED
                        ]
                    },
                },
                logging: (sql) => {
                    console.log(`Executing SQL query for ${TenantPackageArtifactInfo.tableName}`, sql);
                }
            })

            console.log(`updated rows in table : ${TenantPackageArtifactInfo.tableName}`, updateAll);

            const getAllScheduled = await TenantPackageArtifactInfo.findAll({
                where: {
                    is_deleted: false,
                    tpa_progress_status_id: PROCESS_STATUS.SCHEDULED,
                    tpa_is_tenant_connection_ok: true
                },
                order: [['tpa_id', 'ASC']],
                logging: (sql) => {
                    console.log(`Fn: processTenantForPackageArtifactsInfoDaily, query ${TenantPackageArtifactInfo.tableName}:`, sql);
                }
            });

            if (getAllScheduled.length > 0) {

                for (let i = 0; i < getAllScheduled.length; i++) {

                    const updateTenantRowItem = await TenantPackageArtifactInfo.update({
                        tpa_progress_status_id: PROCESS_STATUS.RUNNING
                    }, {
                        where: {
                            tpa_id: getAllScheduled[i].tpa_id,
                            tpa_tenant_id: getAllScheduled[i].tpa_tenant_id,
                            is_deleted: false,
                            tpa_is_tenant_connection_ok: true
                        },
                        logging: (sql) => {
                            console.log(`Executing SQL query for ${TenantPackageArtifactInfo.tableName}:`, sql);
                        }
                    })

                    console.log('Tenant Id: ', getAllScheduled[i].tpa_tenant_id);
                    await populatePackageArtifact(getAllScheduled[i]);
                }


                break;
            } else {
                console.log('Nothing to process. exiting...');
                break;
            }



            break;
        }

        // pick up those -> this is common
    } catch (error) {
        console.log('Error in processTenantForPackageArtifactsInfoDaily: ', error);
        console.log('Error message in processTenantForPackageArtifactsInfoDaily: ', error.message);
    }
}

const processTenantForPackageArtifactAtCall = async () => {
    try {
        console.log('processTenantForPackageArtifactAtCall');

        const getAllScheduled = await TenantPackageArtifactInfo.findAll({
            where: {
                is_deleted: false,
                tpa_progress_status_id: PROCESS_STATUS.SCHEDULED,
                tpa_is_tenant_connection_ok: true
            },
            order: [['tpa_id', 'ASC']],
            logging: (sql) => {
                console.log(`Fn: processTenantForPackageArtifactAtCall, query ${TenantPackageArtifactInfo.tableName}:`, sql);
            }
        });

        if (getAllScheduled.length > 0) {

            for (let i = 0; i < getAllScheduled.length; i++) {

                const updateTenantRowItem = await TenantPackageArtifactInfo.update({
                    tpa_progress_status_id: PROCESS_STATUS.RUNNING
                }, {
                    where: {
                        tpa_id: getAllScheduled[i].tpa_id,
                        tpa_tenant_id: getAllScheduled[i].tpa_tenant_id,
                        is_deleted: false,
                        tpa_is_tenant_connection_ok: true
                    },
                    logging: (sql) => {
                        console.log(`Executing SQL query for ${TenantPackageArtifactInfo.tableName}:`, sql);
                    }
                })

                console.log('Tenant Id: ', getAllScheduled[i].tpa_tenant_id);
                await populatePackageArtifact(getAllScheduled[i]);
            }


        } else {
            console.log('Nothing to process. exiting...');
        }



        // pick up those -> this is common
    } catch (error) {

    }


}


const populatePackageArtifact = async (tenantRowFromScheduler) => {

    console.log('populate packahe artifact');
    try {
        // collect tenantData -> in order to hit SAP APIs
        const tenantRecord = await Tenant.findOne({
            where: {
                tenant_id: tenantRowFromScheduler.tpa_tenant_id,
                is_deleted: false
            },
            logging: (sql) => {
                console.log(`Executing SQL query for ${TenantPackageArtifactInfo.tableName}:`, sql);
            }
        })

        let tenantBearerToken;

        try {
            tenantBearerToken = await getBearerToken(tenantRecord);
        } catch (error) {
            console.log('Error in getting bearer token: ', error.message);
        }

        const axiosInstanceTenant = axiosInstance({
            url: tenantRecord.tenant_host_url,
            token: tenantBearerToken
        });

        await fetchAndUpdatePackagesForTenant(tenantRowFromScheduler, axiosInstanceTenant, tenantRecord)

        // second -> populate artifacts
    } catch (error) {
        console.log('Error in fn: populatePackageArtifact: ', error.message);
    }
}

const checkValidTenant = async (tenant_id) => {

    try {
        // tenantInfoRecord.tpa_is_tenant_connection_ok
        const tenantRecord = await Tenant.findOne({
            where: {
                tenant_id: tenant_id
            }
        });

        // this is for API 
        let inputCredentialsForAPI = {
            tokenEndpoint: tenantRecord.tenant_host_token_api,
            clientId: tenantRecord.tenant_host_username,
            clientSecret: decryptData(tenantRecord.tenant_host_password, getEncryptionIV(tenantRecord.tenant_iv_salt)),
        }

        // this is for Util/Iflow
        let inputCredentialsForIflow = {
            tokenEndpoint: tenantRecord.tenant_util_token_url,
            clientId: tenantRecord.tenant_util_client_id,
            clientSecret: decryptData(
                tenantRecord.tenant_util_client_secret,
                getEncryptionIV(tenantRecord.tenant_util_iv_salt)
            )
        }

        const bearerToken = await getOAuth(inputCredentialsForAPI);
        const bearerTokenForIFlow = await getOAuthForIFlow(inputCredentialsForIflow);

        // if both api and iFlow are not having valid credentials
        if (!bearerToken || !bearerTokenForIFlow) {
            console.log('Invalid credential tokens for tenant', tenant_id);
            const updateScheduler = await TenantPackageArtifactInfo.update({
                tpa_is_tenant_connection_ok: false
            }, {
                where: {
                    is_deleted: false,
                    tpa_tenant_id: tenant_id
                }
            })
            return false;
        } else {
            // tenant value is valid 
            const updateScheduler = await TenantPackageArtifactInfo.update({
                tpa_is_tenant_connection_ok: true
            }, {
                where: {
                    is_deleted: false,
                    tpa_tenant_id: tenant_id
                },
                logging: (sql) => {
                    console.log(`Executing SQL query for ${TenantPackageArtifactInfo.tableName}:`, sql);
                }
            });

            console.log('Valid Tokens for tenant id: ', tenant_id);
            return true;
        }


    } catch (error) {
        console.log('Error in checking tenant connection ok: ', error.message);
        return false;
    }
}

const fetchAndUpdatePackagesForTenant = async (
    tenantRowFromScheduler, axiosInstanceTenant, tenantRecord) => {

    try {
        const url = `/api/v1/IntegrationPackages`; // SAP api end point to get all packages for a Tenant
        console.log('SAP API -> get all packages for Tenant: ', url);
        const responsePackages = await axiosInstanceTenant.get(url); // this is the reference for packages in the current tenant
        console.log(`No of Packages for tenant ${tenantRecord.tenant_id}`, responsePackages.data.d.results.length);

        console.log('Tenant tpa_id: ', tenantRowFromScheduler.tpa_id);

        let tenantPackageInfo = await TenantPackage.findAll({
            where: {
                is_deleted: false,
                tpa_id: tenantRowFromScheduler.tpa_id
            },
            logging: (sql) => {
                console.log(`Executing SQL query for ${TenantPackageArtifactInfo.tableName}:`, sql);
            }
        });

        let tenantDataPopulated = await TenantPackageArtifactInfo.findOne({
            where: {
                is_deleted: false,
                tpa_id: tenantRowFromScheduler.tpa_id,
            }
        })

        console.log('Tenant Data populated: ', tenantDataPopulated);

        if (tenantPackageInfo.length === 0 && !tenantDataPopulated.is_seeding_data_populated) {
            console.log('----tenantPackageInfo count', tenantPackageInfo);
            // if no information regarding it exists then create bulk information in the TenantPackage table

            let bulkCreatePackageArray = [];
            responsePackages.data.d.results.forEach(packageItem => {

                let data = {};

                data.tpa_id = tenantRowFromScheduler.tpa_id;
                data.tp_last_sync_on = Math.floor(Date.now() / 1000);
                data.tp_package_id = packageItem.Id; // aasuming that 
                data.tp_pacakge_name = packageItem.Name;
                data.tp_package_resource_id = packageItem.ResourceId;
                data.tp_package_description = packageItem.Description;
                data.tp_package_shorttext = packageItem.ShortText;
                data.tp_package_version = packageItem.Version;
                data.tp_package_vendor = packageItem.Vendor;
                data.tp_package_partner_content = packageItem.PartnerContent; // boolean
                data.tp_package_update_available = packageItem.UpdateAvailable; // boolean
                data.tp_package_mode = packageItem.Mode;
                data.tp_package_supported_platform = packageItem.SupportedPlatform;
                data.tp_packaged_modified_by = packageItem.ModifiedBy; // string from SAP id
                data.tp_package_creation_date = packageItem.CreationDate; // string 12 digit epoch
                data.tp_package_modified_date = packageItem.ModifiedDate; // string 12 digit epoch
                data.tp_package_created_by = packageItem.CreatedBy; // string from SAP id
                data.tp_package_products = packageItem.Products;
                data.tp_package_keywords = packageItem.Keywords;
                data.tp_package_countries = packageItem.Countries;
                data.tp_package_industries = packageItem.Industries
                data.tp_package_line_of_business = packageItem.LineOfBusiness;
                data.tp_error = null;
                data.is_deleted = false;
                data.created_by = null;
                data.modified_by = null;

                bulkCreatePackageArray.push(data);
            })

            let newlyCreatedPackageData = await TenantPackage.bulkCreate(bulkCreatePackageArray, {
                logging: (sql) => {
                    console.log(`Starting bulkCreate operation for TenantPackage at ${new Date().toISOString()}::`, sql);
                }
            });

            if (newlyCreatedPackageData) {
                console.log('NEW Data-----------------------------', newlyCreatedPackageData.length);
                // this for loop will act as if executing callbacks one by one
                for (let i = 0; i < newlyCreatedPackageData.length; i++) {
                    let tp_pckgData = newlyCreatedPackageData[i];

                    console.log('\ntp_ID: -------------', tp_pckgData.tp_id);

                    const [valueMappingArtifacts,
                        messageMappingArtifacts,
                        scriptCollectionArtifacts] = await getOtherArtifactTypes(axiosInstanceTenant, tp_pckgData.tp_package_id)

                    await insertDataForTenantArtifact(valueMappingArtifacts, tp_pckgData, tenantRowFromScheduler, tenantRecord, "ValueMappingDesigntimeArtifacts");
                    await insertDataForTenantArtifact(messageMappingArtifacts, tp_pckgData, tenantRowFromScheduler, tenantRecord, "MessageMappingDesigntimeArtifacts");
                    await insertDataForTenantArtifact(scriptCollectionArtifacts, tp_pckgData, tenantRowFromScheduler, tenantRecord, "ScriptCollectionDesigntimeArtifacts");

                    const integrationFlowArtifacts = await getIntegrationFlowArtifactType(axiosInstanceTenant, tp_pckgData.tp_package_id);
                    await insertDataForTenantArtifact(integrationFlowArtifacts, tp_pckgData, tenantRowFromScheduler, tenantRecord, "IntegrationDesigntimeArtifacts");

                    console.log('integrationFlowArtifacts length', integrationFlowArtifacts.length);
                }
            }

            // console.log('----------------------------------in initial seeding data, UPDATE status');
            await TenantPackageArtifactInfo.update({
                tpa_last_sync_on: Math.floor(Date.now() / 1000),
                tpa_progress_status_id: PROCESS_STATUS.COMPLETED,
                is_seeding_data_populated: true
            }, {
                where: {
                    tpa_id: tenantRowFromScheduler.tpa_id,
                    is_deleted: false,
                    tpa_is_tenant_connection_ok: true
                },
                logging: (sql) => {
                    console.log('updating TPA info for COMPLETED: ', sql);
                }
            });


        } else if (tenantPackageInfo.length > 0 && tenantDataPopulated.is_seeding_data_populated) { // problem -> in next run I will get some data
            // and then it would run --> need to devise a way to skip it when initial conditions
            // data is being populated
            console.log('\n\nTENANT ELSE CONDITION ----------------------------------------------');

            // fetch all packages from tenant first 
            let packagesMapFromSAP = new Map();
            let packagesFromTenant = responsePackages.data.d.results; // Tenant from SAP

            packagesFromTenant.forEach(packageItem => {
                // console.log('COUNT , for packages map from sap.....');
                packagesMapFromSAP.set(packageItem.Id, packageItem)
            })

            let packagesMapFromTable = new Map();
            tenantPackageInfo.forEach(packageItem => {
                packagesMapFromTable.set(packageItem.tp_package_id, packageItem)
            })

            // these two arrays for 
            let newPackagesToAddInTable = [];
            let softDeletePackagesFromTable = []; // stores a  tp_id array -> for soft deleting

            let updateForTableObject = {}

            // to find out which packages are no more in Tenant(SAP) and hence soft delete from table
            for (let i = 0; i < tenantPackageInfo.length; i++) {
                let tablePackageItem = tenantPackageInfo[i];

                if (!packagesMapFromSAP.has(tablePackageItem.tp_package_id)) {
                    // the package which is not found in SAP but in table -> update table by marking soft delete
                    // console.log('1. Package id not found in SAP:', tablePackageItem.tp_package_id );
                    // pushing corresponding Ids to mark as soft delete -> later on mark in artifact as soft delete
                    softDeletePackagesFromTable.push(tablePackageItem.tp_id)
                } else { // package is there, but any of its property has changed then
                    let packageFromSAP = packagesMapFromSAP.get(tablePackageItem.tp_package_id);

                    if (parseInt(packageFromSAP.ModifiedDate) > parseInt(tablePackageItem.tp_package_modified_date)) {
                        console.log('Package properties in SAP has been modified: ', packageFromSAP.Name);
                        // check if any of these parameters in a packages has changed.
                        // if changed, update them in the table otherwise keep the data in table unchanged

                        // for package Id
                        if (packageFromSAP.Name !== tablePackageItem.tp_pacakge_name) {

                            if (!updateForTableObject.Name) {
                                updateForTableObject.Name = []
                            }

                            updateForTableObject.Name.push({
                                modifiedPackageName: packageFromSAP.Name,
                                tp_id: tablePackageItem.tp_id
                            })

                        }

                        // for Package Description
                        if (packageFromSAP.Description !== tablePackageItem.tp_package_description) {

                            if (!updateForTableObject.Description) {
                                updateForTableObject.Description = []
                            }

                            updateForTableObject.Description.push({
                                modifiedDescription: packageFromSAP.Description,
                                tp_id: tablePackageItem.tp_id
                            })

                        }

                        // for  package shorttext
                        if (packageFromSAP.ShortText !== tablePackageItem.tp_package_shorttext) {

                            if (!updateForTableObject.ShortText) {
                                updateForTableObject.ShortText = []
                            }

                            updateForTableObject.ShortText.push({
                                modifiedShorttext: packageFromSAP.ShortText,
                                tp_id: tablePackageItem.tp_id
                            })
                        }

                        // for package version
                        if (packageFromSAP.Version !== tablePackageItem.tp_package_version) {

                            if (!updateForTableObject.Version) {
                                updateForTableObject.Version = []
                            }

                            updateForTableObject.Version.push({
                                modifiedVersion: packageFromSAP.Version,
                                tp_id: tablePackageItem.tp_id
                            });
                        }

                        // for package supported platform
                        if (packageFromSAP.SupportedPlatform !== tablePackageItem.tp_package_supported_platform) {

                            if (!updateForTableObject.SupportedPlatform) {
                                updateForTableObject.SupportedPlatform = []
                            }

                            updateForTableObject.SupportedPlatform.push({
                                modifiedSupportedPlatform: packageFromSAP.SupportedPlatform,
                                tp_id: tablePackageItem.tp_id
                            });

                        }

                        if (parseInt(packageFromSAP.ModifiedDate) > parseInt(tablePackageItem.tp_package_modified_date)) {
                            if (!updateForTableObject.ModifiedDate) {
                                updateForTableObject.ModifiedDate = []
                            }

                            updateForTableObject.ModifiedDate.push({
                                alteredModifiedDate: packageFromSAP.ModifiedDate,
                                tp_id: tablePackageItem.tp_id
                            });
                        }

                    } // if condition for modified date ends here

                } // ELSE Condition 


            }

            // write a promise.all -> to consume the keys which have been created

            //   console.log('updateForTableObject: ', JSON.stringify(updateForTableObject, null, 2));

            // Extract the necessary data from the object
            const { Name, Description, ShortText, Version, SupportedPlatform, ModifiedDate } = updateForTableObject;

            // Create an array of promises for each update operation
            const updatePromises = [];

            if (Name && Name.length > 0) {
                Name.forEach(pkgName => {
                    updatePromises.push(
                        TenantPackage.update(
                            { tp_pacakge_name: pkgName.modifiedPackageName },
                            {
                                where: { tp_id: pkgName.tp_id, is_deleted: false },
                                logging: (sql) => {
                                    console.log(`Update PackageName::>> ${new Date().toISOString()}::`, sql);
                                }
                            }
                        )
                    );
                });
            }

            if (Description && Description.length > 0) {
                Description.forEach(description => {
                    updatePromises.push(
                        TenantPackage.update(
                            { tp_package_description: description.modifiedPackageName },
                            {
                                where: { tp_id: description.tp_id, is_deleted: false },
                                logging: (sql) => {
                                    console.log(`Update Description::>> ${new Date().toISOString()}::`, sql);
                                }
                            }
                        )
                    );
                });
            }

            if (ShortText && ShortText.length > 0) {
                ShortText.forEach(shrttext => {
                    updatePromises.push(
                        TenantPackage.update(
                            { tp_package_shorttext: shrttext.modifiedPackageName },
                            {
                                where: { tp_id: shrttext.tp_id, is_deleted: false },
                                logging: (sql) => {
                                    console.log(`Update ShortText::>> ${new Date().toISOString()}::`, sql);
                                }
                            }
                        )
                    );
                });
            }

            if (Version && Version.length > 0) {
                Version.forEach(ver => {
                    updatePromises.push(
                        TenantPackage.update(
                            { tp_package_version: ver.modifiedVersion },
                            {
                                where: { tp_id: ver.tp_id, is_deleted: false },
                                logging: (sql) => {
                                    console.log(`Update Package Version::>> ${new Date().toISOString()}::`, sql);
                                }
                            }
                        )
                    );
                });
            }

            if (SupportedPlatform && SupportedPlatform.length > 0) {
                SupportedPlatform.forEach(supportedPlatform => {
                    updatePromises.push(
                        TenantPackage.update(
                            { tp_package_supported_platform: supportedPlatform.modifiedVersion },
                            {
                                where: { tp_id: supportedPlatform.tp_id, is_deleted: false },
                                logging: (sql) => {
                                    console.log(`Update SupportedPlatform::>> ${new Date().toISOString()}::`, sql);
                                }
                            }
                        )
                    );
                });
            }

            if (ModifiedDate && ModifiedDate.length > 0) {
                ModifiedDate.forEach(date => {
                    updatePromises.push(
                        TenantPackage.update(
                            { tp_package_modified_date: date.alteredModifiedDate },
                            {
                                where: { tp_id: date.tp_id, is_deleted: false },
                                logging: (sql) => {
                                    console.log(`Update Package Modified Date::>> ${new Date().toISOString()}::`, sql);
                                }
                            }
                        )
                    );
                });
            }

            // Execute all update promises concurrently
            Promise.all(updatePromises)
                .then(() => {
                    console.log("---->>> All fields updated successfully. <<<-----");
                })
                .catch(err => {
                    console.error("Error updating fields: ", err);
                });


            // console.log('Soft delete package::>>> ', softDeletePackagesFromTable);

            let updateTenantPackages = await TenantPackage.update({
                is_deleted: true
            }, {
                where: {
                    tp_id: softDeletePackagesFromTable,
                    is_deleted: false
                },
                //  logging: (sql) => {
                //     console.log(`Update tenant package soft delete at ${new Date().toISOString()}::`, sql);
                // }
            })

            if (updateTenantPackages) {
                // console.log('Update tenant packages soft delete: ', updateTenantPackages);
            }

            // once the package has been updated by is_deleted = true // update the corresponding
            // artifacts for soft delete [ since a package is deleted, artifact ought to be deleted only]
            let updateArtifactsForSoftDelete = await TenantArtifact.update({
                is_deleted: true
            }, {
                where: {
                    tp_id: softDeletePackagesFromTable,
                    is_deleted: false
                },
                // logging: (sql) => {
                //     console.log(`Updating artifact for soft delete in TenantArtifact: `, sql);
                // }
            })

            if (updateArtifactsForSoftDelete) {
                // console.log('update soft delete artifacts',updateArtifactsForSoftDelete );
            }

            const tpaIdForThisSet = tenantPackageInfo[0].tpa_id;

            for (let i = 0; i < packagesFromTenant.length; i++) {
                let packageItem = packagesFromTenant[i];
                if (!packagesMapFromTable.has(packagesFromTenant[i].Id)) {
                    // The package which is not found in table -> insert it in packages table
                    // console.log('2. Package id not found in Table:', packagesFromTenant[i].Id );

                    let data = {};

                    data.tpa_id = tpaIdForThisSet;
                    data.tp_last_sync_on = Math.floor(Date.now() / 1000);
                    data.tp_package_id = packageItem.Id; // aasuming that 
                    data.tp_pacakge_name = packageItem.Name;
                    data.tp_package_resource_id = packageItem.ResourceId;
                    data.tp_package_description = packageItem.Description;
                    data.tp_package_shorttext = packageItem.ShortText;
                    data.tp_package_version = packageItem.Version;
                    data.tp_package_vendor = packageItem.Vendor;
                    data.tp_package_partner_content = packageItem.PartnerContent; // boolean
                    data.tp_package_update_available = packageItem.UpdateAvailable; // boolean
                    data.tp_package_mode = packageItem.Mode;
                    data.tp_package_supported_platform = packageItem.SupportedPlatform;
                    data.tp_packaged_modified_by = packageItem.ModifiedBy; // string from SAP id
                    data.tp_package_creation_date = packageItem.CreationDate; // string 12 digit epoch
                    data.tp_package_modified_date = packageItem.ModifiedDate; // string 12 digit epoch
                    data.tp_package_created_by = packageItem.CreatedBy; // string from SAP id
                    data.tp_package_products = packageItem.Products;
                    data.tp_package_keywords = packageItem.Keywords;
                    data.tp_package_countries = packageItem.Countries;
                    data.tp_package_industries = packageItem.Industries
                    data.tp_package_line_of_business = packageItem.LineOfBusiness;
                    data.tp_error = null;
                    data.is_deleted = false;
                    data.created_by = null;
                    data.modified_by = null;

                    newPackagesToAddInTable.push(data);
                }
            }

            let newlyCreatedPackageData = await TenantPackage.bulkCreate(newPackagesToAddInTable);

            if (newlyCreatedPackageData) {
                //    console.log('newly created data for package', newlyCreatedPackageData.length)

                //    console.log('NEW Data-----------------------------', newlyCreatedPackageData.length);
                // this for loop will act as if executing callbacks one by one
                for (let i = 0; i < newlyCreatedPackageData.length; i++) {
                    let tp_pckgData = newlyCreatedPackageData[i];

                    //   console.log('\ntp_ID: -------------', tp_pckgData.tp_id);
                    //   console.log('tp package id: ', tp_pckgData.tp_package_id);

                    const [valueMappingArtifacts,
                        messageMappingArtifacts,
                        scriptCollectionArtifacts] = await getOtherArtifactTypes(axiosInstanceTenant, tp_pckgData.tp_package_id)

                    await insertDataForTenantArtifact(valueMappingArtifacts, tp_pckgData, tenantRowFromScheduler, tenantRecord, "ValueMappingDesigntimeArtifacts");
                    await insertDataForTenantArtifact(messageMappingArtifacts, tp_pckgData, tenantRowFromScheduler, tenantRecord, "MessageMappingDesigntimeArtifacts");
                    await insertDataForTenantArtifact(scriptCollectionArtifacts, tp_pckgData, tenantRowFromScheduler, tenantRecord, "ScriptCollectionDesigntimeArtifacts");

                    const integrationFlowArtifacts = await getIntegrationFlowArtifactType(axiosInstanceTenant, tp_pckgData.tp_package_id);
                    await insertDataForTenantArtifact(integrationFlowArtifacts, tp_pckgData, tenantRowFromScheduler, tenantRecord, "IntegrationDesigntimeArtifacts");

                    console.log('integrationFlowArtifacts length', integrationFlowArtifacts.length);
                }

            }

            let artifactMapFromTable = new Map();
            let artifactMapFromSAP = new Map();

            console.log('Hello, World!!!!!!!!!!!!!!!!!!!---->');
            for (let i = 0; i < packagesFromTenant.length; i++) { // For Each package
                // For Each package FROM The tenant we are going to perform the operations
                let tenantPackageItem = packagesFromTenant[i];

                let tenantPackageFromTable = await TenantPackage.findOne({
                    where: {
                        is_deleted: false,
                        tpa_id: tenantRowFromScheduler.tpa_id,
                        tp_package_id: tenantPackageItem.Id
                    },
                    // logging:  (sql) => {
                    //     console.log(`Executing SQL query for <<I>>: ${TenantPackage.tableName}:`, sql);
                    // }
                });

                console.log('\n\nTP ID: ', tenantPackageFromTable.tp_id);
                let tenantArtifactTable = await TenantArtifact.findAll({
                    where: {
                        is_deleted: false,
                        tp_id: tenantPackageFromTable.tp_id
                    },
                    logging: (sql) => {
                        console.log(`Executing SQL query for <<II>>: ${TenantArtifact.tableName}:`, sql);
                    }
                });

                let tenantArtifactFromTable = JSON.parse(JSON.stringify(tenantArtifactTable)) // re think this step

                tenantArtifactFromTable.forEach(artifact => {
                    artifactMapFromTable.set(artifact.ta_artifact_id, artifact);
                });

                const [
                    valueMappingArtifacts,
                    messageMappingArtifacts,
                    scriptCollectionArtifacts
                ] = await getOtherArtifactTypes(axiosInstanceTenant, tenantPackageItem.Id);

                const integrationFlowArtifacts = await getIntegrationFlowArtifactType(axiosInstanceTenant, tenantPackageItem.Id);
                console.log('integrationFlowArtifacts: : ->>', integrationFlowArtifacts.length);

                // Append here in artifactMapFromSAP from various artifact api response.
                integrationFlowArtifacts.forEach(iFlow_item => {
                    iFlow_item.ArtifactType = 'IntegrationDesigntimeArtifacts';
                    if (iFlow_item.Name === 'FireBirst_Test_Demo1') {
                        console.log('\n-----------------> found iFlow: ', iFlow_item.Name);
                    }
                    artifactMapFromSAP.set(iFlow_item.Id, iFlow_item); // Id here is Artifact Id
                });

                valueMappingArtifacts.forEach(valMap_item => {
                    valMap_item.ArtifactType = 'ValueMappingDesigntimeArtifacts';
                    artifactMapFromSAP.set(valMap_item.Id, valMap_item);  // Id here is Artifact Id
                });

                messageMappingArtifacts.forEach(messageMap_item => {
                    messageMap_item.ArtifactType = 'MessageMappingDesigntimeArtifacts';
                    artifactMapFromSAP.set(messageMap_item.Id, messageMap_item)  // Id here is Artifact Id
                });

                scriptCollectionArtifacts.forEach(scriptCollection => {
                    scriptCollection.ArtifactType = 'ScriptCollectionDesigntimeArtifacts';
                    artifactMapFromSAP.set(scriptCollection.Id, scriptCollection)  // Id here is Artifact Id
                });


                console.log('tenantArtifactTable.length', tenantArtifactTable.length);
                // Now Compare these between table Map and SAP Map

                const tpIdForThisSet = tenantPackageFromTable.tp_id;
                console.log('\n\n\npackage id for this set: ', tpIdForThisSet);

                const artifactPromises = [];

                artifactMapFromSAP.forEach((artifactSapItem, artifactIdKey) => {
                    console.log('item::<<<<<<<<>>>>>>> ', artifactIdKey);

                    // Artifact not found in table, inserting the row into table
                    if (!artifactMapFromTable.has(artifactIdKey)) {
                        console.log('\n\n\nThe Artifact is not found in table, adding new artifact to the table');
                        artifactPromises.push(createNewArtifactRecord(tpIdForThisSet, artifactSapItem));
                    }
                });

                Promise.all(artifactPromises)
                    .then(() => {
                        console.log('All artifact records processed successfully.');
                    })
                    .catch(error => {
                        console.error('Error in processing artifact records:', error);
                    });

                let softDeleteArtifactsFromTable = [];

                let updateForArtifactTableObject = {}

                // comparison
                for (let i = 0; i < tenantArtifactTable.length; i++) {
                    console.log('tenantArtifactTable--------------------------------------------------------- for I: ', i);
                    let tableArtifactItem = tenantArtifactTable[i];

                    if (!artifactMapFromSAP.has(tableArtifactItem.ta_artifact_id)) {
                        console.log('1. Artifact id not found in SAP, soft deleting in table:', tableArtifactItem.ta_artifact_id);
                        // pushing corresponding Ids to mark as soft delete -> later on mark in artifact as soft delete
                        softDeleteArtifactsFromTable.push(tableArtifactItem.ta_id)
                    } else { // checking for property changes in artifact
                        console.log('----->FOR property modification of Artifact');
                        let artifactItemFromSAP = artifactMapFromSAP.get(tableArtifactItem.ta_artifact_id);

                        console.log('parseInt(artifactItemFromSAP.ModifiedAt) > parseInt(tableArtifactItem.ta_artifact_modified_date: ', parseInt(artifactItemFromSAP.ModifiedAt) > parseInt(tableArtifactItem.ta_artifact_modified_date));



                        // check if Artifact's modifiedDate(SAP property) is different in SAP and artifact table
                        if (parseInt(artifactItemFromSAP.ModifiedAt) > parseInt(tableArtifactItem.ta_artifact_modified_date)) {
                            console.log('------------->Artifact in SAP which has been Modified: ', artifactItemFromSAP.Name);

                            // IF Artifact's Name is changed in the SAP -> then update the Name in table
                            if (artifactItemFromSAP.Name !== tableArtifactItem.ta_artifact_name) {
                                if (!updateForArtifactTableObject.ArtifactName) {
                                    updateForArtifactTableObject.ArtifactName = []
                                }

                                updateForArtifactTableObject.ArtifactName.push({
                                    modifiedArtifactName: artifactItemFromSAP.Name,
                                    ta_id: tableArtifactItem.ta_id
                                })
                            }

                            // IF Artifact's description is changed in the SAP -> then update the Description in table
                            if (artifactItemFromSAP.Description !== tableArtifactItem.ta_artifact_description) {
                                if (!updateForArtifactTableObject.Description) {
                                    updateForArtifactTableObject.Description = []
                                }

                                updateForArtifactTableObject.Description.push({
                                    modifiedDescription: artifactItemFromSAP.Description,
                                    ta_id: tableArtifactItem.ta_id
                                })
                            }

                            // IF Artifact's version is changed in the SAP -> then update the version in table
                            if (artifactItemFromSAP.Version !== tableArtifactItem.ta_artifact_version) {
                                if (!updateForArtifactTableObject.Version) {
                                    updateForArtifactTableObject.Version = []
                                }

                                updateForArtifactTableObject.Version.push({
                                    modifiedVersion: artifactItemFromSAP.Version,
                                    ta_id: tableArtifactItem.ta_id
                                })
                            }

                        } // modified at timestamp 

                    } // Else condition ends here


                } // for loop ends here

                const { ArtifactName, Description, Version } = updateForArtifactTableObject;

                // Create an array of promises for each update operation
                const updateArtifactPromises = [];

                if (ArtifactName && ArtifactName.length > 0) {
                    ArtifactName.forEach(artifactName => {
                        updateArtifactPromises.push(
                            TenantArtifact.update(
                                { ta_artifact_name: artifactName.modifiedArtifactName },
                                {
                                    where: { ta_id: artifactName.ta_id, is_deleted: false },
                                    logging: (sql) => {
                                        console.log(`Update Artifact Name::>> ${new Date().toISOString()}::`, sql);
                                    }
                                }
                            )
                        );
                    });
                }

                if (Description && Description.length > 0) {
                    Description.forEach(description => {
                        updateArtifactPromises.push(
                            TenantArtifact.update(
                                { ta_artifact_description: description.modifiedDescription },
                                {
                                    where: { ta_id: description.ta_id, is_deleted: false },
                                    logging: (sql) => {
                                        console.log(`Update Artifact Description::>> ${new Date().toISOString()}::`, sql);
                                    }
                                }
                            )
                        );
                    });
                }

                if (Version && Version.length > 0) {
                    Version.forEach(version => {
                        updateArtifactPromises.push(
                            TenantArtifact.update(
                                { ta_artifact_version: version.modifiedVersion },
                                {
                                    where: { ta_id: version.ta_id, is_deleted: false },
                                    logging: (sql) => {
                                        console.log(`Update Artifact Version::>> ${new Date().toISOString()}::`, sql);
                                    }
                                }
                            )
                        );
                    });
                }

                console.log('\n updateForArtifactTableObject---------------------------------------:> ', updateForArtifactTableObject);

                // Execute all update promises for artifacts concurrently
                Promise.all(updateArtifactPromises)
                    .then(() => {
                        console.log("---->>> All fields for artifacts modified updated successfully. <<<-----");
                    })
                    .catch(err => {
                        console.error("Error updating fields for artifact updation: ", err);
                    });

                console.log('Soft delete artifacts id::>>> ', softDeleteArtifactsFromTable);

                let updateArtifactsSoftDelete = await TenantArtifact.update({
                    is_deleted: true
                }, {
                    where: {
                        ta_id: softDeleteArtifactsFromTable,
                        is_deleted: false
                    },
                    logging: (sql) => {
                        console.log(`Update tenant artifacts soft delete at ${new Date().toISOString()}::`, sql);
                    }
                })

                if (updateArtifactsSoftDelete) {
                    console.log('\nUpdate tenant artifacts soft delete:: ', updateArtifactsSoftDelete);
                }

                // reset all the Maps in order to use again

                artifactMapFromTable.clear();
                artifactMapFromSAP.clear();

            }


            console.log('---------------------------------- after seeding data in ELSE, UPDATE status');
            await TenantPackageArtifactInfo.update({
                tpa_last_sync_on: Math.floor(Date.now() / 1000),
                tpa_progress_status_id: PROCESS_STATUS.COMPLETED,
            }, {
                where: {
                    tpa_id: tenantRowFromScheduler.tpa_id,
                    is_deleted: false,
                    tpa_is_tenant_connection_ok: true
                },
                logging: (sql) => {
                    console.log('updating TPA info for COMPLETED in ELSE: ', sql);
                }
            });

        }


    } catch (error) {
        console.log('Errorrrrr...: ', error);
        console.log(`Error in getting tenant id's:${tenantRowFromScheduler.tpa_tenant_id}`, error.message);
    }

}

async function insertDataForTenantArtifact(artifactArray, tp_packageData, tenantRowFromScheduler, tenantRecord, artifactType) {
    try {
        // insert data into table
        // console.log('\n\nInserting data for artifact type: ', artifactType);

        let artifactInfoArray = [];
        artifactArray.forEach(artifactItem => {
            let data = {};

            data.tp_id = tp_packageData.tp_id
            data.ta_last_sync_on = Math.floor(Date.now() / 1000);
            data.ta_artifact_id = artifactItem.Id;
            data.ta_artifact_type = artifactType; // from the parameter of this function
            data.ta_artifact_name = artifactItem.Name;
            data.ta_artifact_version = artifactItem.Version;
            data.ta_artifact_description = artifactItem.Description;
            data.ta_artifact_package_id = artifactItem.PackageId;
            data.ta_artifact_modified_by = artifactItem.ModifiedBy;
            data.ta_artifact_creation_date = artifactItem.CreatedAt;
            data.ta_artifact_modified_date = artifactItem.ModifiedAt;
            data.ta_artifact_created_by = artifactItem.CreatedBy;
            data.ta_error = false;
            data.is_deleted = false;
            data.created_by = null;
            data.modified_by = null;

            artifactInfoArray.push(data);
            // using bulk insert 
        })

        await TenantArtifact.bulkCreate(artifactInfoArray, {
            logging: (sql) => {
                console.log(`Starting bulkCreate operation for TenantArtifact at ${new Date().toISOString()}::`, sql);
            }
        });

    } catch (error) {
        console.log('for function: insertDataForTenantArtifact: ', error.message);
    }

}

async function createNewArtifactRecord(tp_id, artifactItem) {
    try {
        let data = {

            tp_id: tp_id,
            ta_last_sync_on: Math.floor(Date.now() / 1000),
            ta_artifact_id: artifactItem.Id || null,
            ta_artifact_type: artifactItem.ArtifactType || null, // from the parameter of this function
            ta_artifact_name: artifactItem.Name || null,
            ta_artifact_version: artifactItem.Version || null,
            ta_artifact_description: artifactItem.Description || null,
            ta_artifact_package_id: artifactItem.PackageId || null,
            ta_artifact_modified_by: artifactItem.ModifiedBy || null,
            ta_artifact_creation_date: artifactItem.CreatedAt || null,
            ta_artifact_modified_date: artifactItem.ModifiedAt || null,
            ta_artifact_created_by: artifactItem.CreatedBy || null,
            ta_error: null,
            is_deleted: false,
            created_by: null,
            modified_by: null
        }


        await TenantArtifact.create(data, {
            logging: (sql) => {
                console.log(`:>><::-> Starting create operation for TenantArtifact table at ${new Date().toISOString()}::`, sql);
            }
        });
    } catch (error) {
        console.log('Error in creating new artifact record for table', error.message);
    }

}


async function getOtherArtifactTypes(axiosInstanceTenant, packageId) {
    // console.log('In other function getOtherArtifactTypes');
    // other than Integration flow artifact types information to be gathered here.
    let commonUrl = `/api/v1/IntegrationPackages('${packageId}')`;
    const valueMappingUrl = commonUrl + '/ValueMappingDesigntimeArtifacts';
    const messageMappingUrl = commonUrl + '/MessageMappingDesigntimeArtifacts';
    const scriptCollectionUrl = commonUrl + '/ScriptCollectionDesigntimeArtifacts';
    // console.log('GET OTHER TYPE ARTIFACT:');
    try {

        const [
            valueMappingArtifacts,
            messageMappingArtifacts,
            scriptCollectionArtifacts
        ] = await Promise.all([
            await axiosInstanceTenant.get(valueMappingUrl),
            await axiosInstanceTenant.get(messageMappingUrl),
            await axiosInstanceTenant.get(scriptCollectionUrl),
        ]);


        return [valueMappingArtifacts.data.d.results,
        messageMappingArtifacts.data.d.results,
        scriptCollectionArtifacts.data.d.results]
    } catch (error) {
        console.log('Error in getOther Type Artifacts: ', error.message);
    }
}


async function getIntegrationFlowArtifactType(axiosInstanceTenant, packageId) {
    // console.log('In other function getIntegrationFlowArtifactType');
    let commonUrl = `/api/v1/IntegrationPackages('${packageId}')`;
    const iFlowUrl = commonUrl + '/IntegrationDesigntimeArtifacts';
    try {

        const integrationFlowArtifact = await axiosInstanceTenant.get(iFlowUrl);
        return integrationFlowArtifact.data.d.results;

    } catch (error) {
        console.log('Error in integration flow Type Artifacts: ', error.message);
    }

}


module.exports = {
    getPackageAndArtifactInformationForTenant,
    checkValidTenant
}