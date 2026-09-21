targetScope = 'subscription'

param location string = 'eastus2'
param resourceGroupName string = 'rg-aco-workshop'
param owner string
param securityControl string = 'Ignore'
param existingBlobRoleAssignmentName string = ''

var tags = { application: 'aco-interactive-workshop', environment: 'workshop', owner: owner, 'managed-by': 'bicep', SecurityControl: securityControl }

module group 'br/public:avm/res/resources/resource-group:0.4.4' = {
  name: 'workshop-group'
  params: { name: resourceGroupName, location: location, tags: tags, enableTelemetry: false }
}

module resources './resources.bicep' = {
  name: 'workshop-foundation'
  scope: resourceGroup(resourceGroupName)
  params: {
    location: location
    tags: tags
    existingBlobRoleAssignmentName: existingBlobRoleAssignmentName
  }
  dependsOn: [group]
}

output resources object = resources.outputs.resources