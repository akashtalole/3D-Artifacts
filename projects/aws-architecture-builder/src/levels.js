/**
 * Missions. Each goal is a test on the analysed diagram (see graph.js).
 * Stars: ★ all goals · ★★ + within budget · ★★★ + every bonus.
 */
const U = ['users', 'mobile'];
const svc = (id, kind, x, y) => ({ id, type: 'svc', kind, x, y });
const grp = (id, kind, x, y, w, h) => ({ id, type: 'group', kind, x, y, w, h });

export const LEVELS = [
  {
    id: 'static-site', title: 'Static website', tag: 'Beginner',
    story: 'A bakery wants a fast, cheap website for its menu. The pages are plain HTML, images and CSS.',
    budget: 20,
    start: { nodes: [svc('u', 'users', 64, 192)], edges: [] },
    goals: [
      { text: 'Store the site files in Amazon S3', test: (g) => g.has('s3'), hint: 'Drag the S3 bucket from Storage onto the board.', kinds: ['s3'] },
      { text: 'Serve users through Amazon CloudFront', test: (g) => g.path(U, 'cloudfront'), hint: 'Add CloudFront and connect Users → CloudFront (drag from the dot on a brick’s right edge).', kinds: ['cloudfront'] },
      { text: 'CloudFront fetches content from S3', test: (g) => g.edge('cloudfront', 's3'), hint: 'Connect CloudFront → S3: S3 is the origin.', kinds: ['cloudfront', 's3'] },
    ],
    bonus: [
      { text: 'Custom domain with Route 53', test: (g) => g.linked(U, 'route53') || g.linked('route53', 'cloudfront'), kinds: ['route53'] },
      { text: 'HTTPS certificate from ACM on CloudFront', test: (g) => g.linked('acm', 'cloudfront'), kinds: ['acm'] },
      { text: 'WAF protecting CloudFront', test: (g) => g.linked('waf', 'cloudfront'), kinds: ['waf'] },
    ],
    learn: 'S3 + CloudFront is the classic serverless static site: no servers to patch, global caching, pennies per month.',
  },
  {
    id: 'serverless-api', title: 'Serverless API', tag: 'Beginner',
    story: 'A to-do app needs an API that scales from zero to thousands of users without managing servers.',
    budget: 50,
    start: { nodes: [svc('u', 'mobile', 64, 192)], edges: [] },
    goals: [
      { text: 'Requests enter through API Gateway', test: (g) => g.path(U, 'apigw'), hint: 'Connect Mobile app → API Gateway.', kinds: ['apigw'] },
      { text: 'API Gateway invokes a Lambda function', test: (g) => g.edge('apigw', 'lambda'), hint: 'Connect API Gateway → Lambda.', kinds: ['lambda'] },
      { text: 'Lambda stores items in DynamoDB', test: (g) => g.edge('lambda', 'dynamodb'), hint: 'Connect Lambda → DynamoDB.', kinds: ['dynamodb'] },
    ],
    bonus: [
      { text: 'Users sign in with Cognito (linked to API Gateway)', test: (g) => g.linked('cognito', 'apigw'), kinds: ['cognito'] },
      { text: 'Logs and alarms in CloudWatch', test: (g) => g.has('cloudwatch'), kinds: ['cloudwatch'] },
      { text: 'Traces with X-Ray', test: (g) => g.has('xray'), kinds: ['xray'] },
    ],
    learn: 'API Gateway → Lambda → DynamoDB scales to zero: you pay per request, not per hour.',
  },
  {
    id: 'three-tier', title: 'Highly available web app', tag: 'Intermediate',
    story: 'An online shop runs on EC2 with a MySQL database. It must keep selling even if a whole data centre (Availability Zone) goes down.',
    budget: 300, chaos: true,
    start: {
      nodes: [svc('u', 'users', 48, 288), grp('c', 'cloud', 208, 32, 960, 640), grp('r', 'region', 240, 80, 896, 576), grp('v', 'vpc', 272, 128, 832, 512)],
      edges: [],
    },
    goals: [
      { text: 'Two Availability Zones inside the VPC', test: (g) => g.groupCount('az') >= 2, hint: 'Drop two “Availability Zone” plates side by side inside the VPC.', kinds: [] },
      { text: 'Users reach an Application Load Balancer in the VPC', test: (g) => g.path(U, 'alb') && g.allIn('alb', 'vpc'), hint: 'Put the ALB inside the VPC but outside the AZ plates: an ALB spans AZs.', kinds: ['alb'] },
      { text: 'EC2 web servers in private subnets in both AZs', test: (g) => g.allIn('ec2', 'private') && g.spreadAZ('ec2', 2) && g.edgeCount('alb', 'ec2') >= 2, hint: 'Add a private subnet in each AZ, an EC2 in each, and connect ALB → each EC2.', kinds: ['ec2'] },
      { text: 'RDS database in a private subnet, used by the servers', test: (g) => g.allIn('rds', 'private') && g.edge('ec2', 'rds'), hint: 'Add RDS in a private subnet and connect EC2 → RDS.', kinds: ['rds'] },
      { text: 'Survives losing any one Availability Zone', test: (g) => g.survivesAZ(U, 'rds'), hint: 'Add a standby RDS in the other AZ (Multi-AZ) and make sure each AZ’s EC2 reaches a database. Try “Fail an AZ”.', kinds: ['rds'] },
    ],
    bonus: [
      { text: 'Internet gateway in front of the load balancer', test: (g) => g.path(U, 'igw') && g.path('igw', 'alb'), kinds: ['igw'] },
      { text: 'EC2 in an Auto Scaling group', test: (g) => g.anyIn('ec2', 'asg'), kinds: [] },
      { text: 'WAF on the load balancer', test: (g) => g.linked('waf', 'alb'), kinds: ['waf'] },
      { text: 'CloudWatch alarms', test: (g) => g.has('cloudwatch'), kinds: ['cloudwatch'] },
    ],
    learn: 'Spreading every tier across two AZs, with an ALB in front and RDS Multi-AZ behind, removes the single points of failure.',
  },
  {
    id: 'event-driven', title: 'Event-driven photo tagging', tag: 'Intermediate',
    story: 'Users upload holiday photos. Each upload should be tagged automatically (beach, dog, sunset…) without slowing the upload down.',
    budget: 60,
    start: { nodes: [svc('u', 'users', 64, 192)], edges: [] },
    goals: [
      { text: 'Photos are uploaded to S3', test: (g) => g.path(U, 's3'), hint: 'Connect Users → S3.', kinds: ['s3'] },
      { text: 'S3 sends an event to an SQS queue', test: (g) => g.edge('s3', 'sqs'), hint: 'Connect S3 → SQS: the queue buffers bursts of uploads.', kinds: ['sqs'] },
      { text: 'Lambda consumes the queue', test: (g) => g.edge('sqs', 'lambda'), hint: 'Connect SQS → Lambda.', kinds: ['lambda'] },
      { text: 'Lambda asks Rekognition for labels', test: (g) => g.edge('lambda', 'rekognition'), hint: 'Connect Lambda → Rekognition.', kinds: ['rekognition'] },
      { text: 'Labels are saved in DynamoDB', test: (g) => g.edge('lambda', 'dynamodb'), hint: 'Connect Lambda → DynamoDB.', kinds: ['dynamodb'] },
    ],
    bonus: [
      { text: 'A second SQS queue as a dead-letter queue', test: (g) => g.count('sqs') >= 2 && g.edgeCount('sqs', 'sqs') >= 1, kinds: ['sqs'] },
      { text: 'Notify users through SNS when tagging is done', test: (g) => g.edge('lambda', 'sns'), kinds: ['sns'] },
      { text: 'CloudWatch monitoring', test: (g) => g.has('cloudwatch'), kinds: ['cloudwatch'] },
    ],
    learn: 'A queue between the event and the worker absorbs spikes and retries failures: producers never wait for consumers.',
  },
  {
    id: 'data-lake', title: 'Clickstream data lake', tag: 'Advanced',
    story: 'A mobile game wants to analyse every tap and level-up with SQL, without running a database cluster.',
    budget: 120,
    start: { nodes: [svc('u', 'mobile', 64, 192)], edges: [] },
    goals: [
      { text: 'Events stream into Kinesis Data Streams', test: (g) => g.path(U, 'kinesis'), hint: 'Connect Mobile app → Kinesis.', kinds: ['kinesis'] },
      { text: 'Firehose delivers the stream to S3', test: (g) => g.edge('kinesis', 'firehose') && g.edge('firehose', 's3'), hint: 'Connect Kinesis → Firehose → S3.', kinds: ['firehose', 's3'] },
      { text: 'Glue crawls S3 to build the data catalogue', test: (g) => g.linked('glue', 's3'), hint: 'Connect Glue ↔ S3.', kinds: ['glue'] },
      { text: 'Analysts query S3 with Athena', test: (g) => g.linked('athena', 's3') && g.linked('athena', 'glue'), hint: 'Connect Athena to S3 and to Glue (it reads the catalogue).', kinds: ['athena'] },
    ],
    bonus: [
      { text: 'Lake Formation governs access', test: (g) => g.linked('lakeformation', ['s3', 'glue']), kinds: ['lakeformation'] },
      { text: 'Old data archived to S3 Glacier', test: (g) => g.edge('s3', 'glacier'), kinds: ['glacier'] },
      { text: 'Encrypted with KMS', test: (g) => g.linked('kms', 's3'), kinds: ['kms'] },
    ],
    learn: 'Kinesis → Firehose → S3, catalogued by Glue and queried by Athena, is a pay-per-query analytics stack with no servers.',
  },
  {
    id: 'genai-rag', title: 'GenAI assistant (RAG)', tag: 'Advanced',
    story: 'An insurer wants a chat assistant that answers from its own policy PDFs, not from the open internet.',
    budget: 400,
    start: { nodes: [svc('u', 'users', 64, 192)], edges: [] },
    goals: [
      { text: 'Chat requests reach API Gateway', test: (g) => g.path(U, 'apigw'), hint: 'Connect Users → API Gateway (optionally through CloudFront).', kinds: ['apigw'] },
      { text: 'A Lambda orchestrates each request', test: (g) => g.edge('apigw', 'lambda'), hint: 'Connect API Gateway → Lambda.', kinds: ['lambda'] },
      { text: 'Policy PDFs live in S3 and feed Bedrock', test: (g) => g.linked('s3', 'bedrock'), hint: 'Connect S3 ↔ Bedrock: a Bedrock knowledge base ingests the documents.', kinds: ['s3', 'bedrock'] },
      { text: 'Embeddings stored in a vector store (OpenSearch)', test: (g) => g.linked('bedrock', 'opensearch') || g.edge('lambda', 'opensearch'), hint: 'Connect Bedrock ↔ OpenSearch Service as the vector store.', kinds: ['opensearch'] },
      { text: 'Lambda calls a foundation model on Bedrock', test: (g) => g.edge('lambda', 'bedrock'), hint: 'Connect Lambda → Bedrock.', kinds: ['bedrock'] },
    ],
    bonus: [
      { text: 'Users sign in with Cognito', test: (g) => g.linked('cognito', 'apigw'), kinds: ['cognito'] },
      { text: 'Chat history in DynamoDB', test: (g) => g.edge('lambda', 'dynamodb'), kinds: ['dynamodb'] },
      { text: 'WAF in front of the API', test: (g) => g.linked('waf', ['apigw', 'cloudfront']), kinds: ['waf'] },
      { text: 'Text extracted from scanned PDFs with Textract', test: (g) => g.linked('textract', 's3'), kinds: ['textract'] },
    ],
    learn: 'Retrieval-augmented generation grounds the model in your documents: retrieve relevant chunks first, then generate an answer.',
  },
];

export const SANDBOX = {
  id: 'sandbox', title: 'Sandbox', tag: 'Free build', story: 'No goals, no budget: design anything.', budget: null, start: { nodes: [], edges: [] }, goals: [], bonus: [],
};
