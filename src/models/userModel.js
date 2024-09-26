// userModel.js
const { DataTypes, Model } = require('sequelize');
const sequelize = require('../dbconfig/config');
const Taxonomy = require('./taxonomy');
const { schemaName } = require('../constants/schemaName');

class UserModel extends Model {}

UserModel.init({
    user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    email_id: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    first_name: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    last_name: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    display_name: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    external_id: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    additional_param1: {
        type: DataTypes.STRING(250),
        allowNull: true
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
    modified_by:{
        type: DataTypes.STRING(40),
        allowNull: true
    },
    is_active: {
        type:DataTypes.BOOLEAN,
        allowNull: true
    },
    is_admin: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false
    },
    first_logged_on: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: () => Math.floor(Date.now() / 1000)
    },
    last_logged_on: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    role: {
        type: DataTypes.STRING(120),
        allowNull: true
    },
    timezone_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    }
}, {
    sequelize,
    schema: schemaName,
    modelName: 'UserMaster',
    tableName: 'user',
    createdAt: 'created_on', 
    updatedAt: 'modified_on', 
    timestamps: true, 
    hooks:{
        beforeCreate: (record) => {
            record.created_on = Math.floor(Date.now() / 1000);
            record.first_logged_on = Math.floor( Date.now() / 1000);
            record.modified_on = Math.floor(Date.now() / 1000);
        },
        beforeUpdate: (record) => {
            record.modified_on = Math.floor(Date.now() / 1000);
        }
    }
});

module.exports = UserModel;


UserModel.belongsTo( Taxonomy, { foreignKey: "timezone_id", as: "timezone" });