param location string
param tags object
param existingBlobRoleAssignmentName string = ''
var suffix = uniqueString(resourceGroup().id)
var registryName = 'acoworkshop${suffix}'
var storageName = 'acowork${suffix}'
var logsName = 'log-aco-workshop'
var environmentName = 'cae-aco-workshop'
var networkName = 'vnet-aco-workshop'
var infrastructureSubnetName = 'snet-container-apps'
var privateEndpointSubnetName = 'snet-private-endpoints'
var blobPrivateDnsZoneName = 'privatelink.blob.${az.environment().suffixes.storage}'
var tablePrivateDnsZoneName = 'privatelink.table.${az.environment().suffixes.storage}'
var blobDataContributorRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
var tableDataContributorRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3')
var identityResourceId = resourceId('Microsoft.ManagedIdentity/userAssignedIdentities', 'id-aco-workshop')

module identity 'br/public:avm/res/managed-identity/user-assigned-identity:0.6.0' = {
  name: 'workshop-identity'
  params: { name: 'id-aco-workshop', location: location, tags: tags, enableTelemetry: false }
}
module registry 'br/public:avm/res/container-registry/registry:0.13.1' = {
  name: 'workshop-registry'
  params: {
    name: registryName
    location: location
    tags: tags
    enableTelemetry: false
    acrSku: 'Basic'
    acrAdminUserEnabled: false
    networkRuleSetDefaultAction: 'Allow'
    publicNetworkAccess: 'Enabled'
    roleAssignments: [{ principalId: identity.outputs.principalId, principalType: 'ServicePrincipal', roleDefinitionIdOrName: 'AcrPull' }]
  }
}
resource network 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: networkName
  location: location
  tags: tags
  properties: {
    addressSpace: { addressPrefixes: ['10.42.0.0/16'] }
    subnets: [
      {
        name: infrastructureSubnetName
        properties: {
          addressPrefix: '10.42.0.0/23'
          delegations: [{ name: 'container-apps', properties: { serviceName: 'Microsoft.App/environments' } }]
        }
      }
      {
        name: privateEndpointSubnetName
        properties: {
          addressPrefix: '10.42.2.0/24'
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}
module storage 'br/public:avm/res/storage/storage-account:0.33.1' = {
  name: 'workshop-storage'
  params: {
    name: storageName
    location: location
    tags: tags
    enableTelemetry: false
    skuName: 'Standard_LRS'
    kind: 'StorageV2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    publicNetworkAccess: 'Disabled'
    networkAcls: { defaultAction: 'Deny', bypass: 'None' }
    blobServices: {
      containerDeleteRetentionPolicyEnabled: true
      containerDeleteRetentionPolicyDays: 7
      deleteRetentionPolicyEnabled: true
      deleteRetentionPolicyDays: 7
    }
  }
}
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageName
}
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' existing = {
  parent: storageAccount
  name: 'default'
}
resource screenshots 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'screenshots'
  properties: { publicAccess: 'None' }
  dependsOn: [storage]
}
resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
  properties: {}
  dependsOn: [storage]
}
resource workshopTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'workshop'
  properties: {}
}
resource blobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: empty(existingBlobRoleAssignmentName) ? guid(screenshots.id, identityResourceId, blobDataContributorRoleId) : existingBlobRoleAssignmentName
  scope: screenshots
  properties: {
    principalId: identity.outputs.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: blobDataContributorRoleId
  }
}
resource tableRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(workshopTable.id, identityResourceId, tableDataContributorRoleId)
  scope: workshopTable
  properties: {
    principalId: identity.outputs.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: tableDataContributorRoleId
  }
}
resource blobPrivateDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: blobPrivateDnsZoneName
  location: 'global'
  tags: tags
}
resource blobPrivateDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: blobPrivateDnsZone
  name: 'workshop-network'
  location: 'global'
  properties: { registrationEnabled: false, virtualNetwork: { id: network.id } }
}
resource tablePrivateDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: tablePrivateDnsZoneName
  location: 'global'
  tags: tags
}
resource tablePrivateDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: tablePrivateDnsZone
  name: 'workshop-network'
  location: 'global'
  properties: { registrationEnabled: false, virtualNetwork: { id: network.id } }
}
resource blobPrivateEndpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: 'pe-${storageName}-blob'
  location: location
  tags: tags
  properties: {
    subnet: { id: resourceId('Microsoft.Network/virtualNetworks/subnets', network.name, privateEndpointSubnetName) }
    privateLinkServiceConnections: [{ name: 'blob', properties: { privateLinkServiceId: storageAccount.id, groupIds: ['blob'] } }]
  }
  dependsOn: [storage]
}
resource blobPrivateDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: blobPrivateEndpoint
  name: 'default'
  properties: { privateDnsZoneConfigs: [{ name: 'blob', properties: { privateDnsZoneId: blobPrivateDnsZone.id } }] }
}
resource tablePrivateEndpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: 'pe-${storageName}-table'
  location: location
  tags: tags
  properties: {
    subnet: { id: resourceId('Microsoft.Network/virtualNetworks/subnets', network.name, privateEndpointSubnetName) }
    privateLinkServiceConnections: [{ name: 'table', properties: { privateLinkServiceId: storageAccount.id, groupIds: ['table'] } }]
  }
  dependsOn: [storage]
}
resource tablePrivateDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: tablePrivateEndpoint
  name: 'default'
  properties: { privateDnsZoneConfigs: [{ name: 'table', properties: { privateDnsZoneId: tablePrivateDnsZone.id } }] }
}
module logs 'br/public:avm/res/operational-insights/workspace:0.16.1' = {
  name: 'workshop-logs'
  params: { name: logsName, location: location, tags: tags, enableTelemetry: false, skuName: 'PerGB2018', dataRetention: 30, dailyQuotaGb: '1' }
}
module environment 'br/public:avm/res/app/managed-environment:0.16.0' = {
  name: 'workshop-environment'
  params: {
    name: environmentName
    location: location
    tags: tags
    enableTelemetry: false
    zoneRedundant: false
    appLogsConfiguration: { destination: 'log-analytics', logAnalyticsWorkspaceResourceId: logs.outputs.resourceId }
    infrastructureSubnetResourceId: resourceId('Microsoft.Network/virtualNetworks/subnets', network.name, infrastructureSubnetName)
    internal: false
    publicNetworkAccess: 'Enabled'
    workloadProfiles: [{ name: 'Consumption', workloadProfileType: 'Consumption' }]
  }
}
output resources object = {
  registryName: registryName
  registryServer: '${registryName}.azurecr.io'
  storageName: storageName
  blobEndpoint: 'https://${storageName}.blob.${az.environment().suffixes.storage}'
  tableEndpoint: 'https://${storageName}.table.${az.environment().suffixes.storage}'
  tableName: 'workshop'
  identityId: identity.outputs.resourceId
  identityClientId: identity.outputs.clientId
  identityPrincipalId: identity.outputs.principalId
  environmentId: environment.outputs.resourceId
  environmentDomain: environment.outputs.defaultDomain
}