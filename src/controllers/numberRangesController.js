const  numberRangesService= require("../services/numberRangesService");
const getAllNumberRangesFromTenants = async ( req, res ) => {
    try {
       await numberRangesService.getAllNumberRanges(req,res);
    } catch(error) {
        console.log('Error in controller: getAllNumberRangesFromTenants: ', error);
    }
}

const copyNumberRangesForTenants = async (req, res) => {
    try {
        await numberRangesService.copyNumberRanges(req,res);
     } catch(error) {
         console.log('Error in controller: copyNumberRangesForTenants: ', error);
     }
}

module.exports = {
    getAllNumberRangesFromTenants,
    copyNumberRangesForTenants
}