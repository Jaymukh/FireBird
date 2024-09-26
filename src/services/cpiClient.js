const axios = require("axios");

const axiosInstance = (connect, calledFrom = "default") => {

    let headerObject = {}; 
    // let timeout = 1000;
    if (!connect.headers) {
       headerObject =  {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${connect.token}`
            }
    } 
    if (connect.hasOwnProperty('headers')) {
     headerObject = {
      ...connect.headers,
      'Authorization': `Bearer ${connect.token}`
     }
    
    }
    // console.log('Header object', headerObject)
    
    const config = {
      baseURL: connect.url,
      // timeout: timeout,
      headers: headerObject
    }

    if (connect.hasOwnProperty('responseType')) {
      // in case of response of 'arrayBuffer'
      config.responseType = connect.responseType;
    }

    const instance = axios.create(config);

      return instance;
}


  module.exports = {
    axiosInstance,
  }