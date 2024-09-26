const UFMProfile = require("../models/ufmProfile");
const { ufmProfileColumns, gitMasterColumns } = require("../constants/tableColumns");
const Tenant = require("../models/tenant");
const GitRepository = require("../models/gitRepository");
const Taxonomy = require("../models/taxonomy");
const { sendResponse } = require("../util/responseSender");
const { HttpStatusCode } = require("axios");
const { responseObject } = require("../constants/responseTypes");
const UFMSyncHeader = require("../models/UFM/ufmSyncHeader");

const getAllUfmRecords = async (req, res) => {
    try{
    let response = await UFMProfile.findAll( {
        where: {
          is_deleted: false
        },
        attributes: ufmProfileColumns,
        include: [
        {
          model: Tenant,
          "as": "ufm_profile_primary_tenant",
          attributes: [
            "tenant_id",
            "tenant_name",
            "tenant_description",
          ]
        },
        {
          model: Tenant,
          "as": "ufm_profile_secondary_tenant",
          attributes: [
            "tenant_id",
            "tenant_name",
            "tenant_description",
          ]
        },
        {
          model: GitRepository,
          attributes:[
            "gr_id",
            "gr_owner_name",
            "gr_name",
            "gr_description",
          ]
        },
        {
          model:Taxonomy,
          as: "environment_id"
        },
        {
          model:Taxonomy,
          as: "tenant_state"
        },
        {
          model: UFMSyncHeader,
          where: {
            is_last_record: true,
            ufm_component_type_id: 11001
          },
          attributes: [
            ['created_on', 'last_sync_on']
          ],
          required: false
        }
      ],
      order: [['modified_on', 'DESC']]
    })

    if (!response) {
      return sendResponse(
        res, // response object
        false, // success
        HttpStatusCode.NotFound, // statusCode
        responseObject.RECORD_NOT_FOUND, // status type
        `No UFM profiles data to show`, // message
         {}
    );
        // return res.status(400).json({ message: "No Ufm Profile records to show"})
    }

    return sendResponse(
      res, // response object
      true, // success
      HttpStatusCode.Ok, // statusCode
      responseObject.RECORD_FOUND, // status type
      `A list of ufm profile records`, // message
       response
    );
    // return res.status(200).json({ data: response });
  } catch(error) {
    return sendResponse(
      res, // response object
      false, // success
      HttpStatusCode.InternalServerError, // statusCode
      responseObject.INTERNAL_SERVER_ERROR, // status type
      `In get all ufm records: ${error.message}`, // message
      {}
  );
  }
}

const getUfmRecordById = async (req, res, ufmProfileId) => {
    let response = await UFMProfile.findOne( {
        where: { 
          ufm_profile_id: ufmProfileId, 
          is_deleted: false 
        },
        attributes: ufmProfileColumns,
        include: [
          {
            model: Tenant,
            "as": "ufm_profile_primary_tenant",
            attributes: [
              "tenant_id",
              "tenant_name",
              "tenant_description",
            ]
          },
          {
            model: Tenant,
            "as": "ufm_profile_secondary_tenant",
            attributes: [
              "tenant_id",
              "tenant_name",
              "tenant_description",
            ]
          },
          {
            model: GitRepository,
            attributes: [
              "gr_id",
              "gr_owner_name",
              "gr_name",
              "gr_description",
            ]
          },
          {
            model:Taxonomy,
            as: "environment_id"
          },
          {
            model:Taxonomy,
            as: "tenant_state"
          }
        ]
    })

    if (!response) {
      return sendResponse(
        res, // response object
        false, // success
        HttpStatusCode.NotFound, // statusCode
        responseObject.RECORD_NOT_FOUND, // status type
        `Data not found for id: ${ufmProfileId}`, // message
         {}
    );
        // return res.status(400).json({ message: "No data for given UFM Profile id"})
    }
    return sendResponse(
      res, // response object
      true, // success
      HttpStatusCode.Ok, // statusCode
      responseObject.RECORD_FOUND, // status type
      `A list of ufm profile records`, // message
       response
    );
    // return res.status(200).json({ data: response});

}

const removeUfmRecord = async (req, res, ufmProfileId) => {
  try {
    const ufmProfileRecord = await UFMProfile.findByPk(ufmProfileId);
    if (!ufmProfileRecord) {
      return sendResponse(
        res, // response object
        false, // success
        HttpStatusCode.NotFound, // statusCode
        responseObject.RECORD_NOT_FOUND, // status type
        `Data not found for ufm profile id: ${ufmProfileId}`, // message
         {}
    );
    } 

    // not permanently deleting UFM Profile id from UFM Profile master table
    let softDeleteUFMRecord = await UFMProfile.update(
      {
        is_deleted: true
      },
      {
        where: {
          ufm_profile_id: ufmProfileRecord.ufm_profile_id
        }
      }
    );

    return sendResponse(
      res, // response object
      true, // success
      HttpStatusCode.Ok, // statusCode
      responseObject.RECORD_DELETE, // status type
      `Record ufm profile id: ${ufmProfileRecord.ufm_profile_id}, deleted`, // message
       {}
  );

    
  } catch(error) {
    console.log('Error in removing ufm record:', error);
    let errorMessage = '';

    // Check if the error is a Sequelize error
    if (error.name && error.name.startsWith('Sequelize')) {
        if (error.name === "SequelizeForeignKeyConstraintError") {
            errorMessage = 'UFM profile id used in other table(s)';
        } else if (error.name === "SequelizeUniqueConstraintError") {
            errorMessage = 'UFM profile id must be unique';
        } else {
            errorMessage = 'An unexpected Sequelize error occurred';
        }
    } else {
        errorMessage = error.message;
    }

    return sendResponse(
      res, // response object
      false, // success
      HttpStatusCode.InternalServerError, // statusCode
      responseObject.INTERNAL_SERVER_ERROR, // status type
      `For deleting ufm record id:${ufmProfileId}, ${errorMessage} `, // message
      {}
  );
  }
}

const addUfmRecord = async ( req, res) => {
    try {
        const { 
          ufm_profile_name,
          ufm_profile_environment_id,
          ufm_profile_primary_tenant_id, 
          ufm_profile_secondary_tenant_id,
          ufm_profile_gr_id,
          ufm_profile_tenant_state_id,
          ufm_profile_source_runtime,
          ufm_profile_destination_runtime,
          created_by,
          modified_by
        } = req.body;

        const ufmProfileRecord = await UFMProfile.create({ 
          ufm_profile_name,
          ufm_profile_environment_id,
          ufm_profile_primary_tenant_id, 
          ufm_profile_secondary_tenant_id,
          ufm_profile_source_runtime,
          ufm_profile_destination_runtime,
          ufm_profile_gr_id,
          ufm_profile_tenant_state_id,
          created_by,
          modified_by
        });
        res.status(201).json(ufmProfileRecord);
      } catch (error) {
        console.error('Error creating UFM Profile Record:', error);
        return sendResponse(
          res, // response object
          false, // success
          HttpStatusCode.InternalServerError, // statusCode
          responseObject.INTERNAL_SERVER_ERROR, // status type
          `Internal Server Error: in creating a ufm profile record.`, // message
          {}
      );
        // res.status(500).json({ error: 'Internal Server Error' });
      }
}

const updateUfmRecord = async (req, res) => {
    const { ufm_profile_id } = req.body;
    console.log('ufmProfileId: ', ufm_profile_id)
    try {
        const ufmProfileRecord = await UFMProfile.findByPk(ufm_profile_id);
        if (!ufmProfileRecord) {
          return sendResponse(
            res, // response object
            false, // success
            HttpStatusCode.NotFound, // statusCode
            responseObject.RECORD_NOT_FOUND, // status type
            `Data not found for ufm profile id: ${ufm_profile_id}`, // message
             {}
        );
          // res.status(404).json({ error: 'UFM Profile record not found...' });
        } else {
          const { 
            ufm_profile_id,
            ufm_profile_name,
            ufm_profile_environment_id,
            ufm_profile_primary_tenant_id, 
            ufm_profile_secondary_tenant_id,
            ufm_profile_source_runtime,
            ufm_profile_destination_runtime,
            ufm_profile_gr_id,
            ufm_profile_tenant_state_id,
            created_by,
            modified_by
          }= req.body;
          await ufmProfileRecord.update({ 
            ufm_profile_id,
            ufm_profile_name,
            ufm_profile_environment_id,
            ufm_profile_primary_tenant_id, 
            ufm_profile_secondary_tenant_id,
            ufm_profile_source_runtime,
            ufm_profile_destination_runtime,
            ufm_profile_gr_id,
            ufm_profile_tenant_state_id,
            created_by,
            modified_by
           });
          res.json(ufmProfileRecord);
        }
      } catch (error) {
        console.error('Error updating UFM Profile Record:', error);
        return sendResponse(
          res, // response object
          false, // success
          HttpStatusCode.InternalServerError, // statusCode
          responseObject.INTERNAL_SERVER_ERROR, // status type
          `Internal Server Error: in updating a ufm profile record.`, // message
          {}
      );
        // res.status(500).json({ error: 'Internal Server Error' });
      }

}

module.exports = {
    getAllUfmRecords,
    addUfmRecord,
    removeUfmRecord,
    getUfmRecordById,
    updateUfmRecord
}