param location string = 'eastus2'
param name string = 'aco-workshop-guide'
param foundation object
@minLength(20)
param imageDigest string
@secure()
param inviteCode string
param revisionSuffix string
param owner string
param securityControl string = 'Ignore'
param tenantId string
param ownerObjectId string
param entraClientId string
@secure()
param entraClientSecret string

module app 'br/public:avm/res/app/container-app:0.23.0' = {
  name: 'interactive-workshop-app'
  params: {
    name: name
    location: location
    tags: { application: 'aco-interactive-workshop', environment: 'workshop', owner: owner, 'managed-by': 'bicep', SecurityControl: securityControl }
    enableTelemetry: false
    environmentResourceId: foundation.environmentId
    workloadProfileName: 'Consumption'
    managedIdentities: { userAssignedResourceIds: [foundation.identityId] }
    activeRevisionsMode: 'Single'
    revisionSuffix: revisionSuffix
    ingressExternal: true
    ingressAllowInsecure: false
    ingressTargetPort: 4310
    ingressTransport: 'auto'
    scaleSettings: { minReplicas: 1, maxReplicas: 1 }
    registries: [{ server: foundation.registryServer, identity: foundation.identityId }]
    secrets: [
      { name: 'workshop-invite', value: inviteCode }
      { name: 'entra-client-secret', value: entraClientSecret }
    ]
    containers: [{
      name: 'guide'
      image: imageDigest
      resources: { cpu: json('0.5'), memory: '1Gi' }
      env: [
        { name: 'NODE_ENV', value: 'production' }
        { name: 'PORT', value: '4310' }
        { name: 'WORKSHOP_HOST', value: '0.0.0.0' }
        { name: 'WORKSHOP_STORAGE', value: 'table' }
        { name: 'WORKSHOP_ORIGIN', value: 'https://${name}.${foundation.environmentDomain}' }
        { name: 'WORKSHOP_SECURE_COOKIES', value: 'true' }
        { name: 'WORKSHOP_TRUST_PROXY', value: 'true' }
        { name: 'WORKSHOP_INVITE_CODE', secretRef: 'workshop-invite' }
        { name: 'WORKSHOP_BLOB_ENDPOINT', value: foundation.blobEndpoint }
        { name: 'WORKSHOP_TABLE_ENDPOINT', value: foundation.tableEndpoint }
        { name: 'WORKSHOP_TABLE_NAME', value: foundation.tableName }
        { name: 'WORKSHOP_OWNER_OBJECT_ID', value: ownerObjectId }
        { name: 'AZURE_CLIENT_ID', value: foundation.identityClientId }
      ]
      probes: [
        { type: 'Liveness', tcpSocket: { port: 4310 }, initialDelaySeconds: 30, periodSeconds: 20 }
        { type: 'Readiness', httpGet: { path: '/health/ready', port: 4310, httpHeaders: [{ name: 'Host', value: '${name}.${foundation.environmentDomain}' }] }, initialDelaySeconds: 15, periodSeconds: 30, timeoutSeconds: 10, failureThreshold: 3 }
      ]
    }]
  }
}
resource deployedApp 'Microsoft.App/containerApps@2024-03-01' existing = {
  name: name
}
resource auth 'Microsoft.App/containerApps/authConfigs@2024-03-01' = {
  parent: deployedApp
  name: 'current'
  properties: {
    platform: { enabled: true }
    globalValidation: {
      unauthenticatedClientAction: 'RedirectToLoginPage'
      redirectToProvider: 'azureactivedirectory'
      excludedPaths: ['/health/live', '/health/ready']
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          clientId: entraClientId
          clientSecretSettingName: 'entra-client-secret'
          openIdIssuer: '${az.environment().authentication.loginEndpoint}${tenantId}/v2.0'
        }
        validation: { allowedAudiences: [entraClientId] }
      }
    }
  }
  dependsOn: [app]
}
output url string = 'https://${app.outputs.fqdn}'