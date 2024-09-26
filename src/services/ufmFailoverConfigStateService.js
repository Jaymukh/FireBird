const { UFMFailoverConfigStateTableColumns, UFMFailoverConfigTableColumns } = require("../constants/tableColumns");
const UFMFailoverConfig = require("../models/UFM/ufmFailoverConfig_old");
const UFMFailoverConfigState = require("../models/UFM/ufmFailoverConfigState");
const  sequelize  = require("../dbconfig/config");
const { sendResponse } = require("../util/responseSender");
const { HttpStatusCode } = require("axios");
const { responseObject } = require("../constants/responseTypes");


const addFailoverConfigStateRecord = async (req, res) => {
    const { payload } = req.body;
    const transaction = await sequelize.transaction();

    try {
        const { ufmProfileId, configs } = payload;
       
        await UFMFailoverConfigState.update(
            { is_last_record: false },
            { where: { ufm_profile_id: ufmProfileId, is_last_record: true }, transaction }
          );

          const newConfigState = await UFMFailoverConfigState.create({
            ufm_profile_id:ufmProfileId,
            short_comment: payload.short_comment,
            is_last_record: true,
            created_by: payload.created_by, // Replace with actual user ID from payload or context
            config_state_saved_on: Math.floor(Date.now() / 1000)
          }, { transaction });

          console.log('newConfigState:',newConfigState)
          
        // Step 3: Insert associated UFMFailoverConfig records
        const newConfigs = configs.map(config => ({
            ...config,
            config_state_id: newConfigState.config_state_id,
            config_timestamp: Math.floor(Date.now() / 1000),
            // config_component_created_by: 1, // Replace with actual user ID from payload or context
            config_component_created_on: Math.floor(Date.now() / 1000),
            config_component_modified_on: Math.floor(Date.now() / 1000)
        }));
        console.log('newConfigs: ', newConfigs);
    
        await UFMFailoverConfig.bulkCreate(newConfigs, { transaction });
    
        await transaction.commit();
        // console.log('Transaction: ', transaction);

        return sendResponse(
            res, // response object
            true, // success
            HttpStatusCode.Ok, // statusCode
            responseObject.RECORD_CREATE, // status type
            `Config setting saved successfully`, // message
            {} // data
          );

        // return res.status(200).json({message: "Config setting saved successfully."})

    }catch(error) {
        await transaction.rollback();
        console.error('Error creating UFMFailoverConfigState and UFMFailoverConfig instances:', error);
        return sendResponse(
            res, // response object
            false, // success
            HttpStatusCode.InternalServerError, // statusCode
            responseObject.INTERNAL_SERVER_ERROR, // status type
            `Internal Server Error: in creating a ufm_failover_config record.`, // message
            {}
        );
        // return res.status(500).json({message: "Config setting saved successfully."})
    }

}

const modifyFailoverConfigStateRecord = (req, res) => {
    return res.status(200).json({message: "Not created this api for now: from modifyFailoverConfigStateRecord"});

}

const deleteFailoverConfigStateRecord = async (req, res, configStateId) => {

    try{
        const response = await UFMFailoverConfigState.findByPk(configStateId);
        if (!response) {
            return sendResponse(
                res, // response object
                false, // success
                HttpStatusCode.NotFound, // statusCode
                responseObject.RECORD_NOT_FOUND, // status type
                `Data not found for config state id: ${configStateId}`, // message
                 {}
            );
        //   res.status(404).json({ error: 'configStateId not found for deletion' });
        } else {
          await response.destroy();
        //   res.status(204).end();
        return sendResponse(
            res, // response object
            true, // success
            HttpStatusCode.Ok, // statusCode 200
            responseObject.RECORD_DELETE, // status type
            `Record deleted for config state id: ${response.config_state_id}`, // message
             {}
        );
        // return res.status(204).json({message: "Record deleted successfully."})
        }
    } catch(error) {
        return sendResponse(
            res, // response object
            false, // success
            HttpStatusCode.InternalServerError, // statusCode
            responseObject.INTERNAL_SERVER_ERROR, // status type
            `Internal Server Error: in deleting a ufm_failover_config record.`, // message
            {}
        );
    }

}

const allFailoverConfigStateRecords = async (req, res) => {
    try {
        let response = await UFMFailoverConfigState.findAll({
            where: {
                is_last_record: true
            },
            attributes: UFMFailoverConfigStateTableColumns,
            include: [
                {
                    model: UFMFailoverConfig,
                    attributes: UFMFailoverConfigTableColumns
                }
            ]
        });
        if (!response) {
            return sendResponse(
                res, // response object
                false, // success
                HttpStatusCode.NotFound, // statusCode
                responseObject.RECORD_NOT_FOUND, // status type
                `No record for failover config state for ufm profile id: ${ufmProfileId}`, // message
                 {}
            );
            // return res.status(200).json({ message: "No records for failover config state"})
        }
        
        return sendResponse(
            res, // response object
            true, // success
            HttpStatusCode.Ok, // statusCode
            responseObject.RECORD_FOUND, // status type
            `A list of all config state records`, // message
             response
          );
        // return res.status(200).json({data: response});

    } catch(error) {
        return sendResponse(
            res, // response object
            false, // success
            HttpStatusCode.InternalServerError, // statusCode
            responseObject.INTERNAL_SERVER_ERROR, // status type
            `Internal Server Error: in creating a ufm_failover_config record.`, // message
            {}
        );
        // console.log('Error in service function: AllFailoverConfigStateRecords: ', error);
    }

}

const getSingleFailoverConfigStateRecord = async (req, res,ufmProfileId) => {
    try {
        let response = await UFMFailoverConfigState.findOne({
            where: {
                ufm_profile_id: ufmProfileId, 
                is_last_record: true
            },
            attributes: UFMFailoverConfigStateTableColumns,
            include: [
            {
                model: UFMFailoverConfig,
                attributes: UFMFailoverConfigTableColumns
            }
        ]
        });
        if (!response) {
            return sendResponse(
                res, // response object
                false, // success
                HttpStatusCode.NotFound, // statusCode
                responseObject.RECORD_NOT_FOUND, // status type
                `No record for failover config state for ufm profile id: ${ufmProfileId}`, // message
                 {}
            );
            // return res.status(200).json({ message: "No record for failover config state Id"})
        }
        
        return sendResponse(
            res, // response object
            true, // success
            HttpStatusCode.Ok, // statusCode
            responseObject.RECORD_FOUND, // status type
            `A record of ufm_failover_config`, // message
             response
          );

        // return res.status(200).json({data: response});

    } catch(error) {
        console.log('Error in service function: getSingleFailoverConfigStateRecord: ', error);
        return sendResponse(
            res, // response object
            false, // success
            HttpStatusCode.InternalServerError, // statusCode
            responseObject.INTERNAL_SERVER_ERROR, // status type
            `Internal Server Error: in getting a ufm_failover_config record.`, // message
            {}
        );
    }

}

module.exports = {
    addFailoverConfigStateRecord,
    modifyFailoverConfigStateRecord,
    deleteFailoverConfigStateRecord,
    allFailoverConfigStateRecords,
    getSingleFailoverConfigStateRecord
}
