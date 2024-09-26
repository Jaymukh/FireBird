const { DataTypes, Model } = require('sequelize');
const sequelize = require('../dbconfig/config');
const { schemaName } = require('../constants/schemaName');

class Taxonomy extends Model {}

Taxonomy.init({
    taxonomy_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    asset_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    asset_url: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    group_name: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    taxonomy_code: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    taxonomy_name: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    taxonomy_value: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    taxonomy_numeric: {
        type: DataTypes.DECIMAL(18,9),
        allowNull: true
    },
    taxonomy_type: {
        type: DataTypes.STRING(30),
        allowNull: true
    },
    taxonomy_category: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    additional_param_1: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    additional_param_2: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: true
    },
    is_deleted: {
        type: DataTypes.BOOLEAN,
        allowNull: true
    },
    priority_order: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    parent_id: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    created_on: {
        type: DataTypes.BIGINT,
        allowNull: true
    }

}, {
    sequelize,
    schema: schemaName,
    modelName: 'taxonomy',
    tableName: 'taxonomy',
    createdAt: 'created_on', 
    updatedAt: false, // In case we dont want this column
    timestamps: false 
});

module.exports = Taxonomy;

