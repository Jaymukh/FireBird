const GitRepository = require("../models/gitRepository");
const { gitMasterColumns } = require("../constants/tableColumns");
const { encryptData, decryptData, getEncryptionIV } = require("../util/decode");
const _ = require("lodash");
const Taxonomy = require("../models/taxonomy");
const { sendResponse } = require("../util/responseSender");
const { HttpStatusCode } = require("axios");
const { responseObject } = require("../constants/responseTypes");
const UFMProfile = require("../models/ufmProfile");

const getAllGitRecords = async (req, res) => {
    try {
      let response = await GitRepository.findAll( {
          where: {
            is_deleted: false
          },
          attributes: _.without(gitMasterColumns, 'gr_client_secret', 'gr_iv_salt'),
          include: [
          {
            model: Taxonomy,
            as : "git_environment"
          },
          {
            model: Taxonomy,
            as: "git_state"
          }
        ],
        order:[['modified_on', 'DESC']]
      })

      if (!response) {
        return sendResponse(
          res, // response object
          false, // success
          HttpStatusCode.NotFound, // statusCode
          responseObject.RECORD_NOT_FOUND, // status type
          `No git records to show`, // message
          {}
      );
          // return res.status(400).json({ message: "No Git Records to show"})
      }

      return sendResponse(
        res, // response object
        true, // success
        HttpStatusCode.Ok, // statusCode
        responseObject.RECORD_FOUND, // status type
        `A list of git records`, // message
        response
    );
      // return res.status(200).json({ data: response});
    } catch(error) {
    return sendResponse(
      res, // response object
      false, // success
      HttpStatusCode.InternalServerError, // statusCode
      responseObject.INTERNAL_SERVER_ERROR, // status type
      `In get all git records: ${error.message}`, // message
      {}
  );
  }
}


const getGitRecordById = async (req, res, grId) => {
    let response = await GitRepository.findOne( {
        where: { 
          gr_id: grId,
          is_deleted: false
        },
        attributes: gitMasterColumns,
        include: [
          {
            model: Taxonomy,
            as : "git_environment"
          },
          {
            model: Taxonomy,
            as: "git_state"
          }
        ]
    })

    if (!response) {
      return sendResponse(
        res, // response object
        false, // success
        HttpStatusCode.NotFound, // statusCode
        responseObject.RECORD_NOT_FOUND, // status type
        `Data not found for id: ${grId}`, // message
         {}
    );
        // return res.status(400).json({ message: "No data for given gr_id"})
    }
    response.gr_client_secret = decryptData( response.gr_client_secret, getEncryptionIV(response.gr_iv_salt));
    return sendResponse(
      res, // response object
      true, // success
      HttpStatusCode.Ok, // statusCode
      responseObject.RECORD_FOUND, // status type
      `Information of git record for id: ${response.gr_id}`, // message
       response
  );
    // return res.status(200).json({ data: response});

}

const removeGitRecord = async (req, res, grId) => {
  let gitRecord ;
  try {
     gitRecord = await GitRepository.findByPk(grId);
    if (!gitRecord) {
      // res.status(404).json({ error: 'Git Record not found' });
      return sendResponse(
        res, // response object
        false, // success
        HttpStatusCode.NotFound, // statusCode
        responseObject.RECORD_NOT_FOUND, // status type
        `Data not found for id: ${grId}`, // message
         {}
    );

    } else {

         // first find in UFM profile table whether any record has the tenant id which is to be deleted
         let findGitRecordInUFMProfile = await UFMProfile.findOne({
            where: {
              ufm_profile_gr_id: gitRecord.gr_id
          }
        })
  
        if (findGitRecordInUFMProfile) {
          return sendResponse(
          res, // response object
          false, // success
          HttpStatusCode.InternalServerError, // statusCode
          responseObject.RECORD_IN_USE, // status type
          `Git repository: ${gitRecord.gr_name} record already exists in UFM Profile. Cannot Delete`, // message
          {}
          )
        }
          // not permanently deleting UFM Profile id from UFM Profile master table
        let softDeleteGitRecord = await GitRepository.update(
          {
            is_deleted: true
          },
          {
            where: {
              gr_id: gitRecord.gr_id
            }
          }
        );
    
        return sendResponse(
          res, // response object
          true, // success
          HttpStatusCode.Ok, // statusCode
          responseObject.RECORD_DELETE, // status type
          `Record of ${gitRecord.gr_name} for Git id: ${gitRecord.gr_id}, deleted`, // message
           {}
      );
    //   await gitRecord.destroy();
    //   // res.status(204).end();
    //   return sendResponse(
    //     res, // response object
    //     true, // success
    //     HttpStatusCode.Ok, // statusCode 204
    //     responseObject.RECORD_DELETE, // status type
    //     `Record deleted of respository: ${gitRecord.gr_name}`, // message
    //      {}
    // );
      // return res.status(204).json({message: "Record deleted successfully."})
    }
  } catch (error) {
    console.log('\nError in deleting git record', error);
    let errorMessage = '';

    // Check if the error is a Sequelize error
    if (error.name && error.name.startsWith('Sequelize')) {
        if (error.name === "SequelizeForeignKeyConstraintError") {
            errorMessage = 'Git repository in use already in other table(s)';
        } else if (error.name === "SequelizeUniqueConstraintError") {
            errorMessage = 'git id must be unique';
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
      `For deleting git repository:${gitRecord.gr_name}. ${errorMessage} `, // message
      {}
  );
  }
}

const addGitRecord = async ( req, res) => {
    try {
        let { 
          gr_name,
          gr_owner_name,
          gr_description,
          gr_environment_id,
          gr_host_url,
          gr_auth_method_id,
          gr_api_token,
          gr_client_secret,
          gr_client_id,
          gr_iv_salt,
          gr_state_id,
          created_by,
          modified_by
        } = req.body;

        if (!gr_iv_salt){
          console.log('\nIV salt not found for git repository');
          return sendResponse(
            res, // response object
            false, // success
            HttpStatusCode.BadRequest, // statusCode
            responseObject.PARAMETER_MISSING, // status type
            `IV salt for the not received for git repository`, // message
             {}
        );
    
          // return res.status(400).json({ message: "Not found git repo IV salt"})
        }

        let encryptedClientSecret = encryptData(gr_client_secret, getEncryptionIV(gr_iv_salt));

        const gitRecord = await GitRepository.create({ 
          gr_name,
          gr_owner_name,
          gr_description,
          gr_environment_id,
          gr_host_url,
          gr_auth_method_id,
          gr_api_token,
          gr_client_secret: encryptedClientSecret,
          gr_client_id,
          gr_iv_salt,
          gr_state_id,
          created_by,
          modified_by
        });
        res.status(201).json(gitRecord); // in order to change it, need to consult
      } catch (error) {
        // console.error('Error creating git Record:', error);
        return sendResponse(
          res, // response object
          false, // success
          HttpStatusCode.InternalServerError, // statusCode
          responseObject.INTERNAL_SERVER_ERROR, // status type
          `Internal Server Error: in creating a git record.`, // message
          {}
      );
        // res.status(500).json({ error: 'Internal Server Error' });
      }
}

const updateGitRecord = async (req, res) => {
    const { gr_id } = req.body;
    console.log('gr_id: ', gr_id)
    try {
        const gitRecord = await GitRepository.findByPk(gr_id);
        if (!gitRecord) {
          return sendResponse(
            res, // response object
            false, // success
            HttpStatusCode.NotFound, // statusCode
            responseObject.RECORD_NOT_FOUND, // status type
            `No git record for id: ${gr_id}`, // message
            {}
        );

      } else {
          let {        
            gr_name,
            gr_owner_name,
            gr_description,
            gr_environment_id,
            gr_host_url,
            gr_auth_method_id,
            gr_api_token,
            gr_client_secret,
            gr_client_id,
            gr_iv_salt,
            gr_state_id,
            created_by,
            modified_by 
          } = req.body;

          let encryptedGrClientSecret;
          if (!gr_client_secret || gr_client_secret === null) {
            encryptedGrClientSecret = gitRecord.gr_client_secret;
          } else {
            encryptedGrClientSecret = encryptData (gr_client_secret, getEncryptionIV(gr_iv_salt));
          }
         
          await gitRecord.update({ 
            gr_name,
            gr_owner_name,
            gr_description,
            gr_environment_id,
            gr_host_url,
            gr_auth_method_id,
            gr_api_token,
            gr_client_secret: encryptedGrClientSecret,
            gr_client_id,
            gr_iv_salt,
            gr_state_id,
            created_by,
            modified_by
           });
          res.json(gitRecord);
        }
      } catch (error) {
        // console.error('Error updating git Record:', error);
        return sendResponse(
          res, // response object
          false, // success
          HttpStatusCode.InternalServerError, // statusCode
          responseObject.INTERNAL_SERVER_ERROR, // status type
          `Internal Server Error: in updating a git record.`, // message
          {}
      );

    }

}

module.exports = {
    getAllGitRecords,
    getGitRecordById,
    removeGitRecord,
    addGitRecord,
    updateGitRecord
}