const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../dbconfig/config');
const Taxonomy = require('../taxonomy');
const UFMFailoverProcessComponent = require('./ufmFailoverProcessComponent');
const { schemaName } = require('../../constants/schemaName');

class UFMFailoverProcess extends Model {}

UFMFailoverProcess.init({
    failover_process_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    config_state_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    ufm_profile_id:{
        type: DataTypes.INTEGER,
        allowNull: true
    },
    is_last_record:{
        type: DataTypes.BOOLEAN,
        allowNull: true
    },
    is_planned_failover: {
        type: DataTypes.BOOLEAN,
        allowNull: true
    },
    entry_type_id:{
        type: DataTypes.INTEGER,
        allowNull: true
    },
    is_process_initiated_progress_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    process_started_on: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    process_started_by: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    process_completed_on: {
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
    modelName: 'UFMFailoverProcess',
    tableName: 'ufm_failover_process',
    createdAt: 'created_on', 
    timestamps: false,
    hooks: {
        beforeCreate: (record) => {
            record.created_on = Math.floor(Date.now() / 1000);
        },

    }
});

module.exports = UFMFailoverProcess;

UFMFailoverProcess.belongsTo(Taxonomy, { foreignKey: "entry_type_id", as: "entry_type"});

UFMFailoverProcess.belongsTo(Taxonomy, { 
    foreignKey: "is_process_initiated_progress_id", as: "process_initiated_progress"
});


// define ufm failover process table relationship with its child table

UFMFailoverProcess.hasMany( UFMFailoverProcessComponent, { foreignKey: "failover_process_id" });
UFMFailoverProcessComponent.belongsTo(UFMFailoverProcess, { foreignKey: "failover_process_id" });
