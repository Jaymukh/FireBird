const { taxonomyTableColumns } = require("../constants/tableColumns");
const Taxonomy = require("../models/taxonomy");


// This is a plane list
const getAllTaxonomyList = async (req, res) => {
    console.log('Table List');
    let response = await Taxonomy.findAll({
        where: {},
        attributes: taxonomyTableColumns
    });
    
    if (!response) {
        return res.status(404).json({ message: "Records not found for taxonomy"})
    }

    return res.status(200).json({data: response })

}

// create data -> and check the result
const getAllTaxonomyGroupRecords = async ( req, res) => {
    
    const groupObjectsByGroupName = (objects) => {
        const groupedData = {};
    
        objects.forEach(obj => {
            if (!groupedData[obj.group_name]) {
                groupedData[obj.group_name] = [];
            }
            groupedData[obj.group_name].push(obj);
        });
    
        return groupedData;
    };

    
    try {
        const response = await Taxonomy.findAll(); // Assuming you are using Sequelize
        const groupedData = groupObjectsByGroupName(response);
        return res.status(200).json( { data: groupedData })
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

const getTaxonomyListByCode = async ( req, res, codeRequestList ) => {
    
    try {
        const response = await Taxonomy.findAll({
            where: {
                taxonomy_code : codeRequestList
            }
        }); 
        
        return res.status(200).json({ data: response });

    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}


const getTaxonomyListByType = async ( req, res, typeRequestList ) => {
    
    const groupObjectsByTypeName = (objects) => {
        const groupedData = {};
    
        objects.forEach(obj => {
            if (!groupedData[obj.taxonomy_type]) {
                groupedData[obj.taxonomy_type] = [];
            }
            groupedData[obj.taxonomy_type].push(obj);
        });
    
        return groupedData;
    };

    
    try {
        const response = await Taxonomy.findAll(); // Assuming you are using Sequelize
        const groupedData = groupObjectsByTypeName(response);
        return res.status(200).json( { data: groupedData })
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

module.exports = {
    getAllTaxonomyList,
    getTaxonomyListByCode,
    getAllTaxonomyGroupRecords,
    getTaxonomyListByType
}