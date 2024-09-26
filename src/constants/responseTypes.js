const responseObject = {
    INTERNAL_SERVER_ERROR: "InternalServerError",
    RECORD_NOT_FOUND: "RecordNotFound",
    RECORD_FOUND: "RecordFound",
    RECORD_DELETE: "RecordDelete",
    RECORD_CREATE: "RecordCreate",
    RECORD_IN_USE: "RecordInUse",
    IN_PROCESS_REJECTION: "InProcessRejection",
    API_RESPONSE_OK: "ResponseSuccessFromAPI", // for SAP api
    API_RESPONSE_NOT_OK: "ResponseFailFromAPI", // for SAP api
    RESPONSE_POSITIVE: "ResponsePositive",
    RESPONSE_NEGATIVE: "ResponseNegative",
    PARAMETER_MISSING: "ParameterMissing",
    WRONG_PARAMETER: "WrongParameter",
    TEST_CONNECTION_OK: "TestConnection",
    TEST_CONNECTION_NOT_OK: "TestConnection"
}


module.exports = {
    responseObject
}
