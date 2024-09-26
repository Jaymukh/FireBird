// tenant.js
const { DataTypes, Model } = require('sequelize');
const sequelize = require('../dbconfig/config');
const UFMBackupDetail = require('./ufmBackupDetail');
const { schemaName } = require('../constants/schemaName');

class UFMBackupHeader extends Model { }

UFMBackupHeader.init({
    ufm_backup_header_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    ufm_profile_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    ufm_last_backup_on: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: () => Math.floor(Date.now() / 1000)
    },
    ufm_component_type_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    is_last_record: {
        type: DataTypes.BOOLEAN,
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
    }
}, {
    sequelize,
    schema: schemaName,
    modelName: 'UFMBackupHeader',
    tableName: 'ufm_backup_header',
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

module.exports = UFMBackupHeader;

// UFMBackupHeader.sync({ force: false });

UFMBackupHeader.hasMany(UFMBackupDetail, { foreignKey: "ufm_backup_header_id" });
UFMBackupDetail.belongsTo(UFMBackupHeader, { foreignKey: "ufm_backup_header_id" });
