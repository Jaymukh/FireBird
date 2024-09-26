const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../dbconfig/config');
const Taxonomy = require('../taxonomy');
const UserModel = require('../userModel');
const { schemaName } = require('../../constants/schemaName');
const TenantPackageArtifactInfo = require('./tenantPacakgeArtifactInfo');
const TenantPackage = require('./tenantPackage');

// Id: 'EVA_POC_copy',
// Version: '1.0.14',
// PackageId: 'POCiFlows',
// Name: 'EVA_POC_copy',
// Description: '',
// Sender: null,
// Receiver: null,
// CreatedBy: 'sb-9a5ee981-1b85-46cd-90d3-d3a55b0b13bb!b11838|it!b46',
// CreatedAt: '1715195174092',
// ModifiedBy: 'sb-9a5ee981-1b85-46cd-90d3-d3a55b0b13bb!b11838|it!b46',
// ModifiedAt: '1715195174092',
// ArtifactContent: null,

class TenantArtifact extends Model {}

TenantArtifact.init({
    ta_id: { // tpa -> tenant package 
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    tp_id: { // From TenantPackage
        type: DataTypes.INTEGER,
        allowNull: true
    },
    ta_last_sync_on: {
        type: DataTypes.BIGINT,
        allowNull: true
    }, 
    ta_artifact_id: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ta_artifact_type: { // all four type of artifact types
        type: DataTypes.STRING(50),
        allowNull: true
    },
    ta_artifact_name: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ta_artifact_version: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    ta_artifact_description: {
        type: DataTypes.STRING(512),
        allowNull: true
    },
    ta_artifact_package_id: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    ta_artifact_modified_by: {
        type: DataTypes.STRING(256),
        allowNull: true
    },
    ta_artifact_creation_date: { // comes as a 12 digit string of epoch timestamp
        type: DataTypes.STRING(20),
        allowNull: true
    },
    ta_artifact_modified_date: { // comes as a 12 digit string of epoch timestamp
        type: DataTypes.STRING(20),
        allowNull: true
    },
    ta_artifact_created_by: {
        type: DataTypes.STRING(256),
        allowNull: true
    },
    ta_error: {
        type: DataTypes.STRING(1024),
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
    modelName: 'tenant_artifact',
    tableName: 'tenant_artifact',
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

module.exports = TenantArtifact;

TenantArtifact.belongsTo( UserModel, { foreignKey: "created_by", as: "created_by_user"});
TenantArtifact.belongsTo( UserModel, { foreignKey: "modified_by", as: "modified_by_user"});

TenantArtifact.belongsTo( TenantPackage , { foreignKey: "tp_id" });
TenantPackage.hasMany( TenantArtifact, { foreignKey: "tp_id" });