const Tenant = require("../models/tenant");

function getModel(modelName) {

    switch (modelName) {
        case 'tenant':
        case 'TENANT':
        case 'Tenant': return Tenant;
        default: throw new Error(`Model ${modelName} is not recognized.`);
    }
}

async function findOneRecord(modelName,
    whereCondition,
    tableFields = [],
    includeModels = [],
    transaction = null
) {
    let Model = getModel(modelName)
    try {
        return await Model.findOne({
            where: whereCondition,
            attributes: tableFields,
            include: includeModels,
            transaction: transaction || undefined
        });
    } catch (error) {
        console.error(`Error finding a record for model ${Model.name} (findOneRecord):`, error);
        throw error; // Re-throw the error to handle it upstream
    }
}




module.exports = {
    findOneRecord,
};
