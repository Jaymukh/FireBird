const express = require("express");
const morgan = require("morgan");
const winston = require("winston");
const logRequest = require("./src/middlewares/print");
const routeLoader = require("./src/routeLoader");
const nodeCron = require("node-cron");
const { processFailoverJob } = require("./src/cron/failover");
const { ensureSchema } = require('./initializeTables');
const { schemaName } = require("./src/constants/schemaName");
const { getPackageAndArtifactInformationForTenant } = require("./src/cron/gatherPackageArtifactInfoForTenant");
const { clonePackagesAndArtifactsForTenantPairMap } = require("./src/cron/clonePackagesAndArtifactsForTenantPairMap");

// Higher-level error handling
(async () => {
  try {
    await ensureSchema(schemaName);
  } catch (error) {
    console.error('\nFailed to ensure schema:', error); // rethrow is handled in this IIFE
    console.log('\nTry creating schema manually first');
    // Handle the error, such as logging it, sending a notification, or exiting the process
    // process.exit(1);  // Exit the process with a failure code
  }
})();

const app = express();

const PORT = 8080;

// Parse URL-encoded bodies (for form data)
app.use(express.json({ limit: "50mb", extended: true, parameterLimit: 5000000 }))
app.use(express.urlencoded({ limit: "50mb", extended: true, parameterLimit: 5000000 }))


// All routes
app.use("/firebird/", routeLoader);


function printTime() {
  console.log('Current time is', new Date().toString().split(" ")[4]);
}

setInterval(printTime, 1000);

async function scheduleTenantPackageArtifactJobs() {
  try {
    // await getPackageAndArtifactInformationForTenant(); // Waits for this to complete
    await clonePackagesAndArtifactsForTenantPairMap();  // Runs only after the previous function completes
  } catch (error) {
    console.error('Error occurred during scheduled job:', error);
  }
}

// node-cron to perform failover processing 
// nodeCron.schedule('* * * * *', processFailoverJob );
nodeCron.schedule('* * * * *', scheduleTenantPackageArtifactJobs);

// If the route is not found
app.use(function (req, res, next) {
  console.log('route not found');
  res.status(404).json({ message: 'Route Not Found' });
  next();
})

// General logger for Error in application
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Index.js: Internal Server Error', error: err.message });
  next();
})


app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`)
})

