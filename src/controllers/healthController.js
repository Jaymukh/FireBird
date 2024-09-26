async function healthCheck(req, res) {
    return res.status(200).json({ message: "I am alive"});
}

module.exports = {
    healthCheck
}