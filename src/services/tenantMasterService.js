const Tenant = require("../models/tenant");
const {tenantTableColumns} = require("../constants/tableColumns");
const { encryptData, decryptData, getEncryptionIV } = require("../util/decode");
const _ = require("lodash");
const Taxonomy = require("../models/taxonomy");
const { sendResponse } = require("../util/responseSender");
const { HttpStatusCode } = require("axios");
const { responseObject } = require("../constants/responseTypes");
const UserModel = require("../models/userModel");
const UFMProfile = require("../models/ufmProfile");
const { Op } = require('sequelize');
const TenantPackageArtifactInfo = require("../models/Tenant/tenantPacakgeArtifactInfo");
const { checkValidTenant } = require("../cron/gatherPackageArtifactInfoForTenant");

const getAllTenants = async (req, res) => {
  try {
    let response = await Tenant.findAll( {
        where: {
          is_deleted: false
        },
        attributes: _.without(tenantTableColumns, 'tenant_iv_salt', 'tenant_host_password'),
        include: [
          {
            model: Taxonomy,
            as: "tenant_environment"
          },
          {
            model: Taxonomy,
            as: "tenant_state"
          },
          {
            model: Taxonomy,
            as: "region_id"
          },
          {
            model: Taxonomy,
            as: "test_status"
          },
          {
            model: UserModel,
            as: "created_by_user",
            attributes: [
              "user_id",
              "email_id",
              "external_id",
              "first_name",
              "last_name",
              "display_name"
            ]
          },
          {
            model: UserModel,
            as: "modified_by_user",
            attributes: [
              "user_id",
              "email_id",
              "external_id",
              "first_name",
              "last_name",
              "display_name"
            ]
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
         `No tenant data to show`, // message,
        {}
    )
        // return res.status(400).json({ message: "No Tenants to show"})
    }

    return sendResponse(
      res, // response object
      true, // success
      HttpStatusCode.Ok, // statusCode
      responseObject.RECORD_FOUND, // status type
      `A list of tenant records`, // message
       response
    );
    // return res.status(200).json({ data: response});
  } catch(error) {
    return sendResponse(
      res, // response object
      false, // success
      HttpStatusCode.InternalServerError, // statusCode
      responseObject.INTERNAL_SERVER_ERROR, // status type
      `In get all tenant records: ${error.message}`, // message
      {}
  );
  }
}


const getTenantById = async (req, res, tenantId) => {
    let response = await Tenant.findOne( {
        where: { 
          tenant_id: tenantId,
          is_deleted: false
        },
        attributes: tenantTableColumns,
        include: [
          {
            model: Taxonomy,
            as: "tenant_environment"
          },
          {
            model: Taxonomy,
            as: "tenant_state"
          },
          {
            model: Taxonomy,
            as: "region_id"
          },
          {
            model: Taxonomy,
            as: "test_status"
          },
          {
            model: UserModel,
            as: "created_by_user",
            attributes: [
              "user_id",
              "email_id",
              "external_id",
              "first_name",
              "last_name",
              "display_name"
            ]
          },
          {
            model: UserModel,
            as: "modified_by_user",
            attributes: [
              "user_id",
              "email_id",
              "external_id",
              "first_name",
              "last_name",
              "display_name"
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
         `No tenant data to show`, // message,
        {}
    )
        // return res.status(400).json({ message: "No data for given id"})
    }
    // Decrypt the tenant_host_password
    response.tenant_host_password = decryptData( response.tenant_host_password, getEncryptionIV(response.tenant_iv_salt));
    response.tenant_util_client_secret = decryptData (response.tenant_util_client_secret, getEncryptionIV(response.tenant_util_iv_salt ))
    return sendResponse(
      res, // response object
      true, // success
      HttpStatusCode.Ok, // statusCode
      responseObject.RECORD_FOUND, // status type
      `A list of tenant record for id: ${tenantId}`, // message
       response
    );
    // return res.status(200).json({ data: response });

}

const removeTenant = async (req, res, tenantId) => {
  let tenant;
  try {
     tenant = await Tenant.findByPk(tenantId);
    if (!tenant) {
      return sendResponse(
        res, // response object
        false, // success
        HttpStatusCode.NotFound, // statusCode
        responseObject.RECORD_NOT_FOUND, // status type
        `Data not found for id: ${tenantId}`, // message
         {}
    );
      // res.status(404).json({ error: 'Tenant not found' });
    } else {

      // first find in UFM profile table whether any record has the tenant id which is to be deleted
      let findTenantRecordInUFMProfile = await UFMProfile.findOne({
        where: {
          [Op.or]: [
              { ufm_profile_primary_tenant_id: tenant.tenant_id },
              { ufm_profile_secondary_tenant_id: tenant.tenant_id }
          ]
      }
      })

      if (findTenantRecordInUFMProfile) {
        return sendResponse(
        res, // response object
        false, // success
        HttpStatusCode.InternalServerError, // statusCode
        responseObject.RECORD_IN_USE, // status type
        `Tenant : ${tenant.tenant_name} record already exists in UFM Profile. Cannot Delete`, // message
        {}
        )
      }
        // not permanently deleting UFM Profile id from UFM Profile master table
      let softDeleteTenantRecord = await Tenant.update(
        {
          is_deleted: true
        },
        {
          where: {
            tenant_id: tenant.tenant_id
          }
        }
      );
  
      return sendResponse(
        res, // response object
        true, // success
        HttpStatusCode.Ok, // statusCode 
        responseObject.RECORD_DELETE, // status type
        `Record of ${tenant.tenant_name} for Tenant id: ${tenant.tenant_id}, deleted`, // message
         {}
    );
  
    //   await tenant.destroy();
    //   // res.status(204).end();
    //   return sendResponse(
    //     res, // response object
    //     true, // success
    //     HttpStatusCode.Ok, // statusCode 200
    //     responseObject.RECORD_DELETE, // status type
    //     `Record deleted of tenant: ${tenant.tenant_id}`, // message
    //      {}
    // );
      // return res.status(204).json({message: "Record deleted successfully."})
    }
  } catch(error) {
    console.error('Error for deleting tenant record', error);
    let errorMessage = '';

    // Check if the error is a Sequelize error
    if (error.name && error.name.startsWith('Sequelize')) {
        if (error.name === "SequelizeForeignKeyConstraintError") {
            errorMessage = 'Tenant id in use already in other table(s)';
        } else if (error.name === "SequelizeUniqueConstraintError") {
            errorMessage = 'Tenant id must be unique';
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
      `For deleting tenant :${tenant.tenant_name}. ${errorMessage} `, // message
      {}
  );
  }
    
}

const addTenant = async ( req, res) => {
    try {
        let { 
          tenant_name,
          tenant_description,
          tenant_region_id,
          tenant_host_url,
          tenant_host_token_api,
          tenant_iflow_host_url,
          tenant_host_username,
          tenant_host_password,
          tenant_iv_salt,
          tenant_host_test_status_id,
          tenant_host_test_status_on,
          tenant_util_host_url,
          tenant_util_token_url,
          tenant_util_client_id,
          tenant_util_client_secret,
          tenant_util_iv_salt,
          tenant_environment_id,
          tenant_state_id,
          created_by,
          modified_by,
         } = req.body;

         // not using tenant_iv_salt for now, instead using it from our .env
         // later on, use tenant_iv_salt
         let encryptedTenantHostPassword = encryptData (tenant_host_password, getEncryptionIV(tenant_iv_salt));
         let encryptedTenantUtilClientSecret = encryptData (tenant_util_client_secret, getEncryptionIV(tenant_util_iv_salt))
        const tenant = await Tenant.create({ 
          tenant_name,
          tenant_description,
          tenant_region_id,
          tenant_host_url,
          tenant_host_token_api,
          tenant_iflow_host_url,
          tenant_host_username,
          tenant_host_password: encryptedTenantHostPassword,
          tenant_iv_salt,
          tenant_host_test_status_id,
          tenant_host_test_status_on,
          tenant_util_host_url,
          tenant_util_token_url,
          tenant_util_client_id,
          tenant_util_client_secret: encryptedTenantUtilClientSecret,
          tenant_util_iv_salt,
          tenant_environment_id,
          tenant_state_id,
          created_by,
          modified_by,
        });
        let isTenantConnectionOkay = await checkValidTenant(tenant.tenant_id)
        let data = {};
        // create an entry in tenant package artifact info table
        data.tpa_tenant_id = tenant.tenant_id
        data.tpa_last_sync_on = null;
        data.tpa_progress_status_id = null; // put the tenant line item in schedule
        data.tpa_error = null;
        data.is_deleted = false;
        data.tpa_is_tenant_connection_ok = isTenantConnectionOkay;
        data.created_by = null;
        data.modified_by = null;
        data.created_on = Math.floor(Date.now() / 1000);
        data.modified_on = Math.floor(Date.now() / 1000);
        await TenantPackageArtifactInfo.create(data);

        res.status(201).json(tenant);
      } catch (error) {
        console.error('Error creating tenant:', error);
        return sendResponse(
          res, // response object
          false, // success
          HttpStatusCode.InternalServerError, // statusCode
          responseObject.INTERNAL_SERVER_ERROR, // status type
          `Internal Server Error: in creating a tenant record.`, // message
          {}
      );
        // res.status(500).json({ error: 'Internal Server Error' });
      }
}

const updateTenantDetails = async (req, res) => {
    const { tenant_id } = req.body;
    console.log('tenant_id: ', tenant_id)
    try {
        const tenant = await Tenant.findByPk(tenant_id);
        const tenant_iv_salt = tenant.tenant_iv_salt;
        const tenant_util_iv_salt = tenant.tenant_util_iv_salt;
        if (!tenant) {
          return sendResponse(
            res, // response object
            false, // success
            HttpStatusCode.NotFound, // statusCode
            responseObject.RECORD_NOT_FOUND, // status type
            `Data not found for tenant id: ${tenant_id}`, // message
             {}
        );
          // res.status(404).json({ error: 'Tenant not found' });
        } else {
          let { 
            tenant_name,
            tenant_description,
            tenant_region_id,
            tenant_host_url,
            tenant_host_token_api,
            tenant_iflow_host_url,
            tenant_host_username,
            tenant_host_password,
            tenant_iv_salt,
            tenant_host_test_status_id,
            tenant_host_test_status_on,
            tenant_util_host_url,
            tenant_util_token_url,
            tenant_util_client_id,
            tenant_util_client_secret,
            tenant_util_iv_salt,
            tenant_environment_id,
            tenant_state_id,
            created_by,
            modified_by
          } = req.body;

          let encryptedTenantHostPassword;
          let encryptedTenantUtilClientSecret;

          if (!tenant_host_password || tenant_host_password === null) {
            encryptedTenantHostPassword = tenant.tenant_host_password;
            console.log('\nHost password is not provided')
          } else {
            encryptedTenantHostPassword = encryptData (tenant_host_password, getEncryptionIV(tenant_iv_salt));
          }

          if (!tenant_util_client_secret || tenant_host_password === null) {
            encryptedTenantUtilClientSecret = tenant.tenant_util_client_secret;
            console.log('\nutil client secret is not provided')
          } else {
            encryptedTenantUtilClientSecret = encryptData (tenant_util_client_secret, getEncryptionIV(tenant_util_iv_salt));
          }

         // not using tenant_iv_salt for now, instead using it from our .env
         // later on, use tenant_iv_salt
          await tenant.update({ 
            tenant_name,
            tenant_description,
            tenant_region_id,
            tenant_host_url,
            tenant_host_token_api,
            tenant_iflow_host_url,
            tenant_host_username,
            tenant_host_password: encryptedTenantHostPassword,
            tenant_iv_salt,
            tenant_host_test_status_id,
            tenant_host_test_status_on,
            tenant_util_host_url,
            tenant_util_token_url,
            tenant_util_client_id,
            tenant_util_client_secret: encryptedTenantUtilClientSecret,
            tenant_util_iv_salt,
            tenant_environment_id,
            tenant_state_id,
            created_by,
            modified_by,
           });
          res.json(tenant);
          
          let isTenantConnectionOkay = await checkValidTenant(tenant.tenant_id)
          if (isTenantConnectionOkay) {
            console.log('Tenant connection is okay after Edit');
          } else {
            console.log('Tenant connection is not okay after Edit');
          }
        }
      } catch (error) {
        console.error('Error updating tenant:', error);
        return sendResponse(
          res, // response object
          false, // success
          HttpStatusCode.InternalServerError, // statusCode
          responseObject.INTERNAL_SERVER_ERROR, // status type
          `Internal Server Error: in updating a tenant record.`, // message
          {}
      );
        // res.status(500).json({ error: 'Internal Server Error' });
      }

}

module.exports = {
    getAllTenants,
    getTenantById,
    removeTenant,
    updateTenantDetails,
    addTenant
}