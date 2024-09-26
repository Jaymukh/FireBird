const { DataTypes, Model } = require('sequelize');
const { schemaName } = require('../../constants/schemaName');

// This table is to store the state of a failover process which was running for the last time
class UFMFailoverStatus extends Model {}

UFMFailoverStatus.init({
  current_process: {
    type: DataTypes.VARCHAR(50),
    allowNull: true
  },
  process_status: {
    type: DataTypes.VARCHAR(50),
    allowNull: true
  },
  config_state_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  modified_on: {
    type: DataTypes.BIGINT,
    allowNull: true
  }

}, {
    sequelize,
    schema: schemaName,
    modelName: 'UFMFailoverStatus',
    tableName: 'ufm_failover_status',
    updatedAt: 'modified_on', 
    timestamps: true
});