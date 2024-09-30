const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../dbconfig/config');
const UserModel = require('../userModel');
const { schemaName } = require('../../constants/schemaName');
const Tenant = require('../tenant');

class TenantPairMap extends Model { }

TenantPairMap.init({
    tpm_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    tpm_pair_name: {
        type: DataTypes.STRING(256),
        allowNull: true
    },
    tpm_source_tenant: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    tpm_destination_tenant: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    tpm_is_cloning_done: {
        type: DataTypes.BOOLEAN,
        allowNull: true
    },
    tpm_cloning_progress_status: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    tpm_cloning_last_performed_on: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    is_deleted: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false
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
    }
}, {
    sequelize,
    schema: schemaName,
    modelName: 'tenant_pair_map',
    tableName: 'tenant_pair_map',
    createdAt: 'created_on',
    updatedAt: 'modified_on',
    timestamps: true,
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

module.exports = TenantPairMap;

TenantPairMap.belongsTo(UserModel, { foreignKey: "created_by", as: "created_by_user" });
TenantPairMap.belongsTo(UserModel, { foreignKey: "modified_by", as: "modified_by_user" });

TenantPairMap.belongsTo(Tenant, { foreignKey: "tpm_source_tenant", as: "source_tenant" });
TenantPairMap.belongsTo(Tenant, { foreignKey: "tpm_destination_tenant", as: "destination_tenant" });