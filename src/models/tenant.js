// tenant.js
const { DataTypes, Model } = require('sequelize');
const sequelize = require('../dbconfig/config');
const UFMProfile = require('./ufmProfile');
const Taxonomy = require('./taxonomy');
const UserModel = require('./userModel');
const { schemaName } = require('../constants/schemaName');

class Tenant extends Model {}

Tenant.init({
    tenant_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    tenant_name: {
        type: DataTypes.STRING(150),
        allowNull: true,
    },
    tenant_description: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    tenant_region_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    tenant_host_url: {
        type: DataTypes.STRING(2048),
        allowNull: true
    },
    tenant_host_username: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    tenant_host_token_api: {
        type: DataTypes.STRING(2048),
        allowNull: true
    },
    tenant_iflow_host_url: { // column not in use
        type: DataTypes.STRING(2048),
        allowNull: true
    },
    tenant_host_password: {
        type: DataTypes.STRING(300),
        allowNull: true
    },
    tenant_iv_salt: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    tenant_host_test_status_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    tenant_host_test_status_on: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    tenant_util_host_url: {
        type: DataTypes.STRING(2048),
        allowNull: true
    },
    tenant_util_token_url: {
        type: DataTypes.STRING(2048),
        allowNull: true
    },
    tenant_util_client_id: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    tenant_util_client_secret: {
        type: DataTypes.STRING(400),
        allowNull: true
    },
    tenant_util_iv_salt: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    tenant_environment_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    tenant_state_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    modified_by: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    created_on: {
        type: DataTypes.BIGINT,
        allowNull: true, 
        defaultValue: () => Math.floor(Date.now() / 1000)
    },
    modified_on: {
        type: DataTypes.BIGINT,
        allowNull: true, 
        defaultValue: () => Math.floor(Date.now() / 1000)
    },
    is_deleted: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false
    }
}, {
    sequelize,
    schema: schemaName,
    modelName: 'tenant',
    tableName: 'tenant',
    createdAt: 'created_on', 
    updatedAt: 'modified_on', 
    timestamps: true, // If you want Sequelize to not automatically manage createdAt and updatedAt columns
    hooks: {
        beforeCreate: (record) => {
            record.created_on = Math.floor(Date.now() / 1000);
            record.modified_on = Math.floor(Date.now() / 1000);
        },
        beforeUpdate: (record) => {
            record.modified_on = Math.floor(Date.now() / 1000);
        }
    }
});

module.exports = Tenant;

// Tenant.sync({ force: true })

UFMProfile.belongsTo( Tenant, {foreignKey: "ufm_profile_primary_tenant_id", as: "ufm_profile_primary_tenant", onDelete: 'RESTRICT' });
UFMProfile.belongsTo( Tenant, {foreignKey: "ufm_profile_secondary_tenant_id", as: "ufm_profile_secondary_tenant", onDelete: 'RESTRICT' });


Tenant.belongsTo( Taxonomy, { foreignKey: "tenant_environment_id", as: "tenant_environment"});
Tenant.belongsTo( Taxonomy, { foreignKey: "tenant_state_id", as : "tenant_state"});
Tenant.belongsTo( Taxonomy, { foreignKey: "tenant_region_id", as : "region_id"});
Tenant.belongsTo( Taxonomy, { foreignKey: "tenant_host_test_status_id", as : "test_status"});

Tenant.belongsTo( UserModel, { foreignKey: "created_by", as: "created_by_user"});
Tenant.belongsTo( UserModel, { foreignKey: "modified_by", as: "modified_by_user"});