targetScope = 'resourceGroup'

param appName string
param location string
param environmentId string
param acrLoginServer string
param defaultImageName string
param defaultImageTag string
param image string?
param uamiId string
param allowedIp string
param environmentStaticIp string

type SecretPair = {
  name: string
  uri: string
}

param secrets SecretPair[]

param botAliases string
param existingBuildHash string?
param existingBuildTime string?

var resolvedImage = image ?? '${acrLoginServer}/${defaultImageName}:${defaultImageTag}'

resource app 'Microsoft.App/containerapps@2025-02-02-preview' = {
  name: appName
  location: location
  tags: {
    'hidden-title': 'BananaNet - Brain'
  }
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${uamiId}': {}
    }
  }
  properties: {
    managedEnvironmentId: environmentId
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 80
        transport: 'Auto'
        allowInsecure: false
        traffic: [
          {
            weight: 100
            latestRevision: true
          }
        ]
        ipSecurityRestrictions: [
          {
            name: 'allow-owner'
            ipAddressRange: allowedIp
            action: 'Allow'
          }
          {
            name: 'allow-environment'
            ipAddressRange: '${environmentStaticIp}/32'
            action: 'Allow'
          }
        ]
      }
      registries: [
        {
          server: acrLoginServer
          identity: uamiId
        }
      ]
      secrets: [for secret in secrets: {
        name: secret.name
        keyVaultUrl: secret.uri
        identity: uamiId
      }]
    }
    template: {
      terminationGracePeriodSeconds: 300
      containers: [
        {
          name: 'brain'
          image: resolvedImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              secretRef: 'appinsightsconnectionstring'
            }
            {
              name: 'CLAUDE_CODE_OAUTH_TOKEN'
              secretRef: 'claudecodeoauthtoken'
            }
            {
              name: 'TZ'
              value: 'Australia/Melbourne'
            }
            {
              name: 'CLAUDE_CONFIG_DIR'
              value: '/home/bot/.claude'
            }
            {
              name: 'CLAUDE_SDK_CWD'
              value: '/sandbox'
            }
            {
              name: 'CALLBACK_HEADERS'
              secretRef: 'callbackheaders'
            }
            {
              name: 'BOT_ALIASES'
              value: botAliases
            }
            {
              name: 'BANANABOT_BUILD_HASH'
              value: existingBuildHash ?? ''
            }
            {
              name: 'BANANABOT_BUILD_TIME'
              value: existingBuildTime ?? ''
            }
          ]
          volumeMounts: [
            {
              volumeName: 'home'
              mountPath: '/home/bot'
            }
            {
              volumeName: 'sandbox'
              mountPath: '/sandbox'
            }
            {
              volumeName: 'audit'
              mountPath: '/audit'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 1
        cooldownPeriod: 300
        pollingInterval: 30
      }
      volumes: [
        {
          name: 'home'
          storageName: 'home'
          storageType: 'AzureFile'
        }
        {
          name: 'sandbox'
          storageName: 'sandbox'
          storageType: 'AzureFile'
        }
        {
          name: 'audit'
          storageName: 'audit'
          storageType: 'AzureFile'
        }
      ]
    }
  }
}

output name string = app.name
