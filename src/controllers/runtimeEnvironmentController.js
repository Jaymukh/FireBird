// FOR now, runtime environment values is sent as this fixed JSON object
const getRuntimeEnvironmentValues = (req, res) => {
    const tenantId = req.params.tenantId;
    try {
        return res.status(200).json({
            "runtimeLocations": [
              {
                "id": "cloudintegration",
                "displayName": "Edge Integration Cell - null",
                "type": "SAP Cloud Integration",
                "typeId": "sapcloudintegration",
                "state": "Active"
              },
              {
                "id": "edgenodetanzu",
                "displayName": "Edge Integration Cell - edge-node-tanzu",
                "type": "Edge Integration Cell",
                "typeId": "neuronedge",
                "state": "Deactivated"
              },
              {
                "id": "edgenodetanzunew",
                "displayName": "Edge Integration Cell - edge-node-tanzu-new",
                "type": "Edge Integration Cell",
                "typeId": "neuronedge",
                "state": "Deactivated"
              },
              {
                "id": "edgenodeaksdev1",
                "displayName": "Edge Integration Cell - edge-node-aks-dev1",
                "type": "Edge Integration Cell",
                "typeId": "neuronedge",
                "state": "Active"
              },
              {
                "id": "edgenode02",
                "displayName": "Edge Integration Cell - edge-node-02",
                "type": "Edge Integration Cell",
                "typeId": "neuronedge",
                "state": "Deactivated"
              }
            ]
          })
    } catch(error) {
        console.log('Error in controller,getRuntimeEnvironmentValues: ', error)
    }
}

module.exports = {
    getRuntimeEnvironmentValues
}