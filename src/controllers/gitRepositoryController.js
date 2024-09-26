
const gitMasterService = require("../services/gitRepositoryService");

// done
const getAllGitMasterRecords = async (req, res) => {
    try {
        gitMasterService.getAllGitRecords(req,res);

    } catch(error) {
        console.log('Error in getAllGitMasterRecords: ', error);
    }
}

// done
const addGitMasterRecord = async( req, res) => {
    try {
        gitMasterService.addGitRecord(req,res);

    } catch(error) {
        console.log('Error in addGitMasterRecord: ', error);
    }
}

// done
const removeGitMasterRecord = async( req, res) => {
    const grId = req.params.grId;

    try {
        gitMasterService.removeGitRecord(req,res,grId);

    } catch(error) {
        console.log('Error in removeGitMasterRecord: ', error);
    }
}


// done
const getGitMasterRecordById = async( req, res) => {
    console.log('getGitMasterRecordById');
    const grId = req.params.grId;

    try {
        gitMasterService.getGitRecordById(req,res, grId);

    } catch(error) {
        console.log('Error in getGitMasterRecordById: ', error);
    }
}


// done
const updateGitMasterRecord = async ( req, res) => {
    console.log('updateGitMasterRecord: ')
    try {
        gitMasterService.updateGitRecord(req,res);

    } catch(error) {
        console.log('Error in updateGitMasterRecord: ', error);
    }
}

module.exports = {
    getAllGitMasterRecords,
    addGitMasterRecord,
    removeGitMasterRecord,
    getGitMasterRecordById,
    updateGitMasterRecord
}