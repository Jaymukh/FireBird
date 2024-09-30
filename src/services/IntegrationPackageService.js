const { axiosInstance } = require("./cpiClient");
const { getOAuthTenantOne, getOAuthTenantTwo, getBearerTokenForTenants, getOAuth } = require("../util/auth");
const { encryptData, decryptData, getEncryptionIV } = require("../util/decode")
const axios = require("axios");
const Tenant = require("../models/tenant");
const { artifactTypes } = require("../constants/apiEndpoints");
const UFMProfile = require("../models/ufmProfile");
const UFMSyncHeader = require("../models/UFM/ufmSyncHeader");
const UFMSyncDetail = require("../models/UFM/ufmSyncDetail");
const sequelize = require("../dbconfig/config");
const crypto = require("crypto");
const UFMBackupHeader = require("../models/ufmBackupHeader");
const UFMBackupDetail = require("../models/ufmBackupDetail");
const TenantPackageArtifactInfo = require("../models/Tenant/tenantPacakgeArtifactInfo");
const TenantPackage = require("../models/Tenant/tenantPackage");
const TenantArtifact = require("../models/Tenant/tenantArtifact");
const { sendResponse } = require("../util/responseSender");
const { responseObject } = require("../constants/responseTypes");
const { HttpStatusCode } = require("axios");
const { findOneRecord } = require("../data-access/generalDataAccess");
const { PROCESS_STATUS } = require("../constants/taxonomyValues");
const DailyTimeInterval = require("../models/Tenant/dailyTimeInterval");
const UserModel = require("../models/userModel");
const TenantPairMap = require("../models/Tenant/tenantPairMap");
const { tenantTableColumns } = require("../constants/tableColumns");


const baseURLTenantOne = "https://86f3b06dtrial.it-cpitrial06.cfapps.us10-001.hana.ondemand.com/api/v1";

/****************************** GET All Packages for a tenant ********************************* */
async function getIntegrationPackagesList(req, res, isFunctionCall = false) {
    const tenantId = req.params.tenantId;

    try {
        let tenantMasterResponse = await Tenant.findByPk(tenantId);

        if (!tenantMasterResponse) {
            return res.status(404).json({ error: `Tenant id:${tenantId} not found in Database` });
        }

        let authCredentials = {
            tokenEndpoint: tenantMasterResponse.tenant_host_token_api,
            clientId: tenantMasterResponse.tenant_host_username,
            clientSecret: decryptData(tenantMasterResponse.tenant_host_password, getEncryptionIV(tenantMasterResponse.tenant_iv_salt)),
        }

        let tenantBearerToken = await getOAuth(authCredentials);

        if (!tenantBearerToken) {
            return res.status(404).json({ error: `Error in getting Bearer token for tenant:${tenantId}` });
        }
        let targetUrl = tenantMasterResponse.tenant_host_url + "/api/v1";
        console.log('TargetURL: ', targetUrl);

        let response = await axiosInstance({
            url: `${targetUrl}/IntegrationPackages`,
            token: tenantBearerToken
        }).get();

        if (!response) {
            return res.status(500).json({ message: "Error in fetching package record for tenant" })
        }

        if (!response.data.d.results.length) {
            return res.status(400).json({ message: "No integration packages are there" })
        }
        let integrationPackages = mapToIntegrationPackage(response.data.d.results);

        // In case the function is required again
        if (isFunctionCall) {
            return integrationPackages.map(package => package.Id)
        }

        return res.status(200).json(integrationPackages);


    } catch (error) {
        console.log('Error in getIntegrationPackagesList: ', error);
    }
}

/****************************** GET Integration package by Id ********************************* */
// get this package by Id -> for tenant One
async function getIntegrationPackageById(req, res, integrationPackageId) {
    tenantOneToken = await getOAuthTenantOne();

    let response = await axiosInstance({
        url: `${baseURLTenantOne}/IntegrationPackages('${integrationPackageId}')`,
        timeout: 3000,
        token: tenantOneToken
    }).get();

    if (!response) {
        return res.status(500).json({ message: "Error in fetching package record for tenant" })
    }

    let integrationPackage = mapToIntegrationPackage(response.data.d);
    return res.status(200).json(integrationPackage);
}
/****************************** Post packages ********************************* */
async function postList(req, res, packageIds, overWrite) {
    let tenantOneToken = await getOAuthTenantOne();
    let tenantTwoToken = await getOAuthTenantTwo();

    // check in the list of source packages whether the requested packages from payload exist or not
    let allIntegrationPackages = await getIntegrationPackagesList(req, res, true);
    let unmatchedPackages = checkIfIntegrationPackagesAvailable(packageIds, allIntegrationPackages);
    if (unmatchedPackages.length) {
        return res.status(400).json({ error: "Some packages does not match", unmatchedPackages })
    }

    // copying the integration packages
    for (let i = 0; i < packageIds.length; i++) {
        // get the blob of the 
        let response = await axiosInstance({
            url: `${baseURLTenantOne}/IntegrationPackages('${packageIds[i]}')/$value`,
            timeout: 40000,
            token: tenantOneToken,
            responseType: 'arraybuffer'
        }).get();

        try {

            let postRequest = await axiosInstance({
                url: `${baseURLTenantTwo}`,
                timeout: 20000,
                token: tenantTwoToken,
            }).post(`/IntegrationPackages?Overwrite=${overWrite}`,
                JSON.stringify({ "PackageContent": Buffer.from(response.data, 'binary').toString("base64") })
            )

            console.log("Request successful:", postRequest.data);
        } catch (error) {
            if (error.response) {
                // how to handle overWrite=false -> if it is needed
                console.error("Server responded with error status:", error.response.status);
                console.error("Response data:", error.response.data);
                return res.status(error.response.status).json(error.response.data)

            } else if (error.request) {
                console.error("No response received from the server");
            } else {
                console.error("Error setting up the request:", error.message);
            }
        }
    }
    return res.status(200).json({ message: "Request posted" })
}

// make this later on
async function downloadIntegrationPackage(req, res, integrationPackageId) {
    try {
        tenantOneToken = await getOAuthTenantOne();
        // get package by id and download package by id -> response-> if package by id not found
        // these both apis have the same response
        let response = await axiosInstance({
            url: `${baseURLTenantOne}/IntegrationPackages('${integrationPackageId}')/$value`,
            timeout: 50000,
            token: tenantOneToken,
            responseType: 'buffer'
        }).get();

        if (!response) {
            return res.status(200).json({ message: "rectify this" })
        }

        res.setHeader('Content-Disposition', 'attachment; filename="file.zip"');
        res.setHeader('Content-Type', 'application/octet-stream'); // Set the appropriate content type

        // Send the buffer as the response
        return res.status(200).end(response.data, 'binary');


    } catch (error) {
        if (error.response.status === 404) {
            return res.status(404).json({ error: "Given package not found" });
        }
    }
}

const fetchPackageAndArtifactListFromTable = async (req, res) => {
    try {

        const { tenantOneId, tenantTwoId } = req.params;

        const tenantOneRecordQuery = await Tenant.findOne({
            where: {
                tenant_id: tenantOneId,
                is_deleted: false
            }
        })

        if (!tenantOneRecordQuery) {
            return sendResponse(
                res, // response object
                false, // success
                HttpStatusCode.NotFound, // statusCode
                responseObject.RECORD_NOT_FOUND, // status type
                `Data not found for tenant id: ${tenantOneId}`, // message
                {}
            );

        }

        const tenantTwoRecordQuery = await Tenant.findOne({
            where: {
                tenant_id: tenantTwoId,
                is_deleted: false
            }
        })

        if (!tenantTwoRecordQuery) {
            return sendResponse(
                res, // response object
                false, // success
                HttpStatusCode.NotFound, // statusCode
                responseObject.RECORD_NOT_FOUND, // status type
                `Data not found for tenant id: ${tenantTwoId}`, // message
                {}
            );
        }

        let packageArtifactQuery = await TenantPackageArtifactInfo.findAll({
            where: {
                tpa_tenant_id: [tenantOneRecordQuery.tenant_id, tenantTwoRecordQuery.tenant_id],
                is_deleted: false
            },
            include: [
                {
                    model: Tenant,
                    attributes: ['tenant_id', 'tenant_name', 'is_deleted']
                },
                {
                    model: TenantPackage,
                    where: { is_deleted: false },
                    include: [
                        {
                            model: TenantArtifact,
                            where: { is_deleted: false }
                        }
                    ]
                }
            ]
        });

        let tenantPackageArtifact = JSON.parse(JSON.stringify(packageArtifactQuery));

        for (let i = 0; i < tenantPackageArtifact.length; i++) {
            tenantPackageArtifact[i].tenant_name = tenantPackageArtifact[i].tenant.tenant_name;
            delete tenantPackageArtifact[i].tenant;
        }

        return sendResponse(
            res, // response object
            true, // success
            HttpStatusCode.Ok, // statusCode
            responseObject.RECORD_FOUND, // status type
            `A list of tenant package artifacts`, // message
            tenantPackageArtifact
        );

    } catch (error) {
        console.log('Error in service fetchPackageAndArtifactList', error.message);
        return sendResponse(
            res, // response object
            false, // success
            HttpStatusCode.InternalServerError, // statusCode
            responseObject.INTERNAL_SERVER_ERROR, // status type
            `In getting tenant package artifact list:${error.message}`, // message
            {}
        );
    }

}

async function getBearerToken(tenantResponse) {
    const authCredentials = {
        tokenEndpoint: tenantResponse.tenant_host_token_api,
        clientId: tenantResponse.tenant_host_username,
        clientSecret: decryptData(
            tenantResponse.tenant_host_password,
            getEncryptionIV(tenantResponse.tenant_iv_salt)
        )
    };
    return getOAuth(authCredentials);
}

async function fetchIntegrationPackages(axiosInstance) {
    console.log('REACHINGHERE');
    const url = `/api/v1/IntegrationPackages`;
    console.log('URL package: ', url)
    const response = await axiosInstance.get(url);
    return response;
}

function calculateChecksum(data) {
    // Convert JSON data to a string

    const jsonString = JSON.stringify(data);

    // Calculate MD5 checksum
    const checksum = crypto.createHash('md5').update(jsonString).digest('hex');
    return checksum;
}


async function fetchArtifacts(axiosInstance, integrationPackages, artifactTypes) {
    const fetchArtifact = async (integrationPackage, artifactType) => {
        const url = `/api/v1/IntegrationPackages('${integrationPackage.Id}')/${artifactType}`;
        const response = await axiosInstance.get(url);

        const artifacts = await Promise.all(response.data.d.results.map(async artifact => {
            let returnObject = {
                Id: artifact.Id,
                Name: artifact.Name,
                Type: artifactType,
                Version: artifact.Version,
                doesConfigExists: artifact.hasOwnProperty('Configurations')
            };

            if (artifact.hasOwnProperty('Configurations')) {
                const configUrl = `/api/v1/IntegrationDesigntimeArtifacts(Id='${artifact.Id}',Version='${artifact.Version}')/Configurations`;
                const configResponse = await axiosInstance.get(configUrl);

                if (configResponse) {
                    // sending the config checksum if configuration proprty exists.
                    // if the checksum for both the artifact objects on tenants differs, then
                    // only we will copy the configurations

                    configResponse.data.d.results.forEach(item => {
                        delete item.__metadata;
                    });

                    // console.log('\nConfigData: ', JSON.stringify(configResponse.data, null,2));

                    returnObject.configCheckSum = calculateChecksum(configResponse.data);
                }
            }

            return returnObject;
        }));

        return artifacts;
    };

    const packageArray = await Promise.all(integrationPackages.map(async integrationPackage => {
        const artifactResponses = await Promise.all(artifactTypes.map(async artifactType => {
            return fetchArtifact(integrationPackage, artifactType);
        }));

        const artifacts = artifactResponses.flat();
        return {
            PackageId: integrationPackage.Id,
            PackageName: integrationPackage.Name,
            Version: integrationPackage.Version,
            Description: integrationPackage.Description,
            ShortText: integrationPackage.ShortText,
            SupportedPlatform: integrationPackage.SupportedPlatform,
            Products: integrationPackage.Products,
            Keywords: integrationPackage.Keywords,
            Countries: integrationPackage.Countries,
            Industries: integrationPackage.Industries,
            LineOfBusiness: integrationPackage.LineOfBusiness,
            artifacts
        };
    }));
    return packageArray;
}

const getPackagesWithArtifacts = async (tenantOneId, tenantTwoId, isCalledFromAPI = false) => {
    try {
        const [tenantOneDbResponse, tenantTwoDbResponse] = await Promise.all([
            Tenant.findByPk(tenantOneId),
            Tenant.findByPk(tenantTwoId)
        ]);

        const [tenantOneBearerToken, tenantTwoBearerToken] = await Promise.all([
            getBearerToken(tenantOneDbResponse),
            getBearerToken(tenantTwoDbResponse)
        ]);

        if (!tenantOneBearerToken || !tenantTwoBearerToken) {
            throw Error(`Error in getting Bearer token for one of the tenants`)
        }

        const axiosInstanceTenantOne = axiosInstance({
            url: tenantOneDbResponse.tenant_host_url,
            token: tenantOneBearerToken
        });
        const axiosInstanceTenantTwo = axiosInstance({
            url: tenantTwoDbResponse.tenant_host_url,
            token: tenantTwoBearerToken
        });

        const [responseTenantOne, responseTenantTwo] = await Promise.all([
            fetchIntegrationPackages(axiosInstanceTenantOne),
            fetchIntegrationPackages(axiosInstanceTenantTwo)
        ]);

        if (responseTenantOne.error || responseTenantTwo.error) {
            throw Error("Error in fetching package records for tenant(s)")
        }

        const [tenantOnePackageArray, tenantTwoPackageArray] = await Promise.all([
            fetchArtifacts(axiosInstanceTenantOne, responseTenantOne.data.d.results, artifactTypes),
            fetchArtifacts(axiosInstanceTenantTwo, responseTenantTwo.data.d.results, artifactTypes)
        ]);

        const mainResponseArray = [
            { key: tenantOneDbResponse.tenant_name, packages: tenantOnePackageArray },
            { key: tenantTwoDbResponse.tenant_name, packages: tenantTwoPackageArray }
        ];
        if (isCalledFromAPI) {
            return mainResponseArray;
        } else {
            return { mainResponseArray, axiosInstanceTenantOne, axiosInstanceTenantTwo }
        }
    } catch (error) {
        console.log('Error in service function getPackagesWithArtifacts: ', error.message);
        return error.message;
    }

}

async function getPackagesWithArtifactsInfo(req, res) {
    const { tenantOneId, tenantTwoId } = req.params;
    let isCalledFromAPI = true;
    let mainResponseArray = await getPackagesWithArtifacts(tenantOneId, tenantTwoId, isCalledFromAPI);

    if (!Array.isArray(mainResponseArray)) {
        return res.status(500).json({ error: mainResponseArray })
    }
    const data = await getGitRecords(req, res, mainResponseArray);
    return res.status(200).json({ data: data });


}

const getGitRecords = async (req, res, mainResponseArray) => {
    const profileId = req.params.profileId;
    const componentType = '11001';
    try {
        const data = await UFMBackupHeader.findOne({
            where: {
                ufm_profile_id: profileId,
                is_last_record: true,
                ufm_component_type_id: componentType
            }
        });
        if (!data || !data.ufm_backup_header_id) {
            return mainResponseArray;
        }

        const lastRecordData = await UFMBackupDetail.findAll({
            where: {
                ufm_backup_header_id: data.ufm_backup_header_id
            },
            attributes: [
                'ufm_backup_component_package_id',
                'ufm_backup_component_package_name',
                'ufm_backup_component_package_version',
                'ufm_backup_component_package_desc',
                'ufm_backup_component_package_shorttext',
                'ufm_backup_component_id',
                'ufm_backup_component_name',
                'ufm_backup_component_version'
            ],
            group: [
                'ufm_backup_component_package_id',
                'ufm_backup_component_package_name',
                'ufm_backup_component_package_version',
                'ufm_backup_component_package_desc',
                'ufm_backup_component_package_shorttext',
                'ufm_backup_component_id',
                'ufm_backup_component_name',
                'ufm_backup_component_version'
            ],
            raw: true
        });

        if (!lastRecordData || !lastRecordData.length) {
            return mainResponseArray;
        }
        const groupedData = lastRecordData.reduce((acc, curr) => {
            const packageId = curr.ufm_backup_component_package_id;
            if (!acc[packageId]) {
                acc[packageId] = {
                    PackageId: curr.ufm_backup_component_package_id,
                    PackageName: curr.ufm_backup_component_package_name,
                    Version: curr.ufm_backup_component_package_version,
                    Description: curr.ufm_backup_component_package_desc,
                    ShortText: curr.ufm_backup_component_package_shorttext,
                    artifacts: []
                };
            }
            acc[packageId].artifacts.push({
                Id: curr.ufm_backup_component_id,
                Name: curr.ufm_backup_component_name,
                Version: curr.ufm_backup_component_version,
                doesConfigExists: curr.ufm_backup_component_config_path ? true : false,
            });
            return acc;
        }, {});
        const results = Object.values(groupedData);

        const tenantData = mainResponseArray[0].packages;
        const updatedPrimaryTenantData = comparePackagesAndArtifacts(tenantData, results);
        const result = [{ key: mainResponseArray[0].key, packages: updatedPrimaryTenantData }, mainResponseArray[1]]
        return result;
    } catch (error) {
        console.log(error)
    }
}

const comparePackagesAndArtifacts = (arr1, arr2) => {
    return arr1.map(pkg1 => {
        const matchedPkg = arr2.find(pkg2 => pkg2.PackageId === pkg1.PackageId);
        const doesExistInGit = !!matchedPkg;

        const updatedArtifacts = pkg1.artifacts.map(artifact1 => {
            const doesArtifactExistInGit = matchedPkg
                ? !!matchedPkg.artifacts.find(artifact2 => artifact2.Id === artifact1.Id)
                : false;
            return {
                ...artifact1,
                doesArtifactExistInGit: doesArtifactExistInGit
            };
        });

        return {
            ...pkg1,
            doesExistInGit: doesExistInGit,
            artifacts: updatedArtifacts
        };
    });
};


// async function fetchIntegrationPackages(axiosInstance) {
//     const url = `/api/v1/IntegrationPackages`;
//     console.log('URL package: ', url);
//     const response = await axiosInstance.get(url);
//     return response;
// }

// async function fetchArtifact(axiosInstance, url) {
//     console.log('\nURL : ', url);
//     const response = await axiosInstance.get(url);
//     const packageId = url.match(/IntegrationPackages\('([^']+)'\)/)[1];
//     return response.data.d.results.map(artifact => ({
//         PackageId: packageId,
//         Id: artifact.Id,
//         Name: artifact.Name,
//         Type: url.split('/').pop(), // Extract artifactType from URL
//         Version: artifact.Version,
//         doesConfigExists: artifact.hasOwnProperty('Configurations') ? true : false,
//     }));
// }

// async function fetchUrlsInBatches(axiosInstance, urls, batchSize, delay) {
//     const results = [];
//     for (let i = 0; i < urls.length; i += batchSize) {
//         const batch = urls.slice(i, i + batchSize);
//         const batchResults = await Promise.all(batch.map(async (url) => fetchArtifact(axiosInstance, url)));
//         results.push(...batchResults.flat());
//         if (i + batchSize < urls.length) {
//             console.log(`Waiting for ${delay} milliseconds before processing the next batch...`);
//             const start = Date.now();
//             await new Promise(resolve => setTimeout(resolve, delay));
//             const end = Date.now();
//             console.log(`Waited for ${end - start} milliseconds`);
//         }
//     }
//     return results;
// }

// async function processIntegrationPackages(axiosInstance, integrationPackages, artifactTypes, batchSize, delay) {
//     const urlArray = [];
//     for (let i = 0; i < integrationPackages.length; i++) {
//         for (let j = 0; j < artifactTypes.length; j++) {
//             let url = `/api/v1/IntegrationPackages('${integrationPackages[i].Id}')/${artifactTypes[j]}`;
//             urlArray.push(url);
//         }
//     }

//     const artifactsResults = await fetchUrlsInBatches(axiosInstance, urlArray, batchSize, delay);

//     // Reconstruct the packages with artifacts
//     const packagesWithArtifacts = integrationPackages.map(pkg => {
//         const packageArtifacts = artifactsResults.filter(artifact => 
//             artifact.PackageId === pkg.Id);
//         return {
//             PackageId: pkg.Id,
//             PackageName: pkg.Name,
//             Version: pkg.Version,
//             Description: pkg.Description,
//             ShortText: pkg.ShortText,
//             SupportedPlatform: pkg.SupportedPlatform,
//             Products: pkg.Products,
//             Keywords: pkg.Keywords,
//             Countries: pkg.Countries,
//             Industries: pkg.Industries,
//             LineOfBusiness: pkg.LineOfBusiness,
//             artifacts: packageArtifacts
//         };
//     });

//     return packagesWithArtifacts;
// }

// const getPackagesWithArtifacts = async (tenantOneId, tenantTwoId, isCalledFromAPI = false) => {
//     try {
//         const [tenantOneDbResponse, tenantTwoDbResponse] = await Promise.all([
//             Tenant.findByPk(tenantOneId),
//             Tenant.findByPk(tenantTwoId)
//         ]);

//         const [tenantOneBearerToken, tenantTwoBearerToken] = await Promise.all([
//             getBearerToken(tenantOneDbResponse),
//             getBearerToken(tenantTwoDbResponse)
//         ]);

//         if (!tenantOneBearerToken || !tenantTwoBearerToken) {
//             throw new Error(`Error in getting Bearer token for one of the tenants`);
//         }

//         const axiosInstanceTenantOne = axiosInstance({
//             url: tenantOneDbResponse.tenant_host_url,
//             token: tenantOneBearerToken
//         });
//         const axiosInstanceTenantTwo = axiosInstance({
//             url: tenantTwoDbResponse.tenant_host_url,
//             token: tenantTwoBearerToken
//         });

//         const [responseTenantOne, responseTenantTwo] = await Promise.all([
//             fetchIntegrationPackages(axiosInstanceTenantOne),
//             fetchIntegrationPackages(axiosInstanceTenantTwo)
//         ]);

//         if (responseTenantOne.error || responseTenantTwo.error) {
//             throw new Error("Error in fetching package records for tenant(s)");
//         }

//         const batchSize = 20; // Configurable batch size
//         const delay = 300; // Configurable delay in milliseconds

//         const [tenantOnePackageArray, tenantTwoPackageArray] = await Promise.all([
//             processIntegrationPackages(axiosInstanceTenantOne, responseTenantOne.data.d.results, artifactTypes, batchSize, delay),
//             processIntegrationPackages(axiosInstanceTenantTwo, responseTenantTwo.data.d.results, artifactTypes, batchSize, delay)
//         ]);

//         const mainResponseArray = [
//             { key: tenantOneDbResponse.tenant_name, packages: tenantOnePackageArray },
//             { key: tenantTwoDbResponse.tenant_name, packages: tenantTwoPackageArray }
//         ];

//         if (isCalledFromAPI) {
//             return mainResponseArray;
//         } else {
//             return { mainResponseArray, axiosInstanceTenantOne, axiosInstanceTenantTwo };
//         }
//     } catch (error) {
//         console.log('Error in service function getPackagesWithArtifacts: ', error.message);
//         return error.message;
//     }
// }

// async function getPackagesWithArtifactsInfo(req, res) {
//     const { tenantOneId, tenantTwoId } = req.params;
//     let isCalledFromAPI = true;
//     let mainResponseArray = await getPackagesWithArtifacts(tenantOneId, tenantTwoId, isCalledFromAPI);

//     if (!Array.isArray(mainResponseArray)) {
//         return res.status(500).json({ error: mainResponseArray });
//     }
//     return res.status(200).json({ data: mainResponseArray });
// }




function bifurcatePayload(payload) {
    let packagesToCloneArray = [];
    let packagesWithArtifacts = [];
    if (!Array.isArray(payload)) {
        return res.status(400).json({ message: "Expecting Package Artifact list in an array format" })
    }

    if (!payload.length) {
        return res.status(400).json({ message: "Payload is empty." })
    }

    for (let i = 0; i < payload.length; i++) {

        if (payload[i].hasOwnProperty("artifacts") && payload[i].hasOwnProperty("packageId")) {

            packagesWithArtifacts.push(payload[i]);
        } else {
            packagesToCloneArray.push(payload[i]);
        }

    }

    return [packagesToCloneArray, packagesWithArtifacts]
}

async function copyPackagesWithArtifacts(req, res) {
    // tenantOneId -> this is my source tenant
    // tenantTwoId -> this is my target tenant
    // const { tenantOneId, tenantTwoId } = req.params;
    const { ufm_profile_id } = req.body;
    const { component_type_id } = req.body;
    const { user_id } = req.body;
    const { payload } = req.body;

    const [onlyPackagesToClone, packagesWithArtifacts] = bifurcatePayload(payload);
    console.log('onlyPackagesToClone: ', onlyPackagesToClone);
    console.log('packagesWithArtifacts: ', JSON.stringify(packagesWithArtifacts, null, 2));
    // transaction will be available in the functions too
    const transaction = await sequelize.transaction();
    try {
        const ufmProfileResponse = await UFMProfile.findOne({
            where: {
                ufm_profile_id: ufm_profile_id
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

        // return res.status(200).json({ message: "Hello, World!"})
        const axiosInstanceTenantOne = axiosInstance({
            url: tenantOneDbResponse.tenant_host_url,
            responseType: 'arraybuffer',
            token: tenantOneBearerToken
        });

        const axiosInstanceTenantTwo = axiosInstance({
            url: tenantTwoDbResponse.tenant_host_url,
            token: tenantTwoBearerToken
        });


        const updateResult = await UFMSyncHeader.update(
            { is_last_record: false },
            {
                where:
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
        const unsuccessfulPackage = [];
        const unsuccessfulPackageArtifact = [];
        // Function to create packages with Artifacts
        const createPackageWithArtifacts = async (packageData, instanceOne, instanceTwo) => {
            try {
                const { packageId, isExistingOnTarget, artifacts } = packageData;
                if (!isExistingOnTarget) {
                    console.log('Package info: ', packageData)
                    let packageObject = {
                        "Id": packageId,
                        "Name": packageData.Name,
                        "Version": packageData.Version,
                        "Description": packageData.Description,
                        "ShortText": packageData.ShortText,
                        "SupportedPlatform": packageData.SupportedPlatform,
                        "Products": packageData.Products,
                        "Keywords": packageData.Keywords,
                        "Countries": packageData.Countries,
                        "Industries": packageData.Industries,
                        "LineOfBusiness": packageData.LineOfBusiness
                    }
                    console.log('packageObject: ', packageObject)
                    try {
                        const postRequest = await instanceTwo.post(`/api/v1/IntegrationPackages`,
                            packageObject
                        );
                        console.log("Package creation successful: ", postRequest.data);

                    } catch (error) {
                        unsuccessfulPackage.push(packageId);
                        console.log('package error: ', error)
                    }

                }

                await Promise.all(artifacts.map(async (artifact) => {

                    const artifactEndpointString = getArtifactEndpointString(artifact.Type);
                    const getUrl = `/api/v1/${artifactEndpointString}(Id='${artifact.Id}',Version='${artifact.Version}')/$value`;
                    const getRequest = await instanceOne.get(getUrl);
                    // console.log('ARTIFACT CONTENT: ', Buffer.from(getRequest.data, 'binary').toString("base64"));
                    try {

                        if (!artifact.hasOwnProperty("isVersionChange")) {
                            console.log('\nno property isVersionChange : POST');
                            const postRequest = await instanceTwo.post(
                                `/api/v1/${artifactEndpointString}`,
                                JSON.stringify({
                                    Id: artifact.Id,
                                    Name: artifact.Name,
                                    PackageId: packageId,
                                    ArtifactContent: Buffer.from(getRequest.data, 'binary').toString("base64")
                                })
                            );

                        } else if (artifact.hasOwnProperty("isVersionChange")) {
                            console.log('\nno property isVersionChange : PUT');
                            if (artifact.Type === "IntegrationDesigntimeArtifacts"
                                || artifact.Type === "MessageMappingDesigntimeArtifacts"
                                || artifact.Type === "ScriptCollectionDesigntimeArtifacts") {

                                const targetUrl = `/api/v1/${artifact.Type}(Id='${artifact.Id}',Version='${artifact.OldVersion}')`;

                                console.log('TargetURL in put: ', targetUrl);

                                const updateRequest = await instanceTwo.put(targetUrl, JSON.stringify({
                                    Name: artifact.Name,
                                    ArtifactContent: Buffer.from(getRequest.data, 'binary').toString("base64")
                                }));
                                if (updateRequest) {
                                    console.log(`\nARTIFACT VERSION updated for ${artifact.Id}`)
                                }

                            } else if (artifact.Type === "ValueMappingDesigntimeArtifacts") {
                                console.log('\n ELSE IF block');
                                // here basic approach is to delete the artifact from tenant Two
                                // and then post the artifact from tenant One
                                const targetUrl = `/api/v1/ValueMappingDesigntimeArtifacts`;
                                const deleteTargetUrl = `/api/v1/ValueMappingDesigntimeArtifacts(Id='${artifact.Id}',Version='${artifact.OldVersion}')`
                                console.log('TargetURL in post: ', targetUrl);
                                console.log('Target delete url: ', deleteTargetUrl)
                                const deleteRequestValueMapping = await instanceTwo.delete(deleteTargetUrl);
                                if (deleteRequestValueMapping) {
                                    console.log('Artifact deleted...')
                                }

                                const postRequestValueMapping = await instanceTwo.post(targetUrl,
                                    JSON.stringify({
                                        Id: artifact.Id,
                                        Name: artifact.Name,
                                        PackageId: packageId,
                                        ArtifactContent: Buffer.from(getRequest.data, 'binary').toString("base64")
                                    })
                                );

                                if (postRequestValueMapping) {
                                    console.log(`\nARTIFACT VERSION updated/posted for ${artifact.Id}`);
                                }
                            }

                        }

                        await UFMSyncDetail.create({
                            ufm_sync_header_id: newUFMSyncHeader.ufm_sync_header_id,
                            ufm_sync_component_package_id: packageId,
                            ufm_sync_component_package_name: packageData.Name,
                            ufm_sync_component_package_desc: packageData.Description,
                            ufm_sync_component_package_shorttext: packageData.ShortText,
                            ufm_sync_component_package_version: packageData.Version,
                            ufm_sync_component_id: artifact.Id,
                            ufm_sync_component_name: artifact.Name,
                            ufm_sync_component_desc: "description",
                            ufm_sync_component_version: artifact.Version,
                        },
                            { transaction }
                        )

                        console.log("Artifact copy successful: ", artifact.Id);
                    } catch (error) {
                        console.log('\nError in copy artifact: ', error);
                        unsuccessfulPackageArtifact.push({
                            artifactId: artifact.Id,
                            artifactName: artifact.Name,
                            packageId: packageId,
                            packageName: packageData.Name,
                            errorMessage: error.message
                        })

                    }
                }));
            } catch (error) {
                console.error('Error processing artifact of package: ', packageData.packageId, error);
                throw Error('Copying of artifact unsuccessful', packageData.packageId)
            }
        };

        const createOrCopySinglePackage = async (packageData, instanceOne, instanceTwo) => {
            console.log('createOrCopySinglePackage', packageData.packageId);
            try {
                let url = `/api/v1/IntegrationPackages('${packageData.packageId}')/$value`;
                let response = await instanceOne.get(url);

                if (!response.data) {
                    throw new Error(`No data received for package ${packageData.packageId}`);
                }

                // Convert the binary data to base64 string
                let packageContentBase64 = Buffer.from(response.data, 'binary').toString("base64");

                // Post the package content to tenant two
                let postRequest = await instanceTwo.post(
                    `/api/v1/IntegrationPackages?Overwrite=true`,
                    JSON.stringify({
                        "PackageContent": packageContentBase64
                    })
                );

                if (postRequest) {
                    console.log("Package creation successful:", postRequest.data);
                }
            } catch (error) {
                console.error('Error creating empty package:', packageData.packageId, error.message);
            }
        };


        // Create or copy packages concurrently
        try {
            await Promise.all([
                ...onlyPackagesToClone.map(packageData => createOrCopySinglePackage(packageData, axiosInstanceTenantOne, axiosInstanceTenantTwo)),
                ...packagesWithArtifacts.map(packageData => createPackageWithArtifacts(packageData, axiosInstanceTenantOne, axiosInstanceTenantTwo))
            ]);

            // Convert the data in unsuccessfulPackageArtifact, to second level for artifact
            const packageMap = new Map();

            unsuccessfulPackageArtifact.forEach(item => {
                if (!packageMap.has(item.packageId)) {
                    packageMap.set(item.packageId, {
                        packageId: item.packageId,
                        packageName: item.packageName,
                        artifacts: []
                    });
                }
                packageMap.get(item.packageId).artifacts.push({
                    artifactId: item.artifactId,
                    artifactName: item.artifactName,
                    errorMessage: item.errorMessage
                });
            });

            const unsuccessfulPackageArtifactArray = Array.from(packageMap.values());

            // console.log(JSON.stringify(unsuccessfulPackageArtifactArray,null, 2));

            await transaction.commit();

            return res.status(200).json({
                message: "Packages and Artifacts copied successfully",
                unsuccessfulPackage,
                unsuccessfulPackageArtifact: unsuccessfulPackageArtifactArray
            });
        } catch (error) {
            await transaction.rollback();
            console.log('Error: in promise all : ', error);
        }


    } catch (error) {
        // await transaction.rollback();
        console.error('Error in copyPackagesWithArtifacts: ', error.message);
        return res.status(500).json({ error: 'Internal Server Error: ' + error.message });
    }
}

const getAllPackageToBeCreated = (payload) => {

    return 1;
}
async function copyPackagesWithArtifactsWithBatchLogic(req, res) {
    const { ufm_profile_id, component_type_id, user_id, payload } = req.body;
    // create packages api for post , make batch size

    try {
        const ufmProfileResponse = await UFMProfile.findOne({
            where: {
                ufm_profile_id: ufm_profile_id
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

        // return res.status(200).json({ message: "Hello, World!"})
        const axiosInstanceTenantOne = axiosInstance({
            url: tenantOneDbResponse.tenant_host_url,
            responseType: 'arraybuffer',
            token: tenantOneBearerToken
        });

        const axiosInstanceTenantTwo = axiosInstance({
            url: tenantTwoDbResponse.tenant_host_url,
            token: tenantTwoBearerToken
        });


        const updateResult = await UFMSyncHeader.update(
            { is_last_record: false },
            {
                where:
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


    } catch (error) {

        return res.status(500).json({
            error: "Internal server error in copy packages",
            message: error.message
        })
    }


}

function getArtifactEndpointString(type) {
    switch (type) {
        case "IntegrationDesigntimeArtifacts":
            return "IntegrationDesigntimeArtifacts";
        case "MessageMappingDesigntimeArtifacts":
            return "MessageMappingDesigntimeArtifacts";
        case "ValueMappingDesigntimeArtifacts":
            return "ValueMappingDesigntimeArtifacts";
        case "ScriptCollectionDesigntimeArtifacts":
            return "ScriptCollectionDesigntimeArtifacts";
        default:
            throw new Error('Invalid artifact type');
    }
}

const copyConfigurations = async (req, res) => {
    const { ufm_profile_id, component_type_id, packages } = req.body;
    const newArtifacts = [];

    packages.forEach(pkg => {
        pkg.artifacts.forEach(artfct => {
            artfct = {
                ...artfct,
                PackageId: pkg.PackageId,
                PackageName: pkg.Name,
                Version: pkg.Version
            }
            newArtifacts.push(artfct);
        })
    })

    // return res.status(200).json({ data: newArtifacts})

    try {
        const ufmProfileResponse = await UFMProfile.findOne({
            where: {
                ufm_profile_id: ufm_profile_id
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

        const ufmSyncHeaderResponse = await UFMSyncHeader.findOne({
            where: {
                ufm_profile_id: ufm_profile_id,
                ufm_component_type_id: component_type_id,
                is_last_record: true
            }
        });

        if (!ufmSyncHeaderResponse) {
            return res.status(200).json({ error: "Sync the same packages and artifacts first before synchronising Configurations for the same" });
        }

        let failedConfigurations = [];
        let failedCounter = 0;

        // Process each artifact
        await Promise.all(newArtifacts.map(async (artifact) => {
            try {
                console.log('\nArtifact Id: ', artifact.Id);

                // Fetch configurations for the artifact from Tenant One
                const url = `/api/v1/IntegrationDesigntimeArtifacts(Id='${artifact.Id}',Version='${artifact.Version}')/Configurations`;
                const response = await axiosInstanceTenantOne.get(url);
                const configObjects = response.data.d.results;

                // Process each configuration
                await Promise.all(configObjects.map(async (configObj) => {
                    const targetUrl = encodeURI(`/api/v1/IntegrationDesigntimeArtifacts(Id='${artifact.Id}',Version='${artifact.Version}')/$links/Configurations('${configObj.ParameterKey}')`);
                    const updatedResponse = await axiosInstanceTenantTwo.put(targetUrl, {
                        ParameterValue: configObj.ParameterValue,
                        DataType: configObj.DataType
                    });

                    if (updatedResponse) {
                        console.log('\nConfig copied successfully for artifact id: ', artifact.Id);

                        // Update the sync header detail in the database
                        await UFMSyncDetail.update({
                            ufm_backup_component_config_moved: true,
                            ufm_backup_component_config_moved_timestamp: Math.floor(Date.now() / 1000)
                        }, {
                            where: {
                                ufm_sync_header_id: ufmSyncHeaderResponse.ufm_sync_header_id,
                                ufm_sync_component_package_id: artifact.PackageId,
                                ufm_sync_component_package_version: artifact.PackageVersion,
                                ufm_sync_component_id: artifact.Id,
                                ufm_sync_component_version: artifact.Version
                            }
                        });
                    }
                }));

            } catch (error) {
                failedCounter++;
                console.error(`Failed to copy configuration for ${artifact.Id}`);
                failedConfigurations.push({
                    packageId: artifact.PackageId,
                    packageName: artifact.PackageName,
                    artifactId: artifact.Id,
                    artifactName: artifact.Name,
                    // error: error.message,
                    errorMessage: error.message
                });
            }
        }));

        // Convert the data in failedConfigurations, to second level for artifact
        const packageMap = new Map();

        failedConfigurations.forEach(item => {
            if (!packageMap.has(item.packageId)) {
                packageMap.set(item.packageId, {
                    packageId: item.packageId,
                    packageName: item.packageName,
                    artifacts: []
                });
            }
            packageMap.get(item.packageId).artifacts.push({
                artifactId: item.artifactId,
                artifactName: item.artifactName,
                errorMessage: item.errorMessage
            });
        });

        const failedConfigurationsArray = Array.from(packageMap.values());
        console.log('failed configurations array: ', JSON.stringify(failedConfigurationsArray, null, 2));

        return res.status(200).json({ message: "Configurations copied successfully", failedCounter, failedConfigurationsArray });
        // return res.status(200).json({ message: "Hello, World!", failedConfigurations})
    } catch (error) {
        console.log('Error in service copyConfigurations: ', error);
        return res.status(500).json({ error: `${error.message}` })
    }

}

const getOneTenantPackagesWithArtifacts = async (tenantOneId, isCalledFromAPI = false, onlyDTArtifacts = false) => {
    try {
        const tenantOneDbResponse = await Tenant.findByPk(tenantOneId);
        const tenantOneBearerToken = await getBearerToken(tenantOneDbResponse);

        if (!tenantOneBearerToken) {
            throw Error(`Error in getting Bearer token for one of the tenants`)
        }

        const axiosInstanceTenantOne = axiosInstance({
            url: tenantOneDbResponse.tenant_host_url,
            token: tenantOneBearerToken
        });

        const responseTenantOne = await fetchIntegrationPackages(axiosInstanceTenantOne);

        if (responseTenantOne.error) {
            throw Error("Error in fetching package records for tenant(s)")
        }

        const artifactTypeList = onlyDTArtifacts ? [artifactTypes[0]] : artifactTypes;
        const tenantOnePackageArray = await fetchArtifacts(axiosInstanceTenantOne, responseTenantOne.data.d.results, artifactTypeList);

        const mainResponseArray = { key: tenantOneDbResponse.tenant_name, packages: tenantOnePackageArray };

        if (isCalledFromAPI) {
            return { mainResponseArray, axiosInstanceTenantOne };
        }
        return mainResponseArray;
    } catch (error) {
        console.log('Error in service function getPackagesWithArtifacts: ', error.message);
        return error.message;
    }

}

// For the CRON -> to schedule a tenant for gathering package artifact information and get button status
const scheduleTenantDataFetch = async (req, res) => {
    try {
        const tenantId = req.body.tenant_id || 0;
        const userId = req.body.user_id;
        const isGetStatusQuery = req.body.is_get_status_query; // this flag from FE to get status of tenant's data fetch

        if (!userId) {
            return res.status(400).json({ error: 'User id is needed' })
        }

        if (!tenantId) {
            return res.status(400).json({ error: `${error.message}` })
        }

        console.log('tenantId: ', tenantId);

        // this is totally isolated
        const tenantRecord = await findOneRecord(
            "Tenant",
            { tenant_id: tenantId, is_deleted: false },
            ['tenant_id', 'tenant_name', 'is_deleted']
        )

        if (!tenantRecord) {
            return res.status(404).json({ message: `Tenant id: ${tenantId} not found` })
        }

        // If tenant is found then, check its entry in scheduler table
        const schedulerTableRecord = await TenantPackageArtifactInfo.findOne({
            where: {
                tpa_tenant_id: tenantRecord.tenant_id,
                is_deleted: false,
                tpa_is_tenant_connection_ok: true
            }
        })

        if (schedulerTableRecord.tpa_progress_status_id === PROCESS_STATUS.SCHEDULED ||
            schedulerTableRecord.tpa_progress_status_id === PROCESS_STATUS.RUNNING
        ) {
            if (isGetStatusQuery) {
                return res.status(200).json({ data: { enableButton: false } })
            }
            return res.status(500).json({ message: `Tenant's Artifact package information fetch already in progress` })
        }

        // If the scheduler is completed for that tenant then only allow updation
        if (schedulerTableRecord.tpa_progress_status_id === PROCESS_STATUS.COMPLETED ||
            schedulerTableRecord.tpa_progress_status_id === PROCESS_STATUS.FAILED
        ) {
            if (isGetStatusQuery) {
                return res.status(200).json({ data: { enableButton: true } })
            }

            const updateSchedulerTable = await TenantPackageArtifactInfo.update({
                tpa_progress_status_id: PROCESS_STATUS.SCHEDULED,
                modified_by: userId,
            }, {
                where: {
                    tpa_tenant_id: tenantRecord.tenant_id,
                    is_deleted: false,
                    tpa_is_tenant_connection_ok: true
                },
                logging: (sql) => {
                    console.log('updating scheduler table for tenant package artifact info', sql);
                }
            });
            if (updateSchedulerTable) {
                return res.status(200).json({ message: `For tenant:${tenantRecord.tenant_name}, fetch package artifacts scheduled.` })
            }
        }


        return res.status(200).json({ data: tenantRecord })
    } catch (error) {
        console.log('Error in service function scheduleTenantDataFetch: ', error);
        return res.status(500).json({ error: error.message })
    }
}


const createDailyTimeInterval = async (req, res) => {
    try {
        const { startTime, endTime, userId } = req.body;

        const createDailyIntervalRecord = await DailyTimeInterval.create({
            dti_start_time: startTime,
            dti_end_time: endTime,
            created_by: userId,
            modified_by: userId

        })

        if (createDailyIntervalRecord) {
            return res.status(201).json({ data: createDailyIntervalRecord })
        }

    } catch (error) {
        console.log('Error : ', error);
        console.log('Error in service fn: createDailyTimeInterval: ', error.message);
    }
}

const fetchAllDailyTimeInterval = async (req, res) => {
    try {
        const getAllDailyInterval = await DailyTimeInterval.findAll({
            where: {
                is_deleted: false
            },
            include: [
                {
                    model: UserModel,
                    as: "created_by_user",
                    attributes: [
                        "user_id",
                        "email_id",
                        "external_id",
                        "first_name",
                        "last_name",
                        "display_name"
                    ]
                },
                {
                    model: UserModel,
                    as: "modified_by_user",
                    attributes: [
                        "user_id",
                        "email_id",
                        "external_id",
                        "first_name",
                        "last_name",
                        "display_name"
                    ]
                }
            ]
        })

        return res.status(200).json({ data: getAllDailyInterval })
    } catch (error) {
        console.log('Error : ', error);
        console.log('Error in service fn: fetchAllDailyTimeInterval: ', error.message);
    }
}

const modifyDailyTimeInterval = async (req, res) => {
    try {
        const { dti_id } = req.body;
        console.log('dti_id: ', dti_id)

        const dailyTimeItem = await DailyTimeInterval.findByPk(dti_id);
        if (!dailyTimeItem) {
            res.status(404).json({ error: 'daily time item not found' });
        } else {
            let {
                dti_start_time,
                dti_end_time,
                modified_by
            } = req.body;

            // not using tenant_iv_salt for now, instead using it from our .env
            // later on, use tenant_iv_salt
            await dailyTimeItem.update({
                dti_start_time,
                dti_end_time,
                modified_by
            });
            res.json(dailyTimeItem);
        }

    } catch (error) {
        console.log('Error : ', error);
        console.log('Error in service fn: modifyDailyTimeInterval: ', error.message);
    }
}

const fetchDailyTimeInterval = async (req, res) => {
    try {

        const dti_id = req.params.dti_id;
        const getOneDailyInterval = await DailyTimeInterval.findOne({
            where: {
                is_deleted: false,
                dti_id: dti_id
            },
            include: [
                {
                    model: UserModel,
                    as: "created_by_user",
                    attributes: [
                        "user_id",
                        "email_id",
                        "external_id",
                        "first_name",
                        "last_name",
                        "display_name"
                    ]
                },
                {
                    model: UserModel,
                    as: "modified_by_user",
                    attributes: [
                        "user_id",
                        "email_id",
                        "external_id",
                        "first_name",
                        "last_name",
                        "display_name"
                    ]
                }
            ]
        })
        return res.status(200).json({ data: getOneDailyInterval })

    } catch (error) {
        console.log('Error : ', error);
        console.log('Error in service fn: fetchDailyTimeInterval: ', error.message);
    }
}

const fetchAllTenantPairs = async (req, res) => {
    try {

        const tenantPairRecords = await TenantPairMap.findAll({
            where: {
                is_deleted: false
            },
            include: [
                {
                    model: UserModel,
                    as: "created_by_user",
                    attributes: [
                        "user_id",
                        "email_id",
                        "external_id",
                        "first_name",
                        "last_name",
                        "display_name"
                    ]
                },
                {
                    model: UserModel,
                    as: "modified_by_user",
                    attributes: [
                        "user_id",
                        "email_id",
                        "external_id",
                        "first_name",
                        "last_name",
                        "display_name"
                    ]
                },
                {
                    model: Tenant,
                    where: {
                        is_deleted: false
                    },
                    as: "source_tenant",
                    attributes: ['tenant_id', 'tenant_name', 'tenant_description']
                },
                {
                    model: Tenant,
                    where: {
                        is_deleted: false
                    },
                    as: "destination_tenant",
                    attributes: ['tenant_id', 'tenant_name', 'tenant_description']
                }
            ],
            logging: (sql) => {
                console.log(`SQL for get all tenan pair map, table: ${TenantPairMap.tableName}: `, sql);
            }
        })

        if (!tenantPairRecords) {
            return res.status(404).json({ error: "No data found for tenant pair." })
        }

        return res.status(200).json({ data: tenantPairRecords })
    } catch (error) {
        console.log('error in service fn:fetchAllTenantPairs: ', error);
    }
}

const createTenantPairMap = async (req, res) => {
    try {
        console.log('\nCreating tenant pair map record...');
        const {
            tpm_pair_name,
            tpm_source_tenant,
            tpm_destination_tenant,
            tpm_is_cloning_done,
            tpm_cloning_progress_status,
            tpm_cloning_last_performed_on,
            created_by, // user_id from FE
            modified_by // user_id from FE
        } = req.body;

        const tenantPair = await TenantPairMap.create({
            tpm_pair_name,
            tpm_source_tenant,
            tpm_destination_tenant,
            tpm_is_cloning_done,
            tpm_cloning_progress_status,
            tpm_cloning_last_performed_on,
            created_by,
            modified_by
        });

        if (tenantPair) {
            return res.status(200).json({ message: "Tenant pair created" })
        }
    } catch (error) {
        console.log('error in service fn:createTenantPairMap: ', error);
        if (error.name.includes('Sequelize')) {
            if (error.name === 'SequelizeForeignKeyConstraintError') { // in case user or tenant id is invalid
                return res.status(500).json({ error: error.parent.detail })
            } else {
                return res.status(500).json({ error: error.message })
            }
        }

        return res.status(500).json({ error: error.message })
    }
}

const modifyTenantPairMap = async (req, res) => {
    try {
        console.log('\nModifying tenant pair map record...');
        const {
            tpm_id,
            tpm_pair_name,
            tpm_is_pair_active,
            tpm_source_tenant,
            tpm_destination_tenant,
            tpm_is_cloning_done,
            tpm_cloning_progress_status,
            tpm_cloning_last_performed_on,
            created_by, // user_id from FE
            modified_by // user_id from FE
        } = req.body;

        const tenantPairMapRecord = await TenantPairMap.findOne({
            where: {
                tpm_id: tpm_id,
                is_deleted: false
            }
        })

        if (!tenantPairMapRecord) {
            return res.status(404).json({ message: "Tenant pair map id not found" })
        }

        const tenantPairUpdated = await TenantPairMap.update({
            tpm_pair_name,
            tpm_is_pair_active,
            tpm_source_tenant,
            tpm_destination_tenant,
            tpm_is_cloning_done,
            tpm_cloning_progress_status,
            tpm_cloning_last_performed_on,
            created_by,
            modified_by
        }, {
            where: {
                tpm_id: tpm_id,
                is_deleted: false
            }

        });

        if (tenantPairUpdated) {
            return res.status(200).json({ data: tenantPairUpdated })
        }

    } catch (error) {
        console.log('error in service fn: modifyTenantPairMap: ', error);
    }
}

const fetchOneTenantPairMap = async (req, res) => {
    try {
        const tpmId = req.params.tpm_id;

        const tenantPairRecord = await TenantPairMap.findOne({
            where: {
                is_deleted: false,
                tpm_id: tpmId
            },
            include: [
                {
                    model: UserModel,
                    as: "created_by_user",
                    attributes: [
                        "user_id",
                        "email_id",
                        "external_id",
                        "first_name",
                        "last_name",
                        "display_name"
                    ]
                },
                {
                    model: UserModel,
                    as: "modified_by_user",
                    attributes: [
                        "user_id",
                        "email_id",
                        "external_id",
                        "first_name",
                        "last_name",
                        "display_name"
                    ]
                },
                {
                    model: Tenant,
                    where: {
                        is_deleted: false
                    },
                    as: "source_tenant",
                    attributes: ['tenant_id', 'tenant_name', 'tenant_description']
                },
                {
                    model: Tenant,
                    where: {
                        is_deleted: false
                    },
                    as: "destination_tenant",
                    attributes: ['tenant_id', 'tenant_name', 'tenant_description']
                }
            ],
            logging: (sql) => {
                console.log(`SQL for get all tenan pair map, table: ${TenantPairMap.tableName}: `, sql);
            }
        })

        if (!tenantPairRecord) {
            return res.status(404).json({ error: `No data found for tenant pair id : ${tpmId}` })
        }

        return res.status(200).json({ data: tenantPairRecord })
    } catch (error) {
        console.log('error in service fn: fetchOneTenantPairMap: ', error);
    }
}

const removeTenantPairMap = async (req, res) => {
    try {
        const tpmId = req.params.tpm_id;
        const tenantPairRecord = await TenantPairMap.findOne({
            where: {
                tpm_id: tpmId,
                is_deleted: false
            }
        })

        if (!tenantPairRecord) {
            return res.status(404).json({ error: `No data found for tenant pair id : ${tpmId}` })
        }

        const softDeleteTpmRecord = await TenantPairMap.update(
            {
                is_deleted: true
            }, {
            where: {
                tpm_id: tenantPairRecord.tpm_id,
                is_deleted: false
            }
        });

        if (softDeleteTpmRecord) {
            return res.status(200).json({ message: `Tpm_id: ${tpmId} deleted successfully.` })
        }


    } catch (error) {
        console.log('error in service fn: removeTenantPairMap: ', error);
    }
}

//----------------------------------------------------------------------------------------------//
// Non exported functions:
function mapToIntegrationPackage(input) {

    const mapKeys = [
        "Id",
        "Name",
        "ResourceId",
        "Description",
        "ShortText",
        "Version",
        "Vendor",
        "PartnerContent",
        "UpdateAvailable",
        "Mode",
        "SupportedPlatform",
        "ModifiedBy",
        "CreationDate",
        "ModifiedDate",
        "CreatedBy",
        "Products",
        "Keywords",
        "Countries",
        "Industries",
        "LineOfBusiness"
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
    return mapKeysToObject(mapKeys, input);
}

function mapToArtifacts(input) {

    // Id: 'Proxy_Sync_Generic_Outbound_Pattern',
    // Version: '1.0.8',
    // PackageId: 
    // Name:
    // Description: 
    // Sender: 
    // Receiver: 
    // CreatedBy:
    // CreatedAt: 
    // ModifiedBy:
    // ModifiedAt: 

    const mapKeys = [
        "Id",
        "PackageId",
        "Name",
        "Version"
    ]

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
    return mapKeysToObject(mapKeys, input);
}

function checkIfIntegrationPackagesAvailable(inputArray, referenceArray) {
    const missingElements = inputArray.filter(item => !referenceArray.includes(item));
    return missingElements;
}


//-------------------------------------------------------------------

module.exports = {
    getIntegrationPackagesList,
    postList,
    getIntegrationPackageById,
    downloadIntegrationPackage,
    getPackagesWithArtifactsInfo,
    copyPackagesWithArtifacts,
    fetchArtifacts,
    fetchIntegrationPackages,
    getPackagesWithArtifacts,
    copyConfigurations,
    getOneTenantPackagesWithArtifacts,
    fetchPackageAndArtifactListFromTable,
    scheduleTenantDataFetch,
    createDailyTimeInterval,
    fetchAllDailyTimeInterval,
    modifyDailyTimeInterval,
    fetchDailyTimeInterval,
    fetchAllTenantPairs,
    createTenantPairMap,
    modifyTenantPairMap,
    fetchOneTenantPairMap,
    removeTenantPairMap,
}


