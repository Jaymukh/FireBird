const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../dbconfig/config');
const UserModel = require('../userModel');
const { schemaName } = require('../../constants/schemaName');

class DailyTimeInterval extends Model { }

DailyTimeInterval.init({
    dti_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    dti_start_time: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    dti_end_time: {
        type: DataTypes.STRING(50),
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
    modelName: 'daily_time_interval',
    tableName: 'daily_time_interval',
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

module.exports = DailyTimeInterval;

DailyTimeInterval.belongsTo(UserModel, { foreignKey: "created_by", as: "created_by_user" });
DailyTimeInterval.belongsTo(UserModel, { foreignKey: "modified_by", as: "modified_by_user" });