const sendResponse = (
    res, 
    success = false, 
    statusCode = 500, 
    type="InternalServerError", 
    message = "Internal Server Error",
    data
) => {
    
        let responseObject = {
            success: success,
            statusCode: statusCode,
            type: type
        }

        if (success === true) {
            responseObject.message = message;
            responseObject.data = data;
           
        } else {
            responseObject.error = {
                message: message
            }
        }

        if ( statusCode === 204 && type === "RecordDelete") {
            return res.status(204).json({message: 'Record deleted successfully'})
        }
        // console.log('Response Object: ', responseObject)w

        return res.status(statusCode).json(responseObject);

}

module.exports = {
    sendResponse
}