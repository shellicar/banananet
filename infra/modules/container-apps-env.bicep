targetScope = 'resourceGroup'

param envName string
param location string
param logAnalyticsCustomerId string
@secure()
param logAnalyticsSharedKey string
param storageName string
param homeShareName string
param sandboxShareName string
param auditShareName string

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageName
}

resource env 'Microsoft.App/managedEnvironments@2025-02-02-preview' = {
  name: envName
  location: location
  tags: {
    'hidden-title': 'BananaNet - Container Apps Environment'
  }
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsCustomerId
        sharedKey: logAnalyticsSharedKey
      }
    }
    workloadProfiles: [
      {
        workloadProfileType: 'Consumption'
        name: 'Consumption'
      }
    ]
    peerTrafficConfiguration: {
      encryption: {
        enabled: true
      }
    }
    publicNetworkAccess: 'Enabled'
    zoneRedundant: false
  }

  resource homeStorage 'storages' = {
    name: 'home'
    properties: {
      azureFile: {
        accessMode: 'ReadWrite'
        accountKey: storage.listKeys().keys[0].value
        accountName: storage.name
        shareName: homeShareName
      }
    }
  }

  resource sandboxStorage 'storages' = {
    name: 'sandbox'
    properties: {
      azureFile: {
        accessMode: 'ReadWrite'
        accountKey: storage.listKeys().keys[0].value
        accountName: storage.name
        shareName: sandboxShareName
      }
    }
  }

  resource auditStorage 'storages' = {
    name: 'audit'
    properties: {
      azureFile: {
        accessMode: 'ReadWrite'
        accountKey: storage.listKeys().keys[0].value
        accountName: storage.name
        shareName: auditShareName
      }
    }
  }
}

output id string = env.id
output name string = env.name
output defaultDomain string = env.properties.defaultDomain
output staticIp string = env.properties.staticIp
