const gitActivityService = require("../services/gitActionService");
const { sendResponse } = require("../util/responseSender");
const { HttpStatusCode } = require("axios");
const { INTERNAL_SERVER_ERROR } = require("../constants/responseTypes")

async function copyPackagesOnGitFromTenant(req, res) {
    try {
        gitActivityService.copyPackagesToGitRepository(req,res);

    } catch(error) {
        console.log('Error in copyPackagesOnGitFromTenant: ', error);
        sendResponse(
            res, // response Object
            false,
            HttpStatusCode.InternalServerError,  // code
            INTERNAL_SERVER_ERROR, // type 
            "Error in copying packages on git repository from Tenant"  // message
        )
    }
}

async function downloadPackagesFromGitForTenant(req, res) {
    console.log("\nPost request")
    return res.status(200).json({ message: "hello"})
}
// To check the connection to git 
const checkGitConnectionProper = (req, res) => {
    const grId = req.params.grId;
    try {
        gitActivityService.checkGitConnection(req,res, grId);

    } catch(error) {
        console.log('Error in fn controller: checkGitConnectionProper: ', error);
        return sendResponse(
            res, // response Object
            false, // success 
            HttpStatusCode.InternalServerError,  // code
            INTERNAL_SERVER_ERROR, // type 
            error.message  // message
        )
    }
}

module.exports = {
    copyPackagesOnGitFromTenant,
    downloadPackagesFromGitForTenant,
    checkGitConnectionProper
}