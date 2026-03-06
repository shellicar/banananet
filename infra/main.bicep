targetScope = 'resourceGroup'

param location string = 'australiaeast'
param locationCode string = 'aue'
param env string = 'dev'
param brainImageTag string = 'latest'
param earsImageTag string = 'latest'
param firstDeploy bool = false

// Secrets — passed via Key Vault refs in bicepparam
@secure()
param claudeCodeOauthToken string
@secure()
param discordToken string
@secure()
param brainKey string
param discordGuild string
param botAliases string = ''
@secure()
param callbackHeaders string

var org = 'sgh'
var project = 'banananet'

// Shared names (project-level, no segment)
var envName = '${org}-cae-${locationCode}-${env}-${project}-01'
var acrName = '${org}acr${locationCode}01'
var kvName = '${org}-kv-${locationCode}-${env}-${project}-01'

// Brain names (segment: brain / brn)
var brainAppName = '${org}-ca-${locationCode}-${env}-${project}-brain-01'
var brainStorageName = '${org}sa${locationCode}${env}${project}brn01'
var brainInsightsName = '${org}-appi-${locationCode}-${env}-${project}-brain-01'
var brainUamiName = '${org}-uami-${locationCode}-${env}-${project}-brain-01'
var brainImageName = '${project}-brain'
var brainShareNames = {
  home: 'home'
  sandbox: 'sandbox'
  audit: 'audit'
}

// Ears names (segment: ears / ers)
var earsAppName = '${org}-ca-${locationCode}-${env}-${project}-ears-01'
var earsInsightsName = '${org}-appi-${locationCode}-${env}-${project}-ears-01'
var earsUamiName = '${org}-uami-${locationCode}-${env}-${project}-ears-01'
var earsImageName = '${project}-ears'

// ──────────────────────────────────────────────
// External references
// ──────────────────────────────────────────────

resource logs 'Microsoft.OperationalInsights/workspaces@2025-07-01' existing = {
  name: 'DefaultWorkspace-383d501b-3906-496b-ac90-e336189d628f-EAU'
  scope: resourceGroup('383d501b-3906-496b-ac90-e336189d628f', 'DefaultResourceGroup-EAU')
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
  scope: resourceGroup('383d501b-3906-496b-ac90-e336189d628f', 'CentralRG')
}

resource acrPullRole 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  name: '7f951dda-4ed3-4680-a7ca-43fe172d538d'
  scope: subscription()
}

// ──────────────────────────────────────────────
// Shared resources
// ──────────────────────────────────────────────

module containerEnv 'modules/container-apps-env.bicep' = {
  name: '${deployment().name}-env'
  params: {
    envName: envName
    location: location
    logAnalyticsCustomerId: logs.properties.customerId
    logAnalyticsSharedKey: logs.listKeys().primarySharedKey
    storageName: brainStorage.outputs.name
    homeShareName: brainShareNames.home
    sandboxShareName: brainShareNames.sandbox
    auditShareName: brainShareNames.audit
  }
}

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: kvName
  location: location
  tags: {
    'hidden-title': 'BananaNet - Key Vault'
  }
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
  }
}

// ──────────────────────────────────────────────
// Brain resources
// ──────────────────────────────────────────────

resource brainUami 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: brainUamiName
  location: location
  tags: {
    'hidden-title': 'BananaNet - Brain - Managed Identity'
  }
}

module brainInsights 'br/public:avm/res/insights/component:0.6.0' = {
  name: '${deployment().name}-brain-insights'
  params: {
    name: brainInsightsName
    location: location
    tags: {
      'hidden-title': 'BananaNet - Brain - Application Insights'
    }
    workspaceResourceId: logs.id
    kind: 'web'
    applicationType: 'web'
    retentionInDays: 30
    samplingPercentage: 100
  }
}

module brainStorage 'br/public:avm/res/storage/storage-account:0.26.2' = {
  name: '${deployment().name}-brain-storage'
  params: {
    name: brainStorageName
    location: location
    tags: {
      'hidden-title': 'BananaNet - Brain - Storage'
    }
    skuName: 'Standard_LRS'
    kind: 'StorageV2'
    requireInfrastructureEncryption: false
    allowBlobPublicAccess: false
    networkAcls: {
      defaultAction: 'Allow'
    }
    blobServices: {}
    fileServices: {
      shares: [
        {
          name: brainShareNames.home
          shareQuota: 5
        }
        {
          name: brainShareNames.sandbox
          shareQuota: 5
        }
        {
          name: brainShareNames.audit
          shareQuota: 5
        }
      ]
    }
  }
}

resource brainStorageRef 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: brainStorageName
  dependsOn: [brainStorage]
}

resource brainAppRef 'Microsoft.App/containerapps@2025-02-02-preview' existing = if (!firstDeploy) {
  name: brainAppName
}

var brainExistingEnv = brainAppRef.?properties.template.containers[0].env ?? []
var buildHashMatches = map(filter(brainExistingEnv, e => e.name == 'BANANABOT_BUILD_HASH'), x => x.value) ?? []
var buildTimeMatches = map(filter(brainExistingEnv, e => e.name == 'BANANABOT_BUILD_TIME'), x => x.value) ?? []
var existingBuildHash = first(buildHashMatches)
var existingBuildTime = first(buildTimeMatches)

module brainApp 'modules/container-app-brain.bicep' = {
  name: '${deployment().name}-brain-app'
  params: {
    appName: brainAppName
    location: location
    environmentId: containerEnv.outputs.id
    acrLoginServer: acr.properties.loginServer
    image: brainAppRef.?properties.template.containers[0].image
    defaultImageName: brainImageName
    defaultImageTag: brainImageTag
    uamiId: brainUami.id
    insightsConnectionString: brainInsights.outputs.connectionString
    storageConnectionString: 'DefaultEndpointsProtocol=https;AccountName=${brainStorageRef.name};AccountKey=${brainStorageRef.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
    claudeCodeOauthToken: claudeCodeOauthToken
    callbackHeaders: callbackHeaders
    existingBuildHash: existingBuildHash
    existingBuildTime: existingBuildTime
  }
}

module brainAcrRole 'modules/acr-role-assignment.bicep' = {
  name: '${deployment().name}-brain-acr-role'
  scope: resourceGroup('383d501b-3906-496b-ac90-e336189d628f', 'CentralRG')
  params: {
    acrName: acrName
    principalId: brainUami.properties.principalId
    roleDefinitionId: acrPullRole.id
  }
}

module brainAssignment 'modules/assignment.bicep' = {
  name: '${deployment().name}-brain-assignment'
  params: {
    principalIds: [brainUami.properties.principalId]
    storageName: brainStorage.outputs.name
    insightsName: brainInsightsName
  }
}

// ──────────────────────────────────────────────
// Ears resources
// ──────────────────────────────────────────────

resource earsUami 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: earsUamiName
  location: location
  tags: {
    'hidden-title': 'BananaNet - Ears - Managed Identity'
  }
}

module earsInsights 'br/public:avm/res/insights/component:0.6.0' = {
  name: '${deployment().name}-ears-insights'
  params: {
    name: earsInsightsName
    location: location
    tags: {
      'hidden-title': 'BananaNet - Ears - Application Insights'
    }
    workspaceResourceId: logs.id
    kind: 'web'
    applicationType: 'web'
    retentionInDays: 30
    samplingPercentage: 100
  }
}

resource earsAppRef 'Microsoft.App/containerapps@2025-02-02-preview' existing = if (!firstDeploy) {
  name: earsAppName
}

module earsApp 'modules/container-app-ears.bicep' = {
  name: '${deployment().name}-ears-app'
  params: {
    appName: earsAppName
    location: location
    environmentId: containerEnv.outputs.id
    acrLoginServer: acr.properties.loginServer
    image: earsAppRef.?properties.template.containers[0].image
    defaultImageName: earsImageName
    defaultImageTag: earsImageTag
    uamiId: earsUami.id
    insightsConnectionString: earsInsights.outputs.connectionString
    discordToken: discordToken
    discordGuild: discordGuild
    brainUrl: 'https://${brainApp.outputs.fqdn}'
    brainKey: brainKey
    sandboxEnabled: 'true'
    botAliases: botAliases
  }
}

module earsAcrRole 'modules/acr-role-assignment.bicep' = {
  name: '${deployment().name}-ears-acr-role'
  scope: resourceGroup('383d501b-3906-496b-ac90-e336189d628f', 'CentralRG')
  params: {
    acrName: acrName
    principalId: earsUami.properties.principalId
    roleDefinitionId: acrPullRole.id
  }
}

module earsAssignment 'modules/assignment-insights.bicep' = {
  name: '${deployment().name}-ears-assignment'
  params: {
    principalIds: [earsUami.properties.principalId]
    insightsName: earsInsightsName
  }
}

// ──────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────

output brainAppName string = brainApp.outputs.name
output brainAppUrl string = 'https://${brainApp.outputs.fqdn}'
output brainStorageName string = brainStorage.outputs.name
output brainUamiClientId string = brainUami.properties.clientId
output earsAppName string = earsApp.outputs.name
output earsUamiClientId string = earsUami.properties.clientId
output kvName string = kv.name
