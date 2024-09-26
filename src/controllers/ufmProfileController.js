
const ufmProfileService = require("../services/ufmProfileService");


const getAllUfmProfileRecords = async (req, res) => {
    try {
        ufmProfileService.getAllUfmRecords(req,res);

    } catch(error) {
        console.log('Error in getAllUfmProfileRecords: ', error);
    }
}

const addUfmProfileRecord = async( req, res) => {
    try {
        ufmProfileService.addUfmRecord(req,res);

    } catch(error) {
        console.log('Error in addUfmProfileRecord: ', error);
    }
}

const removeUfmProfileRecord = async( req, res) => {
    const ufmProfileId = req.params.ufmProfileId;

    try {
        ufmProfileService.removeUfmRecord(req,res,ufmProfileId);

    } catch(error) {
        console.log('Error in removeUfmProfileRecord: ', error);
    }
}

const getUfmProfileById = async( req, res) => {
    console.log('getUfmProfileById');
    const ufmProfileId = req.params.ufmProfileId;

    try {
        ufmProfileService.getUfmRecordById(req,res, ufmProfileId);

    } catch(error) {
        console.log('Error in getUfmProfileById: ', error);
    }
}

const updateUfmProfileRecord = async ( req, res) => {
    console.log('updateUfmProfileRecord: ')
    try {
        ufmProfileService.updateUfmRecord(req,res);

    } catch(error) {
        console.log('Error in updateUfmProfileRecord: ', error);
    }
}

module.exports = {
    getAllUfmProfileRecords,
    addUfmProfileRecord,
    removeUfmProfileRecord,
    getUfmProfileById,
    updateUfmProfileRecord,
}