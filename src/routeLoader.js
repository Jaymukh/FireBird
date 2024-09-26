// routeLoader.js

const express = require('express');
const router = express.Router();

// health Check route
// router.use("/", require("./routes/healthRouter"));

// Routes -> the sequence of routes is important
router.use("/integrationPackages", require("./routes/integrationPackagesRouter")); // sync
router.use("/gitRepository", require("./routes/gitRepositoryRouter"));
router.use("/gitAction", require("./routes/gitActionRouter"));
router.use("/tenantAction", require("./routes/tenantActionRouter"));
router.use("/tenant", require("./routes/tenantMasterRouter"));
router.use("/taxonomy", require("./routes/taxonomyRouter"));
router.use("/ufm", require("./routes/ufmProfileRouter"));
router.use("/userMaster", require("./routes/userMasterRouter"));
router.use('/tokens', require("./routes/tokenProviderRouter"));
router.use("/failoverConfigState",require("./routes/ufmFailoverConfigStateRouter"));
router.use("/runtimeArtifacts", require("./routes/runtimeArtifactsRouter")); // here
router.use("/ufmProfileRuntime", require("./routes/ufmProfileRuntimeMapRouter"));
router.use("/runtime", require("./routes/runtimeEnvironmentRouter"));
router.use("/keystore", require("./routes/keystoreRouter"));
router.use("/userCredentials", require("./routes/userCredentialsRouter"));
router.use("/OAuth2Credentials", require("./routes/OAuth2CredentialsRouter"));
router.use("/variables", require("./routes/variablesRouter"));
router.use("/numberRanges", require("./routes/numberRangesRouter"));


module.exports = router;