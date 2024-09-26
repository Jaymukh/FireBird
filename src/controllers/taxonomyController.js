const taxonomyService = require("../services/taxonomyService");

const getAllTaxonomyRecords = ( req, res) => {
    try {
        taxonomyService.getAllTaxonomyList(req, res);        

    } catch(error) {
        console.log('Error in function getAllTaxonomyRecords: ', error)
    }

}

const getAllTaxonomyGroupWiseRecords = (req, res) => {
    try {
        taxonomyService.getAllTaxonomyGroupRecords(req, res);        

    } catch(error) {
        console.log('Error in function getAllTaxonomyRecords: ', error)
    }
}


const getTaxonomyRecordsByCode = (req, res) => {
    const { codeRequestList } = req.body;

    try {
        taxonomyService.getTaxonomyListByCode(req, res, codeRequestList);        

    } catch(error) {
        console.log('Error in function getAllTaxonomyRecords: ', error)
    }
}

const getTaxonomyRecordsByType = (req, res) => {
    const { typeRequestList } = req.body;
    try {
        taxonomyService.getTaxonomyListByType(req, res, typeRequestList);        

    } catch(error) {
        console.log('Error in function getAllTaxonomyRecords: ', error)
    }
}

module.exports = {
    getAllTaxonomyRecords,
    getAllTaxonomyGroupWiseRecords,
    getTaxonomyRecordsByCode,
    getTaxonomyRecordsByType
}