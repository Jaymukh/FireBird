const { DataTypes, Model } = require('sequelize');
const sequelize = require('../dbconfig/config');
const UFMFailoverConfigState = require('./UFM/ufmFailoverConfigState');
const Tenant = require('./tenant');
const UFMProfileRuntimeMap = require('./UFM/ufmProfileRuntimeMap');
const Taxonomy = require('./taxonomy');
const UFMSyncHeader = require('./UFM/ufmSyncHeader');
const UFMBackupHeader = require('./ufmBackupHeader');
const { schemaName } = require('../constants/schemaName');

class UFMProfile extends Model {}

UFMProfile.init({
    ufm_profile_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    ufm_profile_name: {
        type: DataTypes.STRING(150),
        allowNull: true,
    },
    ufm_profile_environment_id: { // taxonomy
        type: DataTypes.INTEGER,
        allowNull: true,
        // defaultValue: 12001 // remove this later on
    },
    ufm_profile_primary_tenant_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    ufm_profile_secondary_tenant_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    ufm_profile_gr_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    ufm_profile_tenant_state_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        // defaultValue: 14001 // remove this later on
    },
    ufm_profile_source_runtime: {
        type: DataTypes.STRING(60),
        allowNull: true,
    },
    ufm_profile_destination_runtime: {
        type: DataTypes.STRING(60),
        allowNull: true,
    },
    created_on: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: () => Math.floor(Date.now() / 1000)
    },
    created_by: {
        type: DataTypes.STRING(40),
        allowNull: true
    },
    modified_on: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: () => Math.floor(Date.now() / 1000)
    },
    modified_by: {
        type: DataTypes.STRING(40),
        allowNull: true
    },
    is_deleted: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false
    }
}, {
    sequelize,
    schema: schemaName,
    modelName: 'UFMProfile',
    tableName: 'ufm_profile',
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

module.exports = UFMProfile;

UFMProfile.hasMany(  UFMFailoverConfigState , { foreignKey: "ufm_profile_id"} );
UFMFailoverConfigState.belongsTo( UFMProfile,{ foreignKey: "ufm_profile_id"} );
UFMProfile.hasMany(UFMProfileRuntimeMap, {foreignKey: "ufm_profile_id"});
UFMProfileRuntimeMap.belongsTo( UFMProfile, { foreignKey: "ufm_profile_id"});
UFMProfile.belongsTo( Taxonomy, { foreignKey: "ufm_profile_environment_id", as: "environment_id"});

UFMProfile.belongsTo( Taxonomy, { foreignKey: "ufm_profile_tenant_state_id", as : "tenant_state"});
UFMSyncHeader.belongsTo( UFMProfile , { foreignKey: "ufm_profile_id"});
UFMProfile.hasMany( UFMSyncHeader, { foreignKey: "ufm_profile_id"});

UFMBackupHeader.belongsTo(UFMProfile, { foreignKey: "ufm_profile_id" });
UFMProfile.hasMany(UFMBackupHeader, { foreignKey: "ufm_profile_id" });