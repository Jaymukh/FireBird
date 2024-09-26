const ufmFailoverConfigStateService  = require("../services/ufmFailoverConfigStateService");

const createFailoverConfigStateRecord = async (req, res) => {
    try {
        ufmFailoverConfigStateService.addFailoverConfigStateRecord(req,res)
    } catch(error) {
        console.log('Error in controller, createFailoverConfigStateRecord: ', error);
    }
}

// dont need this
const updateFailoverConfigStateRecord = async (req, res) => {
    try {
        ufmFailoverConfigStateService.modifyFailoverConfigStateRecord(req, res)
    } catch(error) {
        console.log('Error in controller, updateFailoverConfigStateRecord: ', error);
    }
}

// dont need this
const removeFailoverConfigStateRecord = async (req, res) => {
    const configStateId = req.params.configStateId;
    try {
        ufmFailoverConfigStateService.deleteFailoverConfigStateRecord(req,res, configStateId)
    } catch(error) {
        console.log('Error in controller, removeFailoverConfigStateRecord: ', error);
    }
}

const getFailoverConfigStateRecord = async(req, res) => {
    const ufmProfileId = req.params.ufmProfileId;
    try {
        ufmFailoverConfigStateService.getSingleFailoverConfigStateRecord(req, res, ufmProfileId)
    } catch(error) {
        console.log('Error in controller, getFailoverConfigStateRecord: ', error);
    }
}

const getAllFailoverConfigStateRecords = async(req, res) => {
    try {
        ufmFailoverConfigStateService.allFailoverConfigStateRecords(req,res)
    } catch(error) {
        console.log('Error in controller, getAllFailoverConfigStateRecords: ', error);
    }    
}

module.exports = {
    createFailoverConfigStateRecord,
    updateFailoverConfigStateRecord,
    removeFailoverConfigStateRecord,
    getFailoverConfigStateRecord,
    getAllFailoverConfigStateRecords
}