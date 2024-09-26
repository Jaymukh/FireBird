const  OAuth2CredentialsService= require("../services/OAuth2CredentialsService");
const getAllOAuth2Credentials = async ( req, res ) => {
    try {
       await OAuth2CredentialsService.getOAuth2Credentials(req,res);
    } catch(error) {
        console.log('Error in controller: getAllOAuth2Credentials: ', error);
    }
}

const copyOAuth2Credentials = async (req, res) => {
    try {
        await OAuth2CredentialsService.copyOAuth2CredentialsInfo(req,res);
     } catch(error) {
         console.log('Error in controller: copyOAuth2Credentials: ', error);
     }
}


module.exports = {
    getAllOAuth2Credentials,
    copyOAuth2Credentials
}