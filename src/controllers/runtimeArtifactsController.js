const runtimeArtifacts = require("../services/runtimeArtifactsService")
const getRuntimeArtifactsWithDesigntimeArtifacts= async (req, res) => {

    try {
        runtimeArtifacts.getSourceTenantRuntimeWithTargetTenantDesigntimeArtifacts(req, res)
    } catch (error) {
        console.log('Error in controller function: getRuntimeArtifactsWithDesigntimeArtifacts ', error);
    }
}

const postFailoverConfig = async (req, res) => {
    try {
        runtimeArtifacts.postFailoverConfig(req, res);
    } catch (error) {
        console.log('Error in controller function: getRuntimeArtifactsWithDesigntimeArtifacts ', error);
    }
}

const schedulePlannedFailover = async (req, res) => {
    try {
        runtimeArtifacts.schedulePlannedFailoverForTenants(req,res)
    } catch (error) {
        console.log('Error in controller function: getRuntimeArtifactsWithDesigntimeArtifacts ', error);

    }
}

const getFailoverStatus = async (req, res) => {
    try {
        runtimeArtifacts.getFailoverStatusForTenants(req,res)
    } catch (error) {
        console.log('Error in controller function: getRuntimeArtifactsWithDesigntimeArtifacts ', error);

    }
}

module.exports = {
    getRuntimeArtifactsWithDesigntimeArtifacts,
    schedulePlannedFailover,
    postFailoverConfig,
    getFailoverStatus
}

