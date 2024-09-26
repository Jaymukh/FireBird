const { DataTypes, Model } = require('sequelize');
// const sequelize = require('../dbconfig/config');
const sequelize = require('../../dbconfig/config');

const Taxonomy = require('../taxonomy');
const UFMProfile = require('../ufmProfile');
const UFMSyncDetail = require('./ufmSyncDetail');
const { schemaName } = require('../../constants/schemaName');

class UFMSyncHeader extends Model {}

UFMSyncHeader.init({
    ufm_sync_header_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    ufm_profile_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    ufm_last_synced_on: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: () => Math.floor(Date.now() / 1000)
    },
    ufm_component_type_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    is_last_record: {
        type: DataTypes.BOOLEAN,
        allowNull: true
    },
    created_on: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: () => Math.floor(Date.now() / 1000)
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    modified_on: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: () => Math.floor(Date.now() / 1000)
    },
    modified_by: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    sequelize,
    schema: schemaName, 
    modelName: 'UFMSyncHeader',
    tableName: 'ufm_sync_header',
    createdAt: 'created_on', 
    updatedAt: 'modified_on', 
    timestamps: true,
    hooks: {
        beforeCreate: (record) => {
            record.created_on = Math.floor(Date.now() / 1000);
            record.modified_on = Math.floor(Date.now() / 1000);
            record.ufm_last_synced_on = Math.floor( Date.now() / 1000);
        },
        beforeUpdate: (record) => {
            record.modified_on = Math.floor(Date.now() / 1000);
            record.ufm_last_synced_on = Math.floor( Date.now() / 1000);
        }
    }
});

module.exports = UFMSyncHeader;




UFMSyncHeader.belongsTo( Taxonomy,  {foreignKey: "ufm_component_type_id" } ) 
