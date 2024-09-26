const winston =require( 'winston');

// Create a Winston logger instance
const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
  ],
});

function logRequest(req, res, next) {
//   logger.info({message: "robust"})
logger.log({
    level: 'info',
    message: "hello, dis"
})
  next();
}

module.exports = logRequest;