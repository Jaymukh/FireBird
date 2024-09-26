// const { getOAuthGit } = require("../util/auth");
const  sequelize  = require("../dbconfig/config");
const GitRepository = require("../models/gitRepository");
const { HttpStatusCode } = require("axios");
const { decryptData, getEncryptionIV } = require("../util/decode");
const { Octokit } = require("@octokit/rest");
const { UNSUCCESSFUL_TEST_STATUS, SUCCESSFUL_TEST_STATUS } = require("../constants/taxonomyValues");
const { sendResponse } = require("../util/responseSender");
const { responseObject } = require('../constants/responseTypes');

async function copyPackagesToGitRepository(req,res) {
//    let abc = await getOAuthGit()
   res.json({"message": abc});
}

async function downloadPackageFromGit(req,res) {

}


const checkGitConnection = async (req, res, grId) => {
    const transaction = await sequelize.transaction();
    
    try {
        const response = await GitRepository.findByPk(grId, { transaction });

        if (!response) {
            await transaction.rollback();
            return sendResponse(
                res, // response object
                false, // success
                HttpStatusCode.NotFound, // statusCode
                responseObject.RECORD_NOT_FOUND, // status type
                 `Git id : ${grId} not found` // message
            );
            // return res.status(HttpStatusCode.NotFound).json({ error: `Git id : ${grId} not found`});
        }

        console.log('\nGit record found');
        console.log('Response data: ', JSON.parse(JSON.stringify(response)));
        
        console.log('VALUE: ', decryptData( response.gr_client_secret, getEncryptionIV(response.gr_iv_salt)) );
            // Create an Octokit instance
        const octokit = new Octokit({
            auth: decryptData( response.gr_client_secret, getEncryptionIV(response.gr_iv_salt) )// Replace with your own PAT
        });
        // Fetch repository information
        const gitRepoResponse = await octokit.rest.repos.get({
            owner: response.gr_owner_name,
            repo: response.gr_name
        });
        
            // If successful, log the repository information
        console.log("Repository found:", gitRepoResponse.data);
          
        if (!gitRepoResponse || gitRepoResponse === null) {
            // Simulate failure for Tenant connection not OK
            await GitRepository.update({ gr_state_id: UNSUCCESSFUL_TEST_STATUS }, {
                where: {
                    gr_id: grId
                },
                transaction
            });
            await transaction.commit();
            return sendResponse(
                res, // response object
                false, // success
                HttpStatusCode.NotFound, // statusCode
                responseObject.TEST_CONNECTION_NOT_OK, // status type
                 `Git test connection for ${gitRepoResponse.gr_name} is unsuccesful` // message
            );
            // return res.status(HttpStatusCode.NotFound).json({ success: false});
        }

        if (gitRepoResponse) {
            console.log('\nGot git repo response')
            await GitRepository.update({ gr_state_id: SUCCESSFUL_TEST_STATUS }, {
                where: {
                    gr_id: grId
                },
                transaction
            });
            await transaction.commit();
            return sendResponse(
                res, // response object
                true, // success
                HttpStatusCode.Ok, // statusCode
                responseObject.TEST_CONNECTION_OK, // status type
                `Git test connection for ${gitRepoResponse.gr_name} is successful` // message
            );
            // return res.status(HttpStatusCode.Ok).json({ success: true });
        }
        
    } catch(error) {
        console.log('Error in checkGitConnection Service: ', error);
        await transaction.rollback();
        return sendResponse(
            res, // response object
            false, // success
            HttpStatusCode.InternalServerError, // statusCode
            responseObject.INTERNAL_SERVER_ERROR, // status type
            `Internal Server Error: in checking git connection.` // message
        );
        // return res.status(HttpStatusCode.InternalServerError).json({ success: false });
    }
}

module.exports = {
    copyPackagesToGitRepository,
    downloadPackageFromGit,
    checkGitConnection
}