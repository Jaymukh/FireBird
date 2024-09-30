const integrationPackageService = require("../services/IntegrationPackageService");

async function getAllPackagesList(req, res) {
    try {
        integrationPackageService.getIntegrationPackagesList(req, res)
    } catch (error) {
        console.log("\nError in function: getAllPackagesList");
    }
}


async function postEntry(req, res) {

    const { packageIds, overWrite } = req.body;

    if (!packageIds) {
        return res.status(400).json({ error: "Packages Id(s) must be provided" });
    }

    if (!packageIds.length) {
        return res.status(400).json({ error: "Packages Id(s) must be provided" });
    }

    if (!overWrite) {
        return res.status(400).json({ error: "Overwrite parameter must be provided" })
    }

    try {
        await integrationPackageService.postList(req, res, packageIds, overWrite);
    } catch (error) {
        console.log('error: stack', error.stack)
        console.log("\nError in function: postEntry");

    }
}

async function getIntegrationPackageDetailsByPackageId(req, res) {
    console.log("\ngetIntegrationPackageDetailsByPackageId");
    // payload validation
    const packageId = req.params.id;
    console.log('Package Id: ', packageId);

    if (!packageId) {
        return res.status(400).json({ error: "package Id required" })
    }

    try {
        await integrationPackageService.getIntegrationPackageById(req, res, packageId);
    } catch (error) {
        console.log('Error message: ', error.message);
        console.log('error: stack', error.stack);
        console.log("\nError in function: getPackageById");

    }
}

async function downloadIntegrationPackageBlob(req, res) {
    console.log("\ngetIntegrationPackageDetailsByPackageId");
    // payload validation
    const packageId = req.params.packageId;
    console.log('Package Id: ', packageId);

    if (!packageId) {
        return res.status(400).json({ error: "package Id required" })
    }

    try {
        await integrationPackageService.downloadIntegrationPackage(req, res, packageId);
    } catch (error) {
        console.log('Error message: ', error.message);
        console.log('error: stack', error.stack);
        console.log("\nError in function: getPackageById");

    }

}

async function getAllPackagesWithArtifactsInformation(req, res) {
    try {
        await integrationPackageService.getPackagesWithArtifactsInfo(req, res);
    } catch (error) {
        console.log('Error message: ', error.message);
        console.log('error: stack', error.stack);
        console.log("\nError in function: getAllPackagesWithArtifactsInformation");

    }
}

async function cloneIntegrationPackagesWithArtifacts(req, res) {
    try {
        await integrationPackageService.copyPackagesWithArtifacts(req, res);
    } catch (error) {
        console.log('Error message: ', error.message);
        console.log('error: stack', error.stack);
        console.log("\nError in function: cloneIntegrationPackagesWithArtifacts");

    }
}

async function copyConfigForArtifacts(req, res) {
    try {
        await integrationPackageService.copyConfigurations(req, res);
    } catch (error) {
        console.log('Error message: ', error.message);
        console.log('error: stack', error.stack);
        console.log("\nError in function: copyConfigForArtifacts");

    }
}

async function getAllTenantPackageArtifactList(req, res) {
    try {
        await integrationPackageService.fetchPackageAndArtifactListFromTable(req, res);
    } catch (error) {
        console.log('Error message: ', error.message);
        console.log('error: stack', error.stack);
        console.log("\nError in function: getAllTenantPackageArtifactList");

    }
}

async function scheduleTenantPackageArtifactDataFetch(req, res) {
    try {
        await integrationPackageService.scheduleTenantDataFetch(req, res);
    } catch (error) {
        console.log('Error message: ', error.message);
        console.log('error: stack', error.stack);
        console.log("\nError in function: scheduleTenantPackageArtifactDataFetch");

    }
}


async function postDailyTimeInterval(req, res) {
    try {
        await integrationPackageService.createDailyTimeInterval(req, res);
    } catch (error) {
        console.log('Error message: ', error.message);
        console.log('error: stack', error.stack);
        console.log("\nError in function: postDailyTimeInterval");

    }
}

async function getAllDailyTimeInterval(req, res) {
    try {
        await integrationPackageService.fetchAllDailyTimeInterval(req, res);
    } catch (error) {
        console.log('Error message: ', error.message);
        console.log('error: stack', error.stack);
        console.log("\nError in function: getAllDailyTimeInterval");

    }
}

async function editDailyTimeInterval(req, res) {
    try {
        await integrationPackageService.modifyDailyTimeInterval(req, res);
    } catch (error) {
        console.log('Error message: ', error.message);
        console.log('error: stack', error.stack);
        console.log("\nError in function: editDailyTimeInterval");

    }
}

async function getDailyTimeInterval(req, res) {
    try {
        await integrationPackageService.fetchDailyTimeInterval(req, res);
    } catch (error) {
        console.log('Error message: ', error.message);
        console.log('error: stack', error.stack);
        console.log("\nError in function: getDailyTimeInterval");

    }
}

async function getAllTenantPairMap(req, res) {
    try {
        await integrationPackageService.fetchAllTenantPairs(req, res);
    } catch (error) {
        console.log('Error message: ', error.message);
        console.log('error: stack', error.stack);
        console.log("\nError in function: getAllTenantPairMap");

    }
}

async function postTenantPairMap(req, res) {
    try {
        await integrationPackageService.createTenantPairMap(req, res);
    } catch (error) {
        console.log('Error message: ', error.message);
        console.log('error: stack', error.stack);
        console.log("\nError in function: postTenantPairMap");

    }
}

async function editTenantPairMap(req, res) {
    try {
        await integrationPackageService.modifyTenantPairMap(req, res);
    } catch (error) {
        console.log('Error message: ', error.message);
        console.log('error: stack', error.stack);
        console.log("\nError in function: editTenantPairMap");

    }
}

async function getOneTenantPairMap(req, res) {
    try {
        await integrationPackageService.fetchOneTenantPairMap(req, res);
    } catch (error) {
        console.log('Error message: ', error.message);
        console.log('error: stack', error.stack);
        console.log("\nError in function: getOneTenantPairMap");

    }
}

async function deleteOneTenantPairMap(req, res) {
    try {
        await integrationPackageService.removeTenantPairMap(req, res);
    } catch (error) {
        console.log('Error message: ', error.message);
        console.log('error: stack', error.stack);
        console.log("\nError in function: getDailyTimeInterval");

    }
}


// export all the modules
module.exports = {
    getAllPackagesList,
    postEntry,
    getAllPackagesWithArtifactsInformation,
    getIntegrationPackageDetailsByPackageId,
    downloadIntegrationPackageBlob,
    cloneIntegrationPackagesWithArtifacts,
    copyConfigForArtifacts,
    getAllTenantPackageArtifactList,
    scheduleTenantPackageArtifactDataFetch,
    postDailyTimeInterval,
    getAllDailyTimeInterval,
    editDailyTimeInterval,
    getDailyTimeInterval,
    getAllTenantPairMap,
    postTenantPairMap,
    editTenantPairMap,
    getOneTenantPairMap,
    deleteOneTenantPairMap
}