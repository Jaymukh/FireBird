const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../dbconfig/config');
const Taxonomy = require('../taxonomy');
const { schemaName } = require('../../constants/schemaName');

class UFMFailoverProcessComponent extends Model {}

UFMFailoverProcessComponent.init({
    failover_process_component_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    failover_process_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    config_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    config_package_id: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    config_package_name: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    config_component_group_name: { // keeping it null/unused for now
        type: DataTypes.STRING(50),
        allowNull: true
    },
    config_component_group_order: {  // keeping it null/unused for now
        type: DataTypes.INTEGER,
        allowNull: true
    },
    config_component_position: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    config_component_id: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    config_component_name: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    config_component_type: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    config_component_dt_version: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    primary_tenant_runtime_status: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    primary_tenant_runtime_error: {
        type: DataTypes.STRING(1024), // limit error string to 1024 characters
        allowNull: true
    },
    primary_tenant_runtime_started_on: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    primary_tenant_runtime_completed_on: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    primary_tenant_runtime_status_last_updated_on: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    secondary_tenant_runtime_status: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    secondary_tenant_runtime_error: {
        type: DataTypes.STRING(1024), // limit error string to 1024 characters
        allowNull: true
    },
    secondary_tenant_runtime_started_on: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    secondary_tenant_runtime_completed_on: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    secondary_tenant_runtime_status_last_updated_on: {
        type: DataTypes.BIGINT,
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
    }
}, {
    sequelize,
    schema: schemaName,
    modelName: 'UFMFailoverProcessComponent',
    tableName: 'ufm_failover_process_component',
    createdAt: 'created_on', 
    timestamps: false,
    hooks: {
        beforeCreate: (record) => {
            record.created_on = Math.floor(Date.now() / 1000);
        },

    }
});

module.exports = UFMFailoverProcessComponent;


