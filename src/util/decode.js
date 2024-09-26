const crypto = require("crypto");
const config = require("../constants/decodeConfig");

const { secret_key, secret_iv, ecnryption_method } = config

if (!secret_key || !secret_iv || !ecnryption_method) {
  throw new Error('secretKey, secretIV, and ecnryptionMethod are required')
}

// Generate secret hash with crypto to use for encryption
const key = crypto.createHash('sha512')
  .update(secret_key)
  .digest('hex')
  .substring(0, 32);

// const encryptionIV = crypto.createHash('sha512')
//   .update(secret_iv)
//   .digest('hex')
//   .substring(0, 16);

const getEncryptionIV = (SECRET_IV) => {
  const encryptionIV = crypto.createHash('sha512')
  .update(SECRET_IV)
  .digest('hex')
  .substring(0, 16);

  return encryptionIV;
}

function encryptData(data, encryptionIV) {
const cipher = crypto.createCipheriv(ecnryption_method, key, encryptionIV)
return Buffer.from(
    cipher.update(data, 'utf8', 'hex') + cipher.final('hex')
).toString('base64') // Encrypts data and converts to hex and base64
} 

function decryptData(encryptedData, encryptionIV) {
const buff = Buffer.from(encryptedData, 'base64')
const decipher = crypto.createDecipheriv(ecnryption_method, key, encryptionIV)
return (
    decipher.update(buff.toString('utf8'), 'hex', 'utf8') +
    decipher.final('utf8')
) // Decrypts data and converts to utf8
}

module.exports = {
    encryptData,
    decryptData,
    getEncryptionIV
}