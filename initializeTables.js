// All the function related to Schema, tables initialization 
// Should be able to handle initial db creation as well as subsequent alterations (check for this)
const { Sequelize } = require('sequelize');
const sequelize = require('./src/dbconfig/config');

// Do all these table DB things separately
const Taxonomy = require("./src/models/taxonomy");
const Tenant = require("./src/models/tenant");
const GitRepository = require("./src/models/gitRepository");
const UFMProfile = require("./src/models/ufmProfile");
const UFMFailoverConfigState = require("./src/models/UFM/ufmFailoverConfigState");
const UFMFailoverConfig = require("./src/models/UFM/ufmFailoverConfig");
const UFMProfileRuntimeMap = require("./src/models/UFM/ufmProfileRuntimeMap");
const UserModel = require("./src/models/userModel");
const UFMSyncDetail = require("./src/models/UFM/ufmSyncDetail");
const UFMSyncHeader = require("./src/models/UFM/ufmSyncHeader");
const UFMFailoverProcess = require("./src/models/UFM/ufmFailoverProcess");
const UFMFailoverProcessComponent = require("./src/models/UFM/ufmFailoverProcessComponent");
const UFMBackupDetail = require("./src/models/ufmBackupDetail");
const UFMBackupHeader = require("./src/models/ufmBackupHeader");
const { taxonomyData } = require("./taxonomyData");
const { schemaName } = require("./src/constants/schemaName");
const TenantPackageArtifactInfo = require('./src/models/Tenant/tenantPacakgeArtifactInfo');
const TenantPackage = require('./src/models/Tenant/tenantPackage');
const TenantArtifact = require('./src/models/Tenant/tenantArtifact');
const DailyTimeInterval = require('./src/models/Tenant/dailyTimeInterval');
const TenantPairMap = require('./src/models/Tenant/tenantPairMap');

async function insertIfNotExists() {
  console.log('\nCreating data for taxonomy table')
  try {
    let count = await Taxonomy.count();

    if (count === 0) {
      console.log('\nNo count in taxonomy table, creating data.')
      await Taxonomy.bulkCreate(taxonomyData)
    }

  } catch (error) {
    console.log('\nError in inserting bulk Records for taxonomy', error)
  }
}

async function syncModels() {

  try {

    await UserModel.sync({ force: false });
    await Tenant.sync({ force: false });
    await GitRepository.sync({ force: false });
    await UFMProfile.sync({ force: false });
    await UFMFailoverConfigState.sync({ force: false });
    await UFMFailoverConfig.sync({ force: false });
    await UFMProfileRuntimeMap.sync({ force: false });
    await UFMSyncDetail.sync({ force: false });
    await UFMSyncHeader.sync({ force: false });
    await UFMFailoverProcess.sync({ force: false });
    await UFMFailoverProcessComponent.sync({ force: false });
    await UFMBackupHeader.sync({ force: false });
    await UFMBackupDetail.sync({ force: false });

    await TenantPackageArtifactInfo.sync({ force: false });
    await TenantPackage.sync({ force: false });
    await TenantArtifact.sync({ force: false });
    await DailyTimeInterval.sync({ force: false });
    await TenantPairMap.sync({ force: false });

  } catch (error) {
    console.error('Error syncing models:', error);
  }
}

// If the schema doesnot exist, create it otherwise ignore
async function ensureSchema(schemaName) {
  try {
    const schemaExists = await sequelize.query(
      "SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = :schemaName)",
      {
        replacements: { schemaName },
        type: Sequelize.QueryTypes.SELECT
      }
    );

    if (!schemaExists[0].exists) {
      await sequelize.query(`CREATE SCHEMA ${schemaName}`);
      console.log(`\nSchema ${schemaName} created successfully.`);
    } else {
      console.log(`\nSchema ${schemaName} already EXISTS.`);
    }

    await Taxonomy.sync({ force: false });
    await insertIfNotExists()
    await syncModels();

  } catch (error) {
    console.log('Error original code: ', error.original.code)
    if (error.original && error.original.code === '42P06') {
      console.log(`\nSchema ${schemaName} already exists...`);

      await Taxonomy.sync({ force: false });
      await insertIfNotExists()
      await syncModels();

    } else {
      console.error('Error occurred:', error);
      throw error;  // Re-throw the error if it's not the schema already exists error
    }
  }
}

module.exports = {
  ensureSchema
}
