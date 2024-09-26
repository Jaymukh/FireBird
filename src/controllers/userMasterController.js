
const userMasterService = require("../services/userMasterService");


const getAllUserMasterRecords = async (req, res) => {
    try {
        userMasterService.getAllUserRecords(req,res);

    } catch(error) {
        console.log('Error in getAllUserMasterRecords: ', error);
    }
}

const addUserMasterRecord = async( req, res) => {
    try {
        userMasterService.addUserRecord(req,res);

    } catch(error) {
        console.log('Error in addUserMasterRecord: ', error);
    }
}

const removeUserMasterRecord = async( req, res) => {
    const id = req.params.id;

    try {
        userMasterService.removeUserRecord(req,res,id);

    } catch(error) {
        console.log('Error in removeUserMasterRecord: ', error);
    }
}

const getUserMasterRecordById = async( req, res) => {
    console.log('getGitMasterRecordById');
    const id = req.params.id;

    try {
        userMasterService.getUserRecordById(req,res, id);

    } catch(error) {
        console.log('Error in getUserMasterRecordById: ', error);
    }
}

const getUserMasterRecordByUserId = async( req, res) => {

    const userId = req.params.userId;
    console.log("\nUser ID:: ", userId)

    try {
        userMasterService.getUserRecordByUserId(req,res, userId);
        

    } catch(error) {
        console.log('Error in getUserMasterRecordByUserId: ', error);
    }
}

const updateUserMasterRecord = async ( req, res) => {
    console.log('updateUserMasterRecord: ')
    try {
        userMasterService.updateUserRecord(req,res);

    } catch(error) {
        console.log('Error in updateUserMasterRecord: ', error);
    }
}

module.exports = {
    getAllUserMasterRecords,
    addUserMasterRecord,
    removeUserMasterRecord,
    getUserMasterRecordById,
    getUserMasterRecordByUserId,
    updateUserMasterRecord
}