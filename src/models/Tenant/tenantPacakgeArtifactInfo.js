const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../dbconfig/config');
const Taxonomy = require('../taxonomy');
const UserModel = require('../userModel');
const { schemaName } = require('../../constants/schemaName');
const Tenant = require('../tenant');

class TenantPackageArtifactInfo extends Model {}

TenantPackageArtifactInfo.init({
    tpa_id: { // tpa -> tenant package artifact info
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    tpa_tenant_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    tpa_last_sync_on: {
        type: DataTypes.BIGINT,
        allowNull: true
    }, 
    tpa_progress_status_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    tpa_is_tenant_connection_ok: {
        type: DataTypes.BOOLEAN,
        allowNull: true
    },
    // tpa_last_process_timestamp: {
    //     type: DataTypes.BIGINT,
    //     allowNull: true
    // },
    // tpa_next_process_timestamp: {
    //     type: DataTypes.BIGINT,
    //     allowNull: true
    // },
    tpa_error: {
        type: DataTypes.STRING(1024),
        allowNull: true
    },
    is_deleted: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false
    },
    is_seeding_data_populated: { // seeding data for tenantPackage and tenantArtifact
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
    modelName: 'tenant_package_artifact_info',
    tableName: 'tenant_package_artifact_info',
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

module.exports = TenantPackageArtifactInfo;

TenantPackageArtifactInfo.belongsTo( UserModel, { foreignKey: "created_by", as: "created_by_user"});
TenantPackageArtifactInfo.belongsTo( UserModel, { foreignKey: "modified_by", as: "modified_by_user"});

TenantPackageArtifactInfo.belongsTo( Tenant, { foreignKey: "tpa_tenant_id" });
Tenant.hasOne( TenantPackageArtifactInfo, { foreignKey: "tpa_tenant_id" });

TenantPackageArtifactInfo.belongsTo( Taxonomy, { foreignKey: "tpa_progress_status_id" }); // series 18XYZ from taxonomy