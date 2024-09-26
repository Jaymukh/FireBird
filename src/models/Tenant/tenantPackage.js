const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../dbconfig/config');
const Taxonomy = require('../taxonomy');
const UserModel = require('../userModel');
const { schemaName } = require('../../constants/schemaName');
const TenantPackageArtifactInfo = require('./tenantPacakgeArtifactInfo');
// Package for Tenant has the following fields (sample data) which this table stores:

// Id: 'AzureKeyValutTOSAPKWDReportVariant', [done]
// Name: 'AzureKeyValut_TO_SAPKWD_ReportVariant', [done]
// ResourceId: '041c6ceeab624455b6e45a86b45982e1', [done]
// Description: '<p></p>', [ done]
// ShortText: 'This package was created as part of ReportVariant request', [done]
// Version: '1.0.0', [done]
// Vendor: '', [done]
// PartnerContent: false, [done]
// UpdateAvailable: false, [done]
// Mode: 'EDIT_ALLOWED', [done]
// SupportedPlatform: 'Cloud Integration', [done]
// ModifiedBy: 'sb-08c908ac-89f8-4ce2-918a-2f93e2da4f35!b12346|it!b34',
// CreationDate: '1723803023451',
// ModifiedDate: '1723803023454',
// CreatedBy: 'sb-08c908ac-89f8-4ce2-918a-2f93e2da4f35!b12346|it!b34',
// Products: '',
// Keywords: '',
// Countries: '',
// Industries: '',
// LineOfBusiness: '',
// PackageContent: null, -> not sure about this

class TenantPackage extends Model {}

TenantPackage.init({
    tp_id: { // tpa -> tenant package 
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    tpa_id: { // From TenantPackageArtifactInfo
        type: DataTypes.INTEGER,
        allowNull: true
    },
    tp_last_sync_on: {
        type: DataTypes.BIGINT,
        allowNull: true
    }, 
/////// package fields information starts here
    tp_package_id: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    tp_pacakge_name: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    tp_package_resource_id: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    tp_package_description: {
        type: DataTypes.STRING(2048),
        allowNull: true
    },
    tp_package_shorttext: {
        type: DataTypes.STRING(512),
        allowNull: true
    },
    tp_package_version: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    tp_package_vendor: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    tp_package_partner_content: {
        type: DataTypes.BOOLEAN,
        allowNull: true
    },
    tp_package_update_available: {
        type: DataTypes.BOOLEAN,
        allowNull: true
    },
    tp_package_mode: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    tp_package_supported_platform: {
        type: DataTypes.STRING(512),
        allowNull: true
    },
    tp_packaged_modified_by: {
        type: DataTypes.STRING(256),
        allowNull: true
    },
    tp_package_creation_date: { // comes as a 12 digit string of epoch timestamp
        type: DataTypes.STRING(20),
        allowNull: true
    },
    tp_package_modified_date: { // comes as a 12 digit string of epoch timestamp
        type: DataTypes.STRING(20),
        allowNull: true
    },
    tp_package_created_by: {
        type: DataTypes.STRING(256),
        allowNull: true
    },
    tp_package_products: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    tp_package_keywords: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    tp_package_countries: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    tp_package_industries: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    tp_package_line_of_business: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
///// end of package information fields
    tp_error: {
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
    modelName: 'tenant_package',
    tableName: 'tenant_package',
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

module.exports = TenantPackage;

TenantPackage.belongsTo( UserModel, { foreignKey: "created_by", as: "created_by_user"});
TenantPackage.belongsTo( UserModel, { foreignKey: "modified_by", as: "modified_by_user"});

TenantPackage.belongsTo( TenantPackageArtifactInfo, { foreignKey: "tpa_id" });
TenantPackageArtifactInfo.hasMany( TenantPackage, { foreignKey: "tpa_id" });