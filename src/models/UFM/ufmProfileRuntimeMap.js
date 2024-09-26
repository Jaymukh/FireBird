const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../dbconfig/config');
const { schemaName } = require('../../constants/schemaName');

class UFMProfileRuntimeMap extends Model {}

UFMProfileRuntimeMap.init({
    ufm_profile_runtime_map_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    ufm_profile_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    primary_runtime_id: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    primary_runtime_display_name: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    primary_runtime_type: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    primary_runtime_type_id: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    primary_runtime_state: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    secondary_runtime_id: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    secondary_runtime_display_name: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    secondary_runtime_type: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    secondary_runtime_type_id: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    secondary_runtime_state: {
        type: DataTypes.STRING(150),
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
    },
}, {
    sequelize,
    schema: schemaName,
    modelName: 'UFMProfileRuntimeMap',
    tableName: 'ufm_profile_runtime_map',
    createdAt: 'created_on', 
    updatedAt: 'modified_on', 
    timestamps: true,
    hooks:{
        beforeCreate: (record) => {
            record.created_on = Math.floor(Date.now() / 1000);
            record.modified_on = Math.floor(Date.now() / 1000);
        },
        beforeUpdate: (record) => {
            record.modified_on = Math.floor(Date.now() / 1000);
        }
    }
});

module.exports = UFMProfileRuntimeMap;