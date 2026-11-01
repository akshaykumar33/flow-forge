export interface Example {
  id: string;
  name: string;
  source: string;
}

/** Realistic starting points. Each is plain Mermaid the user can edit freely. */
export const EXAMPLES: readonly Example[] = [
  {
    id: 'azure-web-app',
    name: 'Azure web application',
    source: `flowchart LR
  user((User)) -->|HTTPS| fd[Azure Front Door]
  subgraph azure[Azure Subscription]
    subgraph vnet[Virtual Network]
      app[App Service] --> fn(Function App)
    end
    fn -.->|events| sb[[Service Bus]]
    app --> sql[(Azure SQL Database)]
    app --> kv[Key Vault]
  end
  fd --> app
`,
  },
  {
    id: 'aws-serverless',
    name: 'AWS serverless API',
    source: `flowchart LR
  client((Client)) --> cf[CloudFront]
  subgraph aws[AWS Production]
    cf --> gw[API Gateway]
    gw --> fn[Orders Lambda Function]
    fn --> ddb[(DynamoDB)]
    fn -->|publish| sns[[SNS]]
    sns --> q[SQS]
  end
  fn --> pay[Payment Provider]
`,
  },
  {
    id: 'ci-cd',
    name: 'CI/CD pipeline',
    source: `flowchart LR
  dev((Developer)) -->|push| repo[Git repository]
  repo --> build[Build]
  build --> test{Tests pass?}
  test -->|yes| stage[Deploy to staging]
  test -->|no| notify[Notify author]
  stage --> approve{Approved?}
  approve -->|yes| prod[Deploy to production]
`,
  },
];
