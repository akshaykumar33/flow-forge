import type { GenericTerm, ProviderId, ServiceEntry } from './types.js';

const azure = (
  slug: string,
  name: string,
  category: ServiceEntry['category'],
  aliases: string[],
  docsPath: string,
): ServiceEntry => ({
  id: `azure.${slug}`,
  provider: 'azure',
  name,
  category,
  aliases,
  docsUrl: `https://learn.microsoft.com/azure/${docsPath}`,
});

const aws = (
  slug: string,
  name: string,
  category: ServiceEntry['category'],
  aliases: string[],
  docsPath: string,
): ServiceEntry => ({
  id: `aws.${slug}`,
  provider: 'aws',
  name,
  category,
  aliases,
  docsUrl: `https://aws.amazon.com/${docsPath}`,
});

const gcp = (
  slug: string,
  name: string,
  category: ServiceEntry['category'],
  aliases: string[],
  docsPath: string,
): ServiceEntry => ({
  id: `gcp.${slug}`,
  provider: 'gcp',
  name,
  category,
  aliases,
  docsUrl: `https://cloud.google.com/${docsPath}`,
});

/**
 * Curated, not exhaustive: the services most often drawn in architecture diagrams. Aliases are
 * deliberately conservative; a phrase shared by two providers (for example "api gateway") is
 * listed under both, and the recogniser treats it as ambiguous unless context decides.
 */
export const SERVICES: readonly ServiceEntry[] = [
  azure(
    'app-service',
    'Azure App Service',
    'compute',
    ['azure app service', 'app service', 'web app for containers'],
    'app-service/',
  ),
  azure(
    'functions',
    'Azure Functions',
    'serverless',
    ['azure functions', 'azure function', 'function app'],
    'azure-functions/',
  ),
  azure(
    'aks',
    'Azure Kubernetes Service',
    'containers',
    ['azure kubernetes service', 'aks'],
    'aks/',
  ),
  azure(
    'container-apps',
    'Azure Container Apps',
    'containers',
    ['azure container apps', 'container apps'],
    'container-apps/',
  ),
  azure(
    'virtual-machines',
    'Azure Virtual Machines',
    'compute',
    ['azure virtual machines', 'azure vm', 'azure vms'],
    'virtual-machines/',
  ),
  azure(
    'sql-database',
    'Azure SQL Database',
    'database',
    ['azure sql database', 'azure sql db', 'azure sql'],
    'azure-sql/database/',
  ),
  azure(
    'cosmos-db',
    'Azure Cosmos DB',
    'database',
    ['azure cosmos db', 'cosmos db', 'cosmosdb'],
    'cosmos-db/',
  ),
  azure(
    'blob-storage',
    'Azure Blob Storage',
    'storage',
    ['azure blob storage', 'blob storage'],
    'storage/blobs/',
  ),
  azure(
    'storage-account',
    'Azure Storage Account',
    'storage',
    ['azure storage account', 'storage account'],
    'storage/common/storage-account-overview',
  ),
  azure(
    'service-bus',
    'Azure Service Bus',
    'messaging',
    ['azure service bus', 'service bus'],
    'service-bus-messaging/',
  ),
  azure(
    'event-hubs',
    'Azure Event Hubs',
    'messaging',
    ['azure event hubs', 'event hubs', 'event hub'],
    'event-hubs/',
  ),
  azure(
    'event-grid',
    'Azure Event Grid',
    'messaging',
    ['azure event grid', 'event grid'],
    'event-grid/',
  ),
  azure(
    'front-door',
    'Azure Front Door',
    'networking',
    ['azure front door', 'front door'],
    'frontdoor/',
  ),
  azure(
    'application-gateway',
    'Azure Application Gateway',
    'networking',
    ['azure application gateway', 'application gateway', 'app gateway'],
    'application-gateway/',
  ),
  azure(
    'virtual-network',
    'Azure Virtual Network',
    'networking',
    ['azure virtual network', 'azure vnet', 'vnet'],
    'virtual-network/',
  ),
  azure('key-vault', 'Azure Key Vault', 'security', ['azure key vault', 'key vault'], 'key-vault/'),
  azure(
    'api-management',
    'Azure API Management',
    'integration',
    ['azure api management', 'api management', 'apim'],
    'api-management/',
  ),
  azure(
    'monitor',
    'Azure Monitor',
    'monitoring',
    ['azure monitor', 'application insights', 'app insights'],
    'azure-monitor/',
  ),
  azure(
    'cache-for-redis',
    'Azure Cache for Redis',
    'cache',
    ['azure cache for redis', 'azure redis'],
    'azure-cache-for-redis/',
  ),
  {
    id: 'azure.entra-id',
    provider: 'azure',
    name: 'Microsoft Entra ID',
    category: 'identity',
    aliases: ['microsoft entra id', 'entra id', 'azure active directory', 'azure ad'],
    docsUrl: 'https://learn.microsoft.com/entra/identity/',
  },

  aws('ec2', 'Amazon EC2', 'compute', ['amazon ec2', 'aws ec2', 'ec2'], 'ec2/'),
  aws('lambda', 'AWS Lambda', 'serverless', ['aws lambda', 'lambda function', 'lambda'], 'lambda/'),
  aws(
    'ecs',
    'Amazon ECS',
    'containers',
    ['amazon ecs', 'aws ecs', 'elastic container service'],
    'ecs/',
  ),
  aws(
    'eks',
    'Amazon EKS',
    'containers',
    ['amazon eks', 'aws eks', 'eks', 'elastic kubernetes service'],
    'eks/',
  ),
  aws('s3', 'Amazon S3', 'storage', ['amazon s3', 'aws s3', 's3 bucket', 's3'], 's3/'),
  aws('rds', 'Amazon RDS', 'database', ['amazon rds', 'aws rds', 'rds'], 'rds/'),
  aws(
    'aurora',
    'Amazon Aurora',
    'database',
    ['amazon aurora', 'aws aurora', 'aurora'],
    'rds/aurora/',
  ),
  aws(
    'dynamodb',
    'Amazon DynamoDB',
    'database',
    ['amazon dynamodb', 'aws dynamodb', 'dynamodb'],
    'dynamodb/',
  ),
  aws('sqs', 'Amazon SQS', 'messaging', ['amazon sqs', 'aws sqs', 'sqs'], 'sqs/'),
  aws('sns', 'Amazon SNS', 'messaging', ['amazon sns', 'aws sns', 'sns'], 'sns/'),
  aws(
    'eventbridge',
    'Amazon EventBridge',
    'messaging',
    ['amazon eventbridge', 'aws eventbridge', 'eventbridge'],
    'eventbridge/',
  ),
  aws(
    'kinesis',
    'Amazon Kinesis',
    'analytics',
    ['amazon kinesis', 'aws kinesis', 'kinesis'],
    'kinesis/',
  ),
  aws(
    'cloudfront',
    'Amazon CloudFront',
    'networking',
    ['amazon cloudfront', 'aws cloudfront', 'cloudfront'],
    'cloudfront/',
  ),
  aws(
    'api-gateway',
    'Amazon API Gateway',
    'integration',
    ['amazon api gateway', 'aws api gateway', 'api gateway'],
    'api-gateway/',
  ),
  aws('vpc', 'Amazon VPC', 'networking', ['amazon vpc', 'aws vpc', 'vpc'], 'vpc/'),
  aws(
    'route-53',
    'Amazon Route 53',
    'networking',
    ['amazon route 53', 'aws route 53', 'route 53', 'route53'],
    'route53/',
  ),
  aws('iam', 'AWS IAM', 'identity', ['aws iam', 'iam'], 'iam/'),
  aws(
    'cognito',
    'Amazon Cognito',
    'identity',
    ['amazon cognito', 'aws cognito', 'cognito'],
    'cognito/',
  ),
  aws(
    'cloudwatch',
    'Amazon CloudWatch',
    'monitoring',
    ['amazon cloudwatch', 'aws cloudwatch', 'cloudwatch'],
    'cloudwatch/',
  ),
  aws(
    'elasticache',
    'Amazon ElastiCache',
    'cache',
    ['amazon elasticache', 'aws elasticache', 'elasticache'],
    'elasticache/',
  ),

  gcp(
    'compute-engine',
    'Compute Engine',
    'compute',
    ['google compute engine', 'gcp compute engine', 'compute engine', 'gce'],
    'products/compute',
  ),
  gcp(
    'cloud-run',
    'Cloud Run',
    'serverless',
    ['google cloud run', 'gcp cloud run', 'cloud run'],
    'run',
  ),
  gcp(
    'cloud-functions',
    'Cloud Run functions',
    'serverless',
    ['google cloud functions', 'gcp cloud functions', 'cloud functions', 'cloud run functions'],
    'functions',
  ),
  gcp(
    'gke',
    'Google Kubernetes Engine',
    'containers',
    ['google kubernetes engine', 'gke'],
    'kubernetes-engine',
  ),
  gcp(
    'cloud-storage',
    'Cloud Storage',
    'storage',
    ['google cloud storage', 'gcp cloud storage', 'gcs'],
    'storage',
  ),
  gcp(
    'cloud-sql',
    'Cloud SQL',
    'database',
    ['google cloud sql', 'gcp cloud sql', 'cloud sql'],
    'sql',
  ),
  gcp(
    'firestore',
    'Firestore',
    'database',
    ['google firestore', 'cloud firestore', 'firestore'],
    'firestore',
  ),
  gcp(
    'bigtable',
    'Bigtable',
    'database',
    ['google bigtable', 'cloud bigtable', 'bigtable'],
    'bigtable',
  ),
  gcp(
    'spanner',
    'Spanner',
    'database',
    ['google cloud spanner', 'cloud spanner', 'spanner'],
    'spanner',
  ),
  gcp(
    'pubsub',
    'Pub/Sub',
    'messaging',
    ['google pub/sub', 'google pubsub', 'cloud pub/sub', 'pub/sub', 'pubsub'],
    'pubsub',
  ),
  gcp('bigquery', 'BigQuery', 'analytics', ['google bigquery', 'bigquery'], 'bigquery'),
  gcp('cloud-cdn', 'Cloud CDN', 'networking', ['google cloud cdn', 'cloud cdn'], 'cdn'),
  gcp(
    'cloud-load-balancing',
    'Cloud Load Balancing',
    'networking',
    ['google cloud load balancing', 'cloud load balancing'],
    'load-balancing',
  ),
  gcp('vpc', 'Virtual Private Cloud', 'networking', ['google vpc', 'gcp vpc', 'vpc'], 'vpc'),
  gcp(
    'iam',
    'Identity and Access Management',
    'identity',
    ['google iam', 'gcp iam', 'cloud iam', 'iam'],
    'iam',
  ),
  gcp(
    'cloud-monitoring',
    'Cloud Monitoring',
    'monitoring',
    ['google cloud monitoring', 'cloud monitoring', 'stackdriver'],
    'monitoring',
  ),
  gcp('memorystore', 'Memorystore', 'cache', ['google memorystore', 'memorystore'], 'memorystore'),
  gcp(
    'api-gateway',
    'API Gateway',
    'integration',
    ['google api gateway', 'gcp api gateway', 'api gateway'],
    'api-gateway',
  ),
];

/**
 * Words that name a category, not a product. A node labelled "database" gets the category
 * `database` and nothing more; it is never mapped to a vendor service.
 */
export const GENERIC_TERMS: readonly GenericTerm[] = [
  { category: 'database', terms: ['database', 'db', 'sql database', 'datastore', 'data store'] },
  { category: 'storage', terms: ['storage', 'object storage', 'blob', 'bucket', 'file share'] },
  { category: 'cache', terms: ['cache', 'redis', 'memcached'] },
  {
    category: 'messaging',
    terms: ['queue', 'message queue', 'topic', 'event bus', 'message broker', 'broker'],
  },
  { category: 'api', terms: ['api', 'rest api', 'graphql api', 'backend', 'web api'] },
  { category: 'networking', terms: ['load balancer', 'cdn', 'gateway', 'firewall', 'dns'] },
  { category: 'identity', terms: ['identity provider', 'idp', 'auth', 'authentication', 'sso'] },
  {
    category: 'actor',
    terms: ['user', 'users', 'customer', 'client', 'browser', 'admin', 'operator'],
  },
  {
    category: 'external',
    terms: ['third party', 'external system', 'partner', 'payment provider'],
  },
];

export function servicesFor(provider: ProviderId): ServiceEntry[] {
  return SERVICES.filter((s) => s.provider === provider);
}

export function serviceById(id: string): ServiceEntry | undefined {
  return SERVICES.find((s) => s.id === id);
}
