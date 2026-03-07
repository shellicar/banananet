targetScope = 'resourceGroup'

param location string = 'australiaeast'
@maxLength(3)
param locationCode string = 'aue'
@maxLength(3)
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
param botAliases string
@secure()
param callbackHeaders string
param allowedIp string

@maxLength(3)
param org string = 'sgh'
@maxLength(9)
param project string = 'banananet'
@maxLength(3)
param projectShort string = 'bnn'

@maxLength(3)
param brainSegment string = 'brn'
@maxLength(3)
param earsSegment string = 'ear'

// Shared names (project-level, no segment)
@maxLength(60)
param envName string = '${org}-cae-${locationCode}-${env}-${projectShort}-01'
@maxLength(50)
param acrName string = '${org}acr${locationCode}01'
@maxLength(24)
param kvName string = '${org}kv${locationCode}${env}${projectShort}01'

// Brain names
@maxLength(32)
param brainAppName string = '${org}-ca-${locationCode}-${env}-${projectShort}-${brainSegment}-01'
@maxLength(24)
param brainStorageName string = '${org}sa${locationCode}${env}${projectShort}${brainSegment}01'
@maxLength(260)
param brainInsightsName string = '${org}-appi-${locationCode}-${env}-${projectShort}-${brainSegment}-01'
@maxLength(128)
param brainUamiName string = '${org}-uami-${locationCode}-${env}-${projectShort}-${brainSegment}-01'
param brainImageName string = '${project}-brain'

var brainShareNames = {
  home: 'home'
  sandbox: 'sandbox'
  audit: 'audit'
}

// Ears names
@maxLength(32)
param earsAppName string = '${org}-ca-${locationCode}-${env}-${projectShort}-${earsSegment}-01'
@maxLength(260)
param earsInsightsName string = '${org}-appi-${locationCode}-${env}-${projectShort}-${earsSegment}-01'
@maxLength(128)
param earsUamiName string = '${org}-uami-${locationCode}-${env}-${projectShort}-${earsSegment}-01'
param earsImageName string = '${project}-ears'

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

  resource claudeOauth 'secrets' = {
    name: 'claude-code-oauth-token'
    properties: {
      value: claudeCodeOauthToken
    }
  }

  resource callbackHeadersSecret 'secrets' = {
    name: 'callback-headers'
    properties: {
      value: callbackHeaders
    }
  }

  resource discordTokenSecret 'secrets' = {
    name: 'discord-token'
    properties: {
      value: discordToken
    }
  }

  resource brainKeySecret 'secrets' = {
    name: 'brain-key'
    properties: {
      value: brainKey
    }
  }

  resource storageConnection 'secrets' = {
    name: 'azure-webjobs-storage'
    properties: {
      value: 'DefaultEndpointsProtocol=https;AccountName=${brainStorageRef.name};AccountKey=${brainStorageRef.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
    }
  }

  resource brainInsightsSecret 'secrets' = {
    name: 'app-insights-brain'
    properties: {
      value: brainInsights.outputs.connectionString
    }
  }

  resource earsInsightsSecret 'secrets' = {
    name: 'app-insights-ears'
    properties: {
      value: earsInsights.outputs.connectionString
    }
  }
}

// Key Vault Secrets User role
resource kvSecretsUserRole 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  name: '4633458b-17de-408a-b874-0445c86b69e6'
  scope: subscription()
}

resource brainKvAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, brainUami.id, kvSecretsUserRole.id)
  scope: kv
  properties: {
    roleDefinitionId: kvSecretsUserRole.id
    principalId: brainUami.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource earsKvAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, earsUami.id, kvSecretsUserRole.id)
  scope: kv
  properties: {
    roleDefinitionId: kvSecretsUserRole.id
    principalId: earsUami.properties.principalId
    principalType: 'ServicePrincipal'
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
    allowedIp: allowedIp
    environmentStaticIp: containerEnv.outputs.staticIp
    secrets: [
      { name: 'azurewebjobsstorage', uri: kv::storageConnection.properties.secretUriWithVersion }
      { name: 'appinsightsconnectionstring', uri: kv::brainInsightsSecret.properties.secretUriWithVersion }
      { name: 'claudecodeoauthtoken', uri: kv::claudeOauth.properties.secretUriWithVersion }
      { name: 'callbackheaders', uri: kv::callbackHeadersSecret.properties.secretUriWithVersion }
    ]
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
    allowedIp: allowedIp
    environmentStaticIp: containerEnv.outputs.staticIp
    secrets: [
      { name: 'appinsightsconnectionstring', uri: kv::earsInsightsSecret.properties.secretUriWithVersion }
      { name: 'discordtoken', uri: kv::discordTokenSecret.properties.secretUriWithVersion }
      { name: 'brainkey', uri: kv::brainKeySecret.properties.secretUriWithVersion }
    ]
    discordGuild: discordGuild
    brainUrl: 'https://${brainAppName}.internal.${containerEnv.outputs.defaultDomain}/api'
    sandboxEnabled: 'true'
    botAliases: botAliases
    callbackHost: 'https://${earsAppName}.internal.${containerEnv.outputs.defaultDomain}/api'
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
