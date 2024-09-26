const ufmProfileRuntimeService = require("../services/ufmProfileRuntimeMapService")
const getAllUfmProfileRuntimeMapRecords = (req,res) => {
    try{
        ufmProfileRuntimeService.getAllUfmRuntimeMapRecords(req,res)
     
    } catch(error) {
        console.log('Error in controller -> getAllUfmProfileRuntimeMapRecords: ', error)
    }
}

const addUfmProfileRuntimeMapRecord = (req, res) => {
    try{
        ufmProfileRuntimeService.addUfmRuntimeMapRecord(req,res)
      
    } catch(error) {
        console.log('Error in controller -> addUfmProfileRuntimeMapRecord: ', error)
    }
}

const removeUfmProfileRuntimeMapRecord = (req, res) => {
    const ufmProfileRuntimeMapId = req.params.ufmProfileRuntimeMapId;
    try{
        ufmProfileRuntimeService.removeUfmRuntimeMapRecord(req, res, ufmProfileRuntimeMapId)
       
    } catch(error) {
        console.log('Error in controller -> removeUfmProfileRuntimeMapRecord: ', error)
    }
}
const getUfmProfileRuntimeMapByUfmProfileId = ( req, res) => {
    try{
        ufmProfileRuntimeService.getUfmRuntimeMapRecordByUfmProfileId(req,res)
    } catch(error) {
        console.log('Error in controller -> getUfmProfileRuntimeMapById: ', error)
    }
}
const updateUfmProfileRuntimeMapRecord = (req, res) => {
    try{
        ufmProfileRuntimeService.updateUfmRuntimeMapRecord(req,res)
    } catch(error) {
        console.log('Error in controller -> updateUfmProfileRuntimeMapRecord: ', error)
    }
}

module.exports = {
    getAllUfmProfileRuntimeMapRecords,
    addUfmProfileRuntimeMapRecord,
    removeUfmProfileRuntimeMapRecord,
    getUfmProfileRuntimeMapByUfmProfileId,
    updateUfmProfileRuntimeMapRecord
}