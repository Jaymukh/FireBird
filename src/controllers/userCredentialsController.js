const userCredentialsService = require("../services/userCredentialsService");
const getAllUserCredentials = async (req, res) => {
    try {
        userCredentialsService.getUserCredentials(req,res)
    } catch (error) {
        console.log('erorr in controller: getAllUserCredentials: ', error)
    }
}

const copyUserCredentials = async (req, res) => {
    try {
        userCredentialsService.copyUserCredentialsInfo(req,res)
    } catch (error) {
        console.log('erorr in controller: getAllUserCredentials: ', error)
    }
}

module.exports = {
    getAllUserCredentials,
    copyUserCredentials
}