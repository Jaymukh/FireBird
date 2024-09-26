const UserModel = require("../models/userModel");
const { userMasterColumns } = require("../constants/tableColumns");
const { sendResponse } = require("../util/responseSender");
const { HttpStatusCode } = require("axios");
const { responseObject } = require("../constants/responseTypes");
const Taxonomy = require("../models/taxonomy");

const getAllUserRecords = async (req, res) => {

    let response = await UserModel.findAll( {
        where: {},
        attributes: userMasterColumns,
        include: [
          {
            model: Taxonomy,
            as: "timezone",
            attributes: [
              "taxonomy_id",
              "taxonomy_code",
              "taxonomy_name",
              "taxonomy_value",
              "taxonomy_type"
            ]
          }
        ],
        order: [['last_logged_on', 'DESC']]
    })

    if (!response) {
      return sendResponse(
        res, // response object
        false, // success
        HttpStatusCode.NotFound, // statusCode
        responseObject.RECORD_NOT_FOUND, // status type
        `No User Master data to show`, // message
         {}
    );
        // return res.status(400).json({ message: "No User Records to show"})
    }
    return sendResponse(
      res, // response object
      true, // success
      HttpStatusCode.Ok, // statusCode
      responseObject.RECORD_FOUND, // status type
      `A list of user master records`, // message
       response
    );
    // return res.status(200).json({ data: response });
}

// done
const getUserRecordByUserId = async (req, res, userId) => {
    console.log('User Record By User Id');
    let response = await UserModel.findOne( {
        where: { userId: userId },
        attributes: userMasterColumns,
        include: [
          {
            model: Taxonomy,
            as: "timezone",
            attributes: [
              "taxonomy_id",
              "taxonomy_code",
              "taxonomy_name",
              "taxonomy_value",
              "taxonomy_type"
            ]
          }
        ]
    })

    if ( !response) {
      return sendResponse(
        res, // response object
        false, // success
        HttpStatusCode.NotFound, // statusCode
        responseObject.RECORD_NOT_FOUND, // status type
        `No User data to show for id: ${userId}`, // message
         {}
    );
        // return res.status(400).json({ message: "No data for given userId"})
    }
    return sendResponse(
      res, // response object
      true, // success
      HttpStatusCode.Ok, // statusCode
      responseObject.RECORD_FOUND, // status type
      `User Master record for id :${userId}`, // message
       response
    );
    // return res.status(200).json({ data: response});
  
}

const getUserRecordById = async (req, res, id) => {
    let response = await UserModel.findOne( {
        where: { user_id: id },
        attributes: userMasterColumns,
        include: [
          {
            model: Taxonomy,
            as: "timezone",
            attributes: [
              "taxonomy_id",
              "taxonomy_code",
              "taxonomy_name",
              "taxonomy_value",
              "taxonomy_type"
            ]
          }
        ]
    })

    if (!response) {
      return sendResponse(
        res, // response object
        false, // success
        HttpStatusCode.NotFound, // statusCode
        responseObject.RECORD_NOT_FOUND, // status type
        `No User Master data to show for user id: ${id}`, // message
         {}
    );
        // return res.status(400).json({ message: "No data for given id"})
    }

    return sendResponse(
      res, // response object
      true, // success
      HttpStatusCode.Ok, // statusCode
      responseObject.RECORD_FOUND, // status type
      `User Master record for id :${id}`, // message
       response
    );
    // return res.status(200).json({ data: response});

}

const removeUserRecord = async (req, res, id) => {
    const userRecord = await UserModel.findByPk(id);
    if (!userRecord) {
      return sendResponse(
        res, // response object
        false, // success
        HttpStatusCode.NotFound, // statusCode
        responseObject.RECORD_NOT_FOUND, // status type
        `No User Master data to show for user id: ${id}`, // message
         {}
    );
      // res.status(404).json({ error: 'User Record not found' });
    } else {
      await userRecord.destroy();
      // res.status(204).end();
      return sendResponse(
        res, // response object
        true, // success
        HttpStatusCode.Ok, // statusCode 204
        responseObject.RECORD_DELETE, // status type
        `Record deleted for user id: ${userRecord.user_id}`, // message
         {}
    );
      // return res.status(204).json({message: "Record deleted successfully."})
    }
}

const addUserRecord = async ( req, res) => {
    try {

        const { 
          email_id,
          first_name,
          last_name,
          display_name,
          external_id, // EX234
          additional_param1,
          created_by,
          modified_by,
          is_active,
          is_admin,
          role,
          timezone_id
        } = req.body;

        // check if the external id exists, then dont add user, instead return "user exists"
        let userResponse = await UserModel.findOne({
          where: {
            external_id: external_id
          }
        })

        if(userResponse) {
          const updateUserForLastLoggedIn = await UserModel.update( 
          {
            last_logged_on:  Math.floor(Date.now() / 1000)
          }, 
          { where: {
            external_id: external_id
          }
          });
          
          let user = await UserModel.findOne({
            where: {
              external_id: external_id
            }
          })
          return res.status(200).json(user)
        }

        const userRecord = await UserModel.create({ 
        
          email_id,
          first_name,
          last_name,
          display_name,
          external_id,
          additional_param1,
          created_by,
          modified_by,
          is_active,
          is_admin,
          last_logged_on:  Math.floor(Date.now() / 1000),
          role,
          timezone_id
        });
        res.status(201).json(userRecord);
      } catch (error) {
        console.error('Error creating user Record:', error);
        return sendResponse(
          res, // response object
          false, // success
          HttpStatusCode.InternalServerError, // statusCode
          responseObject.INTERNAL_SERVER_ERROR, // status type
          `Internal Server Error: in creating a user record.`, // message
          {}
      );
        // res.status(500).json({ error: 'Internal Server Error' });
      }
}

// deprecated, as of now
const updateUserRecord = async (req, res) => {
    const { user_id } = req.body;
    console.log('ID: ', user_id)
    try {
        const userRecord = await UserModel.findByPk(user_id);
        if (!userRecord) {
          res.status(404).json({ error: 'User Record not found...' });
        } else {
          const {    
          email_id,
          first_name,
          last_name,
          display_name,
          external_id,
          additional_param1,
          created_by,
          modified_by,
          is_active,
          timezone_id }= req.body;
          await userRecord.update({    
            email_id,
          first_name,
          last_name,
          display_name,
          external_id,
          additional_param1,
          created_by,
          modified_by,
          is_active,
          timezone_id
        });
          res.json(userRecord);
        }
      } catch (error) {
        console.error('Error updating user Record:', error);
        return sendResponse(
          res, // response object
          false, // success
          HttpStatusCode.InternalServerError, // statusCode
          responseObject.INTERNAL_SERVER_ERROR, // status type
          `Internal Server Error: in updating a user record.`, // message
          {}
      );
        // res.status(500).json({ error: 'Internal Server Error' });
      }

}

module.exports = {
    getAllUserRecords,
    getUserRecordByUserId,
    getUserRecordById,
    removeUserRecord,
    addUserRecord,
    updateUserRecord
}