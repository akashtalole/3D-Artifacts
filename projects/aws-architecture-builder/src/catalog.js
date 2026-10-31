/**
 * Pieces: AWS services ("bricks") and diagram groups ("baseplates").
 * Icons: official AWS Architecture Icons (icons/<id>.svg).
 * Cost = toy monthly price used for the game budget, not AWS pricing.
 */
export const CATS = {
  general: { name: 'Users & on-prem', color: '#232F3E' },
  network: { name: 'Networking & edge', color: '#8C4FFF' },
  compute: { name: 'Compute & containers', color: '#ED7100' },
  storage: { name: 'Storage', color: '#7AA116' },
  database: { name: 'Databases', color: '#C925D1' },
  integration: { name: 'App integration', color: '#E7157B' },
  analytics: { name: 'Analytics', color: '#8C4FFF' },
  ai: { name: 'AI & ML', color: '#01A88D' },
  security: { name: 'Security & identity', color: '#DD344C' },
  ops: { name: 'Management & DevOps', color: '#E7157B' },
};

const S = (id, cat, name, short, cost, desc) => ({ id, cat, name, short, cost, desc });
export const SERVICES = [
  S('users', 'general', 'Users', 'Users', 0, 'People using your application from the internet.'),
  S('mobile', 'general', 'Mobile client', 'Mobile app', 0, 'A mobile app sending requests or events.'),
  S('internet', 'general', 'Internet', 'Internet', 0, 'The public internet.'),
  S('office', 'general', 'Corporate office', 'Office', 0, 'Your on-premises network or office.'),

  S('route53', 'network', 'Amazon Route 53', 'Route 53', 1, 'DNS: turns your domain name into the address of your app.'),
  S('cloudfront', 'network', 'Amazon CloudFront', 'CloudFront', 8, 'CDN that caches content at edge locations close to users.'),
  S('apigw', 'network', 'Amazon API Gateway', 'API Gateway', 12, 'Managed front door for REST, HTTP and WebSocket APIs.'),
  S('alb', 'network', 'Application Load Balancer', 'ALB', 22, 'Spreads HTTP traffic across targets in several Availability Zones.'),
  S('nlb', 'network', 'Network Load Balancer', 'NLB', 20, 'Ultra-low-latency TCP/UDP load balancing.'),
  S('igw', 'network', 'Internet gateway', 'Internet GW', 0, 'Connects a VPC’s public subnets to the internet.'),
  S('nat', 'network', 'NAT gateway', 'NAT GW', 32, 'Lets private subnets reach the internet without being reachable from it.'),
  S('transitgw', 'network', 'AWS Transit Gateway', 'Transit GW', 36, 'Hub that connects many VPCs and on-prem networks.'),
  S('vpn', 'network', 'AWS Site-to-Site VPN', 'VPN', 36, 'Encrypted tunnel from your office to a VPC.'),
  S('directconnect', 'network', 'AWS Direct Connect', 'Direct Connect', 220, 'Dedicated private line from your data centre to AWS.'),

  S('ec2', 'compute', 'Amazon EC2', 'EC2', 35, 'Virtual servers you control.'),
  S('asgsvc', 'compute', 'Amazon EC2 Auto Scaling', 'Auto Scaling', 0, 'Adds or removes EC2 instances with demand.'),
  S('lambda', 'compute', 'AWS Lambda', 'Lambda', 4, 'Run code without servers; pay per request.'),
  S('ecs', 'compute', 'Amazon ECS', 'ECS', 0, 'Run and scale Docker containers.'),
  S('eks', 'compute', 'Amazon EKS', 'EKS', 73, 'Managed Kubernetes.'),
  S('fargate', 'compute', 'AWS Fargate', 'Fargate', 30, 'Serverless compute for containers.'),
  S('ecr', 'compute', 'Amazon ECR', 'ECR', 1, 'Private container image registry.'),

  S('s3', 'storage', 'Amazon S3', 'S3', 3, 'Object storage with 11 nines of durability.'),
  S('glacier', 'storage', 'Amazon S3 Glacier', 'S3 Glacier', 1, 'Low-cost archive storage.'),
  S('efs', 'storage', 'Amazon EFS', 'EFS', 10, 'Shared file system for many servers.'),
  S('ebs', 'storage', 'Amazon EBS', 'EBS', 8, 'Block storage volumes for EC2.'),

  S('dynamodb', 'database', 'Amazon DynamoDB', 'DynamoDB', 8, 'Serverless key-value / document database.'),
  S('rds', 'database', 'Amazon RDS', 'RDS', 60, 'Managed relational database (MySQL, PostgreSQL…).'),
  S('aurora', 'database', 'Amazon Aurora', 'Aurora', 90, 'Cloud-native relational database, replicated across AZs.'),
  S('elasticache', 'database', 'Amazon ElastiCache', 'ElastiCache', 25, 'In-memory cache (Valkey, Redis OSS, Memcached).'),
  S('documentdb', 'database', 'Amazon DocumentDB', 'DocumentDB', 60, 'MongoDB-compatible document database.'),

  S('sqs', 'integration', 'Amazon SQS', 'SQS', 1, 'Message queue that decouples producers and consumers.'),
  S('sns', 'integration', 'Amazon SNS', 'SNS', 1, 'Pub/sub notifications: fan out to many subscribers.'),
  S('eventbridge', 'integration', 'Amazon EventBridge', 'EventBridge', 1, 'Event bus that routes events by rules.'),
  S('stepfunctions', 'integration', 'AWS Step Functions', 'Step Functions', 3, 'Orchestrates multi-step workflows.'),

  S('kinesis', 'analytics', 'Amazon Kinesis Data Streams', 'Kinesis', 25, 'Real-time streaming ingestion.'),
  S('firehose', 'analytics', 'Amazon Data Firehose', 'Firehose', 15, 'Loads streams into S3, Redshift or OpenSearch.'),
  S('glue', 'analytics', 'AWS Glue', 'Glue', 30, 'Serverless ETL and data catalogue.'),
  S('athena', 'analytics', 'Amazon Athena', 'Athena', 10, 'SQL queries directly on data in S3.'),
  S('redshift', 'analytics', 'Amazon Redshift', 'Redshift', 180, 'Data warehouse for analytics at scale.'),
  S('opensearch', 'analytics', 'Amazon OpenSearch Service', 'OpenSearch', 90, 'Search, log analytics and vector search.'),
  S('emr', 'analytics', 'Amazon EMR', 'EMR', 120, 'Managed Spark / Hadoop big-data clusters.'),
  S('lakeformation', 'analytics', 'AWS Lake Formation', 'Lake Formation', 0, 'Builds and secures a data lake with fine-grained permissions.'),

  S('bedrock', 'ai', 'Amazon Bedrock', 'Bedrock', 150, 'Foundation models and agents through one API.'),
  S('sagemaker', 'ai', 'Amazon SageMaker AI', 'SageMaker', 120, 'Build, train and deploy ML models.'),
  S('rekognition', 'ai', 'Amazon Rekognition', 'Rekognition', 10, 'Image and video analysis.'),
  S('textract', 'ai', 'Amazon Textract', 'Textract', 15, 'Extracts text and tables from documents.'),

  S('iam', 'security', 'AWS IAM', 'IAM', 0, 'Who can do what: users, roles and policies.'),
  S('cognito', 'security', 'Amazon Cognito', 'Cognito', 5, 'Sign-up, sign-in and tokens for your app’s users.'),
  S('waf', 'security', 'AWS WAF', 'WAF', 6, 'Web application firewall: blocks common attacks.'),
  S('shield', 'security', 'AWS Shield', 'Shield', 0, 'DDoS protection (Standard is included).'),
  S('kms', 'security', 'AWS KMS', 'KMS', 1, 'Creates and controls encryption keys.'),
  S('secrets', 'security', 'AWS Secrets Manager', 'Secrets Mgr', 1, 'Stores and rotates passwords and API keys.'),
  S('guardduty', 'security', 'Amazon GuardDuty', 'GuardDuty', 5, 'Threat detection for your accounts.'),
  S('acm', 'security', 'AWS Certificate Manager', 'ACM', 0, 'Free TLS certificates for HTTPS.'),

  S('cloudwatch', 'ops', 'Amazon CloudWatch', 'CloudWatch', 6, 'Metrics, logs and alarms.'),
  S('cloudtrail', 'ops', 'AWS CloudTrail', 'CloudTrail', 2, 'Audit log of every API call.'),
  S('xray', 'ops', 'AWS X-Ray', 'X-Ray', 3, 'Traces requests across services.'),
  S('codepipeline', 'ops', 'AWS CodePipeline', 'CodePipeline', 1, 'Continuous delivery pipelines.'),
  S('codebuild', 'ops', 'AWS CodeBuild', 'CodeBuild', 5, 'Builds and tests code.'),
];
export const SVC = Object.fromEntries(SERVICES.map((s) => [s.id, s]));

/** Group styles follow the AWS diagram conventions. */
export const GROUPS = [
  { id: 'cloud', name: 'AWS Cloud', icon: 'g-cloud', color: '#232F3E', fill: 'none', dash: '', w: 768, h: 480 },
  { id: 'region', name: 'Region', icon: 'g-region', color: '#00A4A6', fill: 'none', dash: '8 5', w: 704, h: 416 },
  { id: 'vpc', name: 'VPC', icon: 'g-vpc', color: '#8C4FFF', fill: 'none', dash: '', w: 608, h: 352 },
  { id: 'az', name: 'Availability Zone', icon: null, color: '#147EBA', fill: 'none', dash: '6 4', w: 256, h: 288 },
  { id: 'public', name: 'Public subnet', icon: 'g-public', color: '#7AA116', fill: '#F2F6E8', dash: '', w: 224, h: 128 },
  { id: 'private', name: 'Private subnet', icon: 'g-private', color: '#00A4A6', fill: '#E6F6F7', dash: '', w: 224, h: 128 },
  { id: 'asg', name: 'Auto Scaling group', icon: 'g-asg', color: '#ED7100', fill: 'none', dash: '6 4', w: 224, h: 128 },
  { id: 'corp', name: 'Corporate data center', icon: 'g-corp', color: '#7D8998', fill: 'none', dash: '', w: 224, h: 160 },
];
export const GROUP = Object.fromEntries(GROUPS.map((g) => [g.id, g]));

export const SOURCES = ['users', 'mobile', 'internet', 'office'];
