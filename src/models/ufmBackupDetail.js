// tenant.js
const { DataTypes, Model } = require('sequelize');
const sequelize = require('../dbconfig/config');
const { schemaName } = require('../constants/schemaName');

class UFMBackupDetail extends Model { }

UFMBackupDetail.init({
    ufm_backup_detail_id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    ufm_backup_header_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    ufm_backup_timestamp: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: () => Math.floor(Date.now() / 1000)   
    },
    ufm_backup_component_package_id: {
        type: DataTypes.STRING(250),
        allowNull: true,
    },
    ufm_backup_component_package_name: {
        type: DataTypes.STRING(250),
        allowNull: true,
    },
    ufm_backup_component_package_desc: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    ufm_backup_component_package_shorttext: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    ufm_backup_component_package_version: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    ufm_backup_component_id: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_component_name: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_component_desc: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    ufm_backup_component_shorttext: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_component_resource_id: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_component_version: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_component_vendor: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_component_partner_content: {
        type: DataTypes.BOOLEAN,
        allowNull: true
    },
    ufm_backup_component_update_available: {
        type: DataTypes.BOOLEAN,
        allowNull: true
    },
    ufm_backup_component_supported_platform: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_component_creation_date: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: () => Math.floor(Date.now() / 1000)   
    },
    ufm_backup_component_modified_date: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: () => Math.floor(Date.now() / 1000)   
    },
    ufm_backup_component_modified_by: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_component_created_by: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_component_config_path: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_component_config_path_timestamp: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    ufm_backup_ks_hexalias: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_ks_alias: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_ks_key_type: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_ks_key_size: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_ks_valid_not_before: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_ks_valid_not_after: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_ks_serial_number: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_ks_signature_algorithm: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_ks_subject_dn: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_ks_issuer_dn: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_ks_version: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_ks_fingerprint_sha1: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_ks_fingerprint_sha256: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_ks_fingerprint_sha512: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_ks_type: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_ks_owner: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_ks_last_modified_by: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_ks_last_modified_time: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_ks_created_by: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_ks_created_time: {
        type: DataTypes.BIGINT  ,
        allowNull: true
    },
    ufm_backup_ks_created_status: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_ks_created_name: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_uc_name: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_uc_kind: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_uc_description: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_uc_user: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_uc_password: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_uc_password_salt: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_uc_company_id: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_uc_security_artifact_descriptor: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_uc_type: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_uc_deployed_by: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_uc_deployed_on: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    ufm_backup_uc_status: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_oa2cc_name: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_oa2cc_description: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_oa2cc_token_service_url: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_oa2cc_client_id: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_oa2cc_client_secret: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_oa2cc_client_authentication: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_oa2cc_scope: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_oa2cc_scope_content_type: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_oa2cc_resource: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_oa2cc_audience: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_oa2cc_security_artifact_descriptor: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_oa2cc__metatdata_type: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_oa2cc_type: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_oa2cc_deployed_by: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_oa2cc_deployed_on: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    ufm_backup_oa2cc_status: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_nv_name: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_nv_description: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_nv_max_value: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_nv_min_value: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_nv_rotate: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_nv_current_value: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ufm_backup_nv_field_length: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
}, {
    sequelize,
    schema: schemaName,
    modelName: 'UFMBackupDetail',   
    tableName: 'ufm_backup_detail',
    createdAt: 'ufm_backup_component_creation_date',
    updatedAt: 'ufm_backup_component_modified_date',
    timestamps: true,
    hooks: {
        beforeCreate: (record) => {
            record.ufm_backup_component_creation_date = Math.floor(Date.now() / 1000);
            record.ufm_backup_component_modified_date = Math.floor(Date.now() / 1000);
            record.ufm_backup_timestamp = Math.floor(Date.now() / 1000);
        },
        beforeUpdate: (record) => {
            record.ufm_backup_component_modified_date = Math.floor(Date.now() / 1000);
            record.ufm_backup_timestamp = Math.floor(Date.now() / 1000);
        }
    }
});

module.exports = UFMBackupDetail;

// UFMBackupHeader.sync({ force: true });