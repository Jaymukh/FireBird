const { DataTypes, Model } = require('sequelize');
const sequelize = require('../dbconfig/config');
const UFMProfile = require('./ufmProfile');
const Taxonomy = require('./taxonomy');
const { schemaName } = require('../constants/schemaName');

class GitRepository extends Model {}

GitRepository.init({
    gr_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    gr_owner_name: {
        type: DataTypes.STRING(200),
        allowNull: true,
    },
    gr_name: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    gr_description: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    gr_environment_id: { // linked to taxonomy
        type: DataTypes.INTEGER,
        allowNull: true
    },
    gr_host_url: {
        type: DataTypes.STRING(2048),
        allowNull: true
    },
    gr_auth_method_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    gr_api_token: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    gr_client_secret: {
        type: DataTypes.STRING(300),
        allowNull: true
    },
    gr_client_id: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    gr_iv_salt: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    gr_state_id: { // linked to taxonomy
        type: DataTypes.INTEGER,
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
    },
    is_deleted: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false
    }
}, {
    sequelize,
    schema: schemaName,
    modelName: 'git_repository',
    tableName: 'git_repository',
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

module.exports = GitRepository;

UFMProfile.belongsTo( GitRepository, { foreignKey: "ufm_profile_gr_id", onDelete: 'RESTRICT' });

GitRepository.belongsTo( Taxonomy, { foreignKey: "gr_environment_id", as: "git_environment"});
GitRepository.belongsTo( Taxonomy, { foreignKey: "gr_state_id", as : "git_state"});