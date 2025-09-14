---
title: "高度なデプロイメント戦略 - スケーラブルなデプロイメント手法"
description: "TypeScript Minecraftの高度なデプロイメント戦略。Blue-Green、Canary、Rolling デプロイメント、マイクロサービス、CDN最適化の実践的ガイド。"
category: "how-to"
difficulty: "advanced"
tags: ["deployment", "scaling", "blue-green", "canary", "microservices", "cdn"]
prerequisites: ["docker-deployment", "ci-cd-deployment", "performance-optimization"]
estimated_reading_time: "30分"
related_patterns: ["troubleshooting-monitoring"]
related_docs: ["./docker-deployment.md", "./ci-cd-deployment.md", "./performance-optimization.md", "./troubleshooting-monitoring.md"]
---

# 高度なデプロイメント戦略

## 概要

TypeScript Minecraftアプリケーションのスケーラブルで信頼性の高いデプロイメント戦略について説明します。Blue-Green、Canary、マイクロサービスアーキテクチャ、CDN最適化など、本番環境での高度な展開手法を扱います。

## デプロイメント戦略の選択

### 戦略比較表

| 戦略 | 利点 | 欠点 | 適用場面 |
|------|------|------|----------|
| Blue-Green | 迅速なロールバック、ダウンタイム最小 | リソース使用量2倍 | 重要なリリース、低リスク要求 |
| Canary | 段階的リスク軽減、実本番データでテスト | 複雑な設定、時間要する | 新機能テスト、高品質要求 |
| Rolling | リソース効率的、段階的更新 | 複数バージョン同時実行 | 通常のアップデート |
| Feature Flag | リアルタイム制御、A/Bテスト対応 | コード複雑化 | 実験的機能、段階的公開 |

## Blue-Green デプロイメント

### Kubernetes Blue-Green 設定

```yaml
# k8s/blue-green/blue-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ts-minecraft-blue
  labels:
    app: ts-minecraft
    version: blue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ts-minecraft
      version: blue
  template:
    metadata:
      labels:
        app: ts-minecraft
        version: blue
    spec:
      containers:
      - name: ts-minecraft
        image: ts-minecraft:blue
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: VERSION_LABEL
          value: "blue"
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 60
          periodSeconds: 30

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ts-minecraft-green
  labels:
    app: ts-minecraft
    version: green
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ts-minecraft
      version: green
  template:
    metadata:
      labels:
        app: ts-minecraft
        version: green
    spec:
      containers:
      - name: ts-minecraft
        image: ts-minecraft:green
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: VERSION_LABEL
          value: "green"
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 60
          periodSeconds: 30
```

### Blue-Green サービス切り替え

```yaml
# k8s/blue-green/service.yml
apiVersion: v1
kind: Service
metadata:
  name: ts-minecraft-service
spec:
  selector:
    app: ts-minecraft
    version: blue  # blue または green に切り替え
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer

---
# 切り替えスクリプト用のサービス設定
apiVersion: v1
kind: Service
metadata:
  name: ts-minecraft-blue
spec:
  selector:
    app: ts-minecraft
    version: blue
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000

---
apiVersion: v1
kind: Service
metadata:
  name: ts-minecraft-green
spec:
  selector:
    app: ts-minecraft
    version: green
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
```

### Blue-Green 切り替え自動化

```bash
#!/bin/bash
# scripts/blue-green-deploy.sh

set -e

NAMESPACE="default"
SERVICE_NAME="ts-minecraft-service"
NEW_VERSION=${1:-green}
OLD_VERSION="blue"

if [ "$NEW_VERSION" = "blue" ]; then
    OLD_VERSION="green"
fi

echo "🚀 Starting Blue-Green deployment..."
echo "Current version: $OLD_VERSION"
echo "Target version: $NEW_VERSION"

# 1. 新バージョンのデプロイ確認
echo "📋 Checking $NEW_VERSION deployment readiness..."
kubectl rollout status deployment/ts-minecraft-$NEW_VERSION -n $NAMESPACE --timeout=300s

# 2. ヘルスチェック実行
echo "🔍 Performing health checks..."
NEW_VERSION_POD=$(kubectl get pods -n $NAMESPACE -l app=ts-minecraft,version=$NEW_VERSION -o jsonpath='{.items[0].metadata.name}')

if kubectl exec -n $NAMESPACE $NEW_VERSION_POD -- curl -f http://localhost:3000/health; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed. Aborting deployment."
    exit 1
fi

# 3. スモークテスト実行
echo "🧪 Running smoke tests..."
if ./scripts/smoke-tests.sh $NEW_VERSION; then
    echo "✅ Smoke tests passed"
else
    echo "❌ Smoke tests failed. Aborting deployment."
    exit 1
fi

# 4. トラフィック切り替え
echo "🔄 Switching traffic to $NEW_VERSION..."
kubectl patch service $SERVICE_NAME -n $NAMESPACE -p '{"spec":{"selector":{"version":"'$NEW_VERSION'"}}}'

# 5. 切り替え確認
sleep 10
echo "🔍 Verifying traffic switch..."
if curl -f http://$(kubectl get svc $SERVICE_NAME -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')/health; then
    echo "✅ Traffic successfully switched to $NEW_VERSION"
else
    echo "❌ Traffic switch verification failed. Rolling back..."
    kubectl patch service $SERVICE_NAME -n $NAMESPACE -p '{"spec":{"selector":{"version":"'$OLD_VERSION'"}}}'
    exit 1
fi

# 6. 旧バージョンのスケールダウン（オプション）
read -p "Scale down $OLD_VERSION deployment? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    kubectl scale deployment ts-minecraft-$OLD_VERSION -n $NAMESPACE --replicas=0
    echo "✅ $OLD_VERSION scaled down"
fi

echo "🎉 Blue-Green deployment completed successfully!"
echo "Current active version: $NEW_VERSION"
```

## Canary デプロイメント

### Istio Canary 設定

```yaml
# k8s/canary/virtual-service.yml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: ts-minecraft-vs
spec:
  hosts:
  - ts-minecraft.example.com
  http:
  - match:
    - headers:
        canary:
          exact: "true"
    route:
    - destination:
        host: ts-minecraft-service
        subset: canary
  - route:
    - destination:
        host: ts-minecraft-service
        subset: stable
      weight: 90
    - destination:
        host: ts-minecraft-service
        subset: canary
      weight: 10  # 10% of traffic to canary

---
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: ts-minecraft-dr
spec:
  host: ts-minecraft-service
  subsets:
  - name: stable
    labels:
      version: stable
  - name: canary
    labels:
      version: canary
```

### Canary 段階的展開

```typescript
// scripts/canary-controller.ts
import { Effect, Schedule, pipe } from "effect";

interface CanaryConfig {
  readonly stages: ReadonlyArray<{
    readonly percentage: number;
    readonly duration: number;
    readonly successThreshold: number;
  }>;
  readonly rollbackThreshold: number;
  readonly checkInterval: number;
}

const defaultCanaryConfig: CanaryConfig = {
  stages: [
    { percentage: 5, duration: 300, successThreshold: 99.5 },
    { percentage: 10, duration: 600, successThreshold: 99.0 },
    { percentage: 25, duration: 900, successThreshold: 98.5 },
    { percentage: 50, duration: 900, successThreshold: 98.0 },
    { percentage: 100, duration: 0, successThreshold: 98.0 }
  ],
  rollbackThreshold: 95.0,
  checkInterval: 30
};

class CanaryController {
  constructor(private readonly config: CanaryConfig) {}

  private updateTrafficWeight = (percentage: number) =>
    Effect.tryPromise({
      try: async () => {
        // Kubernetes VirtualService の weight を更新
        const { execSync } = await import('child_process');
        const virtualService = {
          spec: {
            http: [{
              route: [
                { destination: { host: "ts-minecraft-service", subset: "stable" }, weight: 100 - percentage },
                { destination: { host: "ts-minecraft-service", subset: "canary" }, weight: percentage }
              ]
            }]
          }
        };

        execSync(`kubectl patch virtualservice ts-minecraft-vs --type merge -p '${JSON.stringify(virtualService)}'`);
        console.log(`✅ Traffic updated: ${percentage}% to canary`);
      },
      catch: (error) => new Error(`Failed to update traffic weight: ${error}`)
    });

  private checkCanaryHealth = Effect.tryPromise({
    try: async () => {
      // Prometheus メトリクスから成功率を取得
      const response = await fetch('http://prometheus:9090/api/v1/query?query=rate(http_requests_total{job="ts-minecraft-canary",status!~"5.."}[5m])/rate(http_requests_total{job="ts-minecraft-canary"}[5m])*100');
      const data = await response.json();

      if (data.data.result.length === 0) {
        return 100; // メトリクスがない場合は成功とみなす
      }

      return parseFloat(data.data.result[0].value[1]);
    },
    catch: () => new Error("Failed to fetch health metrics")
  });

  private rollback = Effect.gen(function* (_) {
    console.log("🔄 Rolling back canary deployment...");
    yield* _(updateTrafficWeight(0));

    // Canary deployment をスケールダウン
    yield* _(Effect.tryPromise({
      try: async () => {
        const { execSync } = await import('child_process');
        execSync('kubectl scale deployment ts-minecraft-canary --replicas=0');
        console.log("✅ Canary deployment scaled down");
      },
      catch: (error) => new Error(`Rollback failed: ${error}`)
    }));
  });

  executeCanaryDeployment = Effect.gen(function* (_) {
    console.log("🚀 Starting canary deployment...");

    for (const stage of this.config.stages) {
      console.log(`📊 Stage: ${stage.percentage}% traffic for ${stage.duration}s`);

      // トラフィック重み更新
      yield* _(this.updateTrafficWeight(stage.percentage));

      if (stage.duration > 0) {
        // ヘルスチェック実行
        const healthCheckEffect = pipe(
          this.checkCanaryHealth,
          Effect.flatMap(successRate => {
            console.log(`📈 Success rate: ${successRate.toFixed(2)}%`);

            if (successRate < this.config.rollbackThreshold) {
              console.log(`❌ Success rate below threshold (${this.config.rollbackThreshold}%)`);
              return Effect.fail(new Error("Health check failed"));
            }

            if (successRate < stage.successThreshold) {
              console.log(`⚠️  Success rate below stage threshold (${stage.successThreshold}%)`);
              return Effect.fail(new Error("Stage threshold not met"));
            }

            return Effect.succeed(successRate);
          }),
          Effect.retry(Schedule.spaced(this.config.checkInterval * 1000)),
          Effect.timeout(stage.duration * 1000)
        );

        const result = yield* _(Effect.either(healthCheckEffect));

        if (result._tag === "Left") {
          yield* _(this.rollback);
          return yield* _(Effect.fail(new Error("Canary deployment failed")));
        }
      }
    }

    console.log("🎉 Canary deployment completed successfully!");
  });
}

// 使用例
const canaryController = new CanaryController(defaultCanaryConfig);

Effect.runPromise(
  pipe(
    canaryController.executeCanaryDeployment,
    Effect.catchAll(error => {
      console.error("❌ Canary deployment failed:", error.message);
      return Effect.succeed(void 0);
    })
  )
);
```

## マイクロサービス デプロイメント

### サービス分割アーキテクチャ

```typescript
// src/services/user-service/main.ts
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer, pipe } from "effect";
import { UserController } from "./controller/user-controller";
import { UserRepository } from "./repository/user-repository";
import { DatabaseLayer } from "./infrastructure/database-layer";

const UserServiceLayer = Layer.mergeAll(
  DatabaseLayer,
  UserRepository.Live,
  UserController.Live
);

const HttpServerLayer = NodeHttpServer.layer(
  { port: 3001 },
  UserController.routes
);

const program = pipe(
  Effect.never,
  Effect.provide(HttpServerLayer),
  Effect.provide(UserServiceLayer)
);

NodeRuntime.runMain(program);
```

### サービスメッシュ設定

```yaml
# k8s/microservices/user-service.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  labels:
    app: user-service
    version: v1
spec:
  replicas: 2
  selector:
    matchLabels:
      app: user-service
      version: v1
  template:
    metadata:
      labels:
        app: user-service
        version: v1
      annotations:
        sidecar.istio.io/inject: "true"
    spec:
      containers:
      - name: user-service
        image: ts-minecraft/user-service:latest
        ports:
        - containerPort: 3001
        env:
        - name: SERVICE_NAME
          value: "user-service"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: user-db-url

---
apiVersion: v1
kind: Service
metadata:
  name: user-service
  labels:
    app: user-service
spec:
  ports:
  - port: 80
    targetPort: 3001
    name: http
  selector:
    app: user-service
```

### API Gateway 設定

```yaml
# k8s/microservices/api-gateway.yml
apiVersion: networking.istio.io/v1alpha3
kind: Gateway
metadata:
  name: ts-minecraft-gateway
spec:
  selector:
    istio: ingressgateway
  servers:
  - port:
      number: 80
      name: http
      protocol: HTTP
    hosts:
    - api.ts-minecraft.example.com

---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: ts-minecraft-api
spec:
  hosts:
  - api.ts-minecraft.example.com
  gateways:
  - ts-minecraft-gateway
  http:
  - match:
    - uri:
        prefix: /api/users
    route:
    - destination:
        host: user-service
        port:
          number: 80
    timeout: 30s
    retries:
      attempts: 3
      perTryTimeout: 10s
  - match:
    - uri:
        prefix: /api/world
    route:
    - destination:
        host: world-service
        port:
          number: 80
    timeout: 30s
    retries:
      attempts: 3
      perTryTimeout: 10s
  - match:
    - uri:
        prefix: /api/inventory
    route:
    - destination:
        host: inventory-service
        port:
          number: 80
    timeout: 30s
    retries:
      attempts: 3
      perTryTimeout: 10s
```

### サービス間通信設定

```typescript
// src/shared/infrastructure/service-mesh/service-client.ts
import { Effect, pipe } from "effect";
import { HttpClient, HttpClientRequest } from "@effect/platform";

export interface ServiceClient {
  readonly request: <A>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown
  ) => Effect.Effect<A, Error>;
}

export const ServiceClient = (baseUrl: string): ServiceClient => ({
  request: <A>(method: "GET" | "POST" | "PUT" | "DELETE", path: string, body?: unknown) =>
    pipe(
      HttpClientRequest.make(method)(`${baseUrl}${path}`),
      Effect.flatMap(request =>
        body
          ? HttpClientRequest.jsonBody(request, body)
          : Effect.succeed(request)
      ),
      HttpClient.fetchOk,
      Effect.flatMap(response => response.json as Effect.Effect<A, Error>),
      Effect.scoped
    )
});

// サービス別クライアント
export const UserServiceClient = ServiceClient("http://user-service");
export const WorldServiceClient = ServiceClient("http://world-service");
export const InventoryServiceClient = ServiceClient("http://inventory-service");
```

## CDN とエッジ配信最適化

### CloudFront 設定

```yaml
# aws/cloudfront-distribution.yml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'TS-Minecraft CloudFront Distribution'

Resources:
  CloudFrontDistribution:
    Type: 'AWS::CloudFront::Distribution'
    Properties:
      DistributionConfig:
        Origins:
          - Id: ts-minecraft-origin
            DomainName: !GetAtt ALB.DNSName
            CustomOriginConfig:
              HTTPPort: 80
              HTTPSPort: 443
              OriginProtocolPolicy: https-only
              OriginSSLProtocols:
                - TLSv1.2
          - Id: s3-assets-origin
            DomainName: !GetAtt AssetsBucket.RegionalDomainName
            S3OriginConfig:
              OriginAccessIdentity: !Sub 'origin-access-identity/cloudfront/${OriginAccessIdentity}'

        DefaultCacheBehavior:
          TargetOriginId: ts-minecraft-origin
          ViewerProtocolPolicy: redirect-to-https
          AllowedMethods: [GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE]
          CachedMethods: [GET, HEAD, OPTIONS]
          Compress: true
          CachePolicyId: !Ref APICachePolicy
          OriginRequestPolicyId: !Ref APIOriginRequestPolicy

        CacheBehaviors:
          - PathPattern: '/assets/*'
            TargetOriginId: s3-assets-origin
            ViewerProtocolPolicy: redirect-to-https
            AllowedMethods: [GET, HEAD]
            CachedMethods: [GET, HEAD]
            Compress: true
            CachePolicyId: !Ref AssetsCachePolicy
            TTL: 31536000  # 1 year

          - PathPattern: '/api/*'
            TargetOriginId: ts-minecraft-origin
            ViewerProtocolPolicy: redirect-to-https
            AllowedMethods: [GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE]
            CachedMethods: [GET, HEAD]
            CachePolicyId: !Ref APICachePolicy
            TTL: 0  # No caching for API

        Enabled: true
        PriceClass: PriceClass_All
        HttpVersion: http2

  APICachePolicy:
    Type: 'AWS::CloudFront::CachePolicy'
    Properties:
      CachePolicyConfig:
        Name: 'ts-minecraft-api-cache'
        DefaultTTL: 0
        MaxTTL: 0
        MinTTL: 0
        ParametersInCacheKeyAndForwardedToOrigin:
          EnableAcceptEncodingBrotli: true
          EnableAcceptEncodingGzip: true
          QueryStringsConfig:
            QueryStringBehavior: all
          HeadersConfig:
            HeaderBehavior: whitelist
            Headers:
              - Authorization
              - Content-Type
              - X-Forwarded-For

  AssetsCachePolicy:
    Type: 'AWS::CloudFront::CachePolicy'
    Properties:
      CachePolicyConfig:
        Name: 'ts-minecraft-assets-cache'
        DefaultTTL: 86400
        MaxTTL: 31536000
        MinTTL: 1
        ParametersInCacheKeyAndForwardedToOrigin:
          EnableAcceptEncodingBrotli: true
          EnableAcceptEncodingGzip: true
          QueryStringsConfig:
            QueryStringBehavior: none
          HeadersConfig:
            HeaderBehavior: none
```

### エッジ Lambda 関数

```typescript
// aws/edge-functions/request-handler.ts
import { CloudFrontRequestHandler } from 'aws-lambda';

export const handler: CloudFrontRequestHandler = async (event) => {
  const request = event.Records[0].cf.request;
  const headers = request.headers;

  // A/B テスト用のエッジロジック
  const abTestHeader = headers['x-ab-test'];
  if (!abTestHeader) {
    // ユーザーを A/B テストグループに振り分け
    const userId = headers['x-user-id']?.[0]?.value;
    const testGroup = userId ? (parseInt(userId) % 100 < 50 ? 'A' : 'B') : 'A';

    request.headers['x-ab-test'] = [{ key: 'X-AB-Test', value: testGroup }];
  }

  // 地域別最適化
  const countryCode = headers['cloudfront-viewer-country']?.[0]?.value;
  if (countryCode) {
    request.headers['x-user-country'] = [{ key: 'X-User-Country', value: countryCode }];

    // 地域別のオリジンへルーティング
    if (['JP', 'KR', 'CN'].includes(countryCode)) {
      request.origin = {
        custom: {
          domainName: 'api-asia.ts-minecraft.example.com',
          port: 443,
          protocol: 'https',
          path: '/api'
        }
      };
    }
  }

  // Bot検出とレート制限
  const userAgent = headers['user-agent']?.[0]?.value || '';
  const botPatterns = [/bot/i, /crawler/i, /spider/i];
  const isBot = botPatterns.some(pattern => pattern.test(userAgent));

  if (isBot) {
    request.headers['x-is-bot'] = [{ key: 'X-Is-Bot', value: 'true' }];
  }

  return request;
};
```

## 高可用性とディザスタリカバリ

### Multi-Region デプロイメント

```yaml
# aws/multi-region-setup.yml
AWSTemplateFormatVersion: '2010-09-09'
Parameters:
  PrimaryRegion:
    Type: String
    Default: 'us-east-1'
  SecondaryRegion:
    Type: String
    Default: 'ap-northeast-1'

Resources:
  # Route53 Health Checks
  PrimaryHealthCheck:
    Type: 'AWS::Route53::HealthCheck'
    Properties:
      Type: HTTPS
      ResourcePath: /health
      FullyQualifiedDomainName: !Sub '${PrimaryRegion}-api.ts-minecraft.example.com'
      Port: 443
      RequestInterval: 30
      FailureThreshold: 3

  SecondaryHealthCheck:
    Type: 'AWS::Route53::HealthCheck'
    Properties:
      Type: HTTPS
      ResourcePath: /health
      FullyQualifiedDomainName: !Sub '${SecondaryRegion}-api.ts-minecraft.example.com'
      Port: 443
      RequestInterval: 30
      FailureThreshold: 3

  # DNS Failover
  DNSRecordPrimary:
    Type: 'AWS::Route53::RecordSet'
    Properties:
      HostedZoneId: !Ref HostedZone
      Name: api.ts-minecraft.example.com
      Type: A
      SetIdentifier: 'Primary'
      Failover: PRIMARY
      HealthCheckId: !Ref PrimaryHealthCheck
      AliasTarget:
        DNSName: !GetAtt PrimaryALB.DNSName
        HostedZoneId: !GetAtt PrimaryALB.CanonicalHostedZoneID

  DNSRecordSecondary:
    Type: 'AWS::Route53::RecordSet'
    Properties:
      HostedZoneId: !Ref HostedZone
      Name: api.ts-minecraft.example.com
      Type: A
      SetIdentifier: 'Secondary'
      Failover: SECONDARY
      AliasTarget:
        DNSName: !GetAtt SecondaryALB.DNSName
        HostedZoneId: !GetAtt SecondaryALB.CanonicalHostedZoneID
```

### データベースレプリケーション

```yaml
# k8s/database/postgres-cluster.yml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: ts-minecraft-postgres
spec:
  instances: 3
  primaryUpdateStrategy: unsupervised

  postgresql:
    parameters:
      max_connections: "200"
      shared_buffers: "256MB"
      effective_cache_size: "1GB"
      wal_buffers: "8MB"
      checkpoint_completion_target: "0.9"
      random_page_cost: "1.1"
      effective_io_concurrency: "200"

  bootstrap:
    initdb:
      database: minecraft
      owner: minecraft_user
      secret:
        name: postgres-credentials

  storage:
    size: 100Gi
    storageClass: fast-ssd

  monitoring:
    enabled: true
    prometheusRule:
      enabled: true

  backup:
    target: prefer-standby
    retentionPolicy: "30d"
    data:
      compression: gzip
      encryption: AES256
    wal:
      compression: gzip
      encryption: AES256
```

## デプロイメント自動化

### GitHub Actions Multi-Environment

```yaml
# .github/workflows/multi-env-deploy.yml
name: Multi-Environment Deployment

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
      image-digest: ${{ steps.build.outputs.digest }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha,prefix={{branch}}-

      - id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    if: github.ref == 'refs/heads/develop'
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: azure/setup-helm@v3
      - uses: azure/setup-kubectl@v3

      - name: Deploy to Staging
        run: |
          helm upgrade --install ts-minecraft-staging ./helm/ts-minecraft \
            --namespace staging \
            --create-namespace \
            --set image.repository=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }} \
            --set image.tag=${{ needs.build.outputs.image-tag }} \
            --set environment=staging \
            --set replicas=2 \
            --values ./helm/ts-minecraft/values-staging.yaml

  deploy-production:
    if: github.ref == 'refs/heads/main'
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: azure/setup-helm@v3
      - uses: azure/setup-kubectl@v3

      - name: Blue-Green Deployment
        run: |
          # 現在のバージョンを取得
          CURRENT_VERSION=$(kubectl get service ts-minecraft-service -o jsonpath='{.spec.selector.version}' || echo "blue")
          NEW_VERSION="green"
          if [ "$CURRENT_VERSION" = "green" ]; then
            NEW_VERSION="blue"
          fi

          echo "Deploying to version: $NEW_VERSION"

          # 新バージョンをデプロイ
          helm upgrade --install ts-minecraft-$NEW_VERSION ./helm/ts-minecraft \
            --namespace production \
            --create-namespace \
            --set image.repository=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }} \
            --set image.tag=${{ needs.build.outputs.image-tag }} \
            --set version=$NEW_VERSION \
            --set environment=production \
            --set replicas=3 \
            --values ./helm/ts-minecraft/values-production.yaml

          # ヘルスチェック
          kubectl wait --for=condition=ready pod -l app=ts-minecraft,version=$NEW_VERSION -n production --timeout=300s

          # トラフィック切り替え
          kubectl patch service ts-minecraft-service -n production -p '{"spec":{"selector":{"version":"'$NEW_VERSION'"}}}'

          echo "Deployment completed: $NEW_VERSION"
```

## パフォーマンス最適化デプロイメント

### オートスケーリング設定

```yaml
# k8s/scaling/hpa.yml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ts-minecraft-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ts-minecraft
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "100"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60

---
apiVersion: autoscaling/v1
kind: VerticalPodAutoscaler
metadata:
  name: ts-minecraft-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ts-minecraft
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: ts-minecraft
      maxAllowed:
        cpu: 2
        memory: 4Gi
      minAllowed:
        cpu: 100m
        memory: 128Mi
```

### クラスターオートスケーラー

```yaml
# k8s/scaling/cluster-autoscaler.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cluster-autoscaler
  namespace: kube-system
  labels:
    app: cluster-autoscaler
spec:
  selector:
    matchLabels:
      app: cluster-autoscaler
  template:
    metadata:
      labels:
        app: cluster-autoscaler
    spec:
      serviceAccountName: cluster-autoscaler
      containers:
      - image: k8s.gcr.io/autoscaling/cluster-autoscaler:v1.21.0
        name: cluster-autoscaler
        resources:
          limits:
            cpu: 100m
            memory: 300Mi
          requests:
            cpu: 100m
            memory: 300Mi
        command:
        - ./cluster-autoscaler
        - --v=4
        - --stderrthreshold=info
        - --cloud-provider=aws
        - --skip-nodes-with-local-storage=false
        - --expander=least-waste
        - --node-group-auto-discovery=asg:tag=k8s.io/cluster-autoscaler/enabled,k8s.io/cluster-autoscaler/ts-minecraft
        - --balance-similar-node-groups
        - --scale-down-enabled=true
        - --scale-down-delay-after-add=10m
        - --scale-down-unneeded-time=10m
        - --max-node-provision-time=15m
        env:
        - name: AWS_REGION
          value: us-east-1
```

## 関連ドキュメント

- [Docker デプロイメント](./docker-deployment.md) - 基本的なコンテナ化手法
- [CI/CD デプロイメント](./ci-cd-deployment.md) - 継続的デプロイメント
- [パフォーマンス最適化](./performance-optimization.md) - 性能最適化手法
- [トラブルシューティング・モニタリング](./troubleshooting-monitoring.md) - 運用監視