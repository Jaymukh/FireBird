const axios = require("axios");
const Tenant = require("../models/tenant");
const { decryptData , getEncryptionIV} = require("./decode");

// Later on -> rename this function
async function getOAuth(inputCredentials) {
    const { tokenEndpoint, clientId, clientSecret } = inputCredentials;
    // Encode client ID and client secret in Base64
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    // Try replacing this with our service
    try {
        const response = await axios.post(tokenEndpoint, null, {
            headers: {
                'Authorization': `Basic ${authHeader}`,
                'Content-Type': 'application/x-www-form-urlencoded' // Required for token endpoint
            },
            params: {
                'grant_type': 'client_credentials'
            }
        });
        return response.data.access_token;
    } catch (error) {
        console.error('Error getting access token:', error);
        return null;
    }
}

// This function is same as getOAuth function above, made it in order to logically keep Iflow cred auth separate
async function getOAuthForIFlow(inputCredentials) {
    const tokenEndpoint = inputCredentials.tokenEndpoint;
    const clientId = inputCredentials.clientId; 
    const clientSecret = inputCredentials.clientSecret;

    // Encode client ID and client secret in Base64
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
        const response = await axios.post(tokenEndpoint, null, {
            headers: {
                'Authorization': `Basic ${authHeader}`,
                'Content-Type': 'application/x-www-form-urlencoded' // Required for token endpoint
            },
            params: {
                'grant_type': 'client_credentials'
            }
        });
        return response.data.access_token;
    } catch (error) {
        console.error('Error getting access token:', error);
        return null;
    }
}

async function getBearerToken(tenantResponse) {
    const authCredentials = {
        tokenEndpoint: tenantResponse.tenant_host_token_api,
        clientId: tenantResponse.tenant_host_username,
        clientSecret: decryptData (
            tenantResponse.tenant_host_password,
            getEncryptionIV(tenantResponse.tenant_iv_salt)
        )
    };
    return getOAuth(authCredentials);
}

// this is for the utils to set variables, to get Password (UserCredential), ClientSecret(OAuth2)
async function getBearerTokenForIFlow(tenantResponse) {
    const authCredentials = {
        tokenEndpoint: tenantResponse.tenant_util_token_url,
        clientId: tenantResponse.tenant_util_client_id,
        clientSecret: decryptData (
            tenantResponse.tenant_util_client_secret,
            getEncryptionIV(tenantResponse.tenant_util_iv_salt)
        )
    };
    return getOAuthForIFlow(authCredentials);
}

async function getBearerTokenForTenants (tenantOneId, tenantTwoId) {
    try {
        const [tenantOneDbResponse, tenantTwoDbResponse] = await Promise.all([
            Tenant.findByPk(tenantOneId),
            Tenant.findByPk(tenantTwoId)
        ]);
    
        const [tenantOneBearerToken, tenantTwoBearerToken] = await Promise.all([
            getBearerToken(tenantOneDbResponse),
            getBearerToken(tenantTwoDbResponse)
        ]);
    
        if (!tenantOneBearerToken || !tenantTwoBearerToken) {
           throw new Error('Cannot get bearer token for tenant(s)')
        }
        return [tenantOneBearerToken, tenantTwoBearerToken, tenantOneDbResponse, tenantTwoDbResponse ]
    } catch(error) {
        console.log('Fn: getBearerTokenForTenants, error in getting Authorization bearer token: ', error );
        throw Error('Error in getting bearer token for the tenant(s)')
    }
   
}


async function getOAuthTenantOne() {
    const tenantOneCredential = {
        tokenEndpoint : "https://pgisqa2.authentication.us20.hana.ondemand.com/oauth/token",
        clientId :"sb-08c908ac-89f8-4ce2-918a-2f93e2da4f35!b12346|it!b34",
        clientSecret :"47810be4-309c-4296-b2ff-4596e090ad37$j_ExYphyBePaIte1PH7br85_LbbhgZka-QlaWc2G7i4=",
    }
    let bearerToken = await getOAuth(tenantOneCredential);
    return bearerToken;
}

async function getOAuthTenantTwo() {
    const tenantTwoCredential = {
        tokenEndpoint : 'https://tarentobtp.authentication.eu10.hana.ondemand.com/oauth/token',
        clientId :"sb-4580da99-af4a-4f4e-8faa-d570557797c9!b140765|it!b410603",
        clientSecret :"174f464d-a14e-45b3-a778-beb1c0b1dd6f$fzZyjMdgt4CiNwodlegN4_aAl_wEdIqQIaSLWFAsgmw=",
    }
    let bearerToken = await getOAuth(tenantTwoCredential);
    return bearerToken;
}

// DEPRECATED
// async function getOAuthGit (inputCredentials) {
//     let config = {
//         method: 'get',
//         url: inputCredentials.tokenEndpoint,
//         // Set the content type header, so that we get the response in JSON
//         headers: {
//              accept: 'application/json',
//              Authorization: `Bearer ${inputCredentials.clientSecret}`
//         }
//       }
//       console.log('Config: ', config)

//     let response = await axios(config)

//     if (response) {
//         console.log('Response: ',typeof response );
//         console.log('Response object: ',response );
//         return response
//     }
// }

module.exports = {
    getOAuthTenantOne,
    getOAuthTenantTwo,
    // getOAuthGit,
    getBearerTokenForTenants,
    getOAuth,
    getOAuthForIFlow,
    getBearerTokenForIFlow,
    getBearerToken
}