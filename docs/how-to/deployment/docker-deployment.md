---
title: "Docker コンテナデプロイメント完全ガイド"
description: "TypeScript Minecraft Clone の Docker コンテナ化、マルチステージビルド、Kubernetes 対応、開発・本番環境の完全セットアップ"
category: "deployment"
difficulty: "intermediate"
tags: ["docker", "containerization", "kubernetes", "devops", "production", "microservices"]
prerequisites: ["basic-docker", "deployment-basics", "linux-basics"]
estimated_reading_time: "25分"
related_docs: ["./ci-cd-deployment.md", "./performance-optimization.md"]
---

# Docker コンテナデプロイメント完全ガイド

> **🎯 このガイドの目標**: TypeScript Minecraft Clone を Docker で完全コンテナ化し、開発から本番まで一貫したデプロイメント環境を構築

## 📋 Docker化の戦略

### 🔄 **コンテナアーキテクチャ**
```mermaid
graph TB
    subgraph "Production Environment"
        A[Nginx Reverse Proxy] --> B[Game Application Container]
        A --> C[Static Assets CDN]
        B --> D[Redis Cache]
        B --> E[Database Container]
    end

    subgraph "Development Environment"
        F[Game Dev Container] --> G[Hot Reload Volume]
        F --> H[Dev Database]
        I[Testing Container] --> J[Test Database]
    end
```

### 📦 **コンテナ構成**
| コンテナ | 用途 | 最適化ポイント |
|----------|------|----------------|
| **game-app** | メインアプリケーション | マルチステージビルド、軽量ベースイメージ |
| **nginx** | リバースプロキシ・静的配信 | Gzip圧縮、HTTP/2、キャッシュ戦略 |
| **redis** | ゲーム状態キャッシュ | メモリ最適化、永続化設定 |
| **database** | データ永続化 | 高速SSD、バックアップ戦略 |

---

## ⚙️ Dockerfile 設計

### 🏗️ **マルチステージ本番用 Dockerfile**

```dockerfile
# Stage 1: 依存関係インストール
FROM node:20-alpine AS deps
WORKDIR /app

# パッケージマネージャーファイルのコピー
COPY package.json package-lock.json ./
COPY .npmrc* ./

# 本番依存関係のインストール（キャッシュ最適化）
RUN npm ci --only=production && npm cache clean --force

# Stage 2: ビルド環境
FROM node:20-alpine AS builder
WORKDIR /app

# 開発依存関係を含む全依存関係
COPY package.json package-lock.json ./
RUN npm ci

# ソースコードとビルド設定
COPY . .
COPY tsconfig.json vite.config.ts ./

# TypeScript型チェックとビルド
RUN npm run type-check
RUN npm run build

# アセット最適化
RUN npm run optimize-assets

# Stage 3: 本番実行環境
FROM node:20-alpine AS runner

# セキュリティ：非root ユーザーの作成
RUN addgroup --system --gid 1001 minecraft && \
    adduser --system --uid 1001 minecraft

WORKDIR /app

# 必要な依存関係とビルド成果物のコピー
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY package.json ./

# 実行時必要なツールのインストール
RUN apk add --no-cache \
    dumb-init \
    curl \
    tzdata

# ディレクトリ権限の設定
RUN mkdir -p /app/data /app/logs && \
    chown -R minecraft:minecraft /app

# 非root ユーザーに切り替え
USER minecraft

# ヘルスチェック設定
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# プロセス管理とサーバー起動
EXPOSE 3000
CMD ["dumb-init", "node", "dist/server.js"]

# メタデータ
LABEL maintainer="minecraft-dev-team" \
      version="1.0.0" \
      description="TypeScript Minecraft Clone Game Server"
```

### 🚀 **開発用 Dockerfile.dev**

```dockerfile
FROM node:20-alpine

# 開発ツールのインストール
RUN apk add --no-cache \
    git \
    vim \
    curl \
    bash

WORKDIR /app

# パッケージインストール
COPY package.json package-lock.json ./
RUN npm ci

# ソースコードマウント用の設定
VOLUME ["/app/src", "/app/public"]

# 開発サーバー起動
EXPOSE 3000 5173 4173
CMD ["npm", "run", "dev"]
```

---

## 🐳 Docker Compose 設定

### 📄 **本番用 docker-compose.prod.yml**

```yaml
version: '3.8'

services:
  # ゲームアプリケーション
  minecraft-app:
    build:
      context: .
      dockerfile: Dockerfile
      target: runner
    container_name: minecraft-game
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=3000
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://user:password@postgres:5432/minecraft
      - LOG_LEVEL=info
    volumes:
      - game-data:/app/data
      - logs:/app/logs
    depends_on:
      - redis
      - postgres
    networks:
      - minecraft-network
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M

  # Nginx リバースプロキシ
  nginx:
    image: nginx:alpine
    container_name: minecraft-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/sites-enabled:/etc/nginx/sites-enabled:ro
      - ./ssl:/etc/nginx/ssl:ro
      - logs:/var/log/nginx
    depends_on:
      - minecraft-app
    networks:
      - minecraft-network
    deploy:
      resources:
        limits:
          memory: 256M

  # Redis キャッシュ
  redis:
    image: redis:7-alpine
    container_name: minecraft-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis-data:/data
    networks:
      - minecraft-network
    deploy:
      resources:
        limits:
          memory: 512M

  # PostgreSQL データベース
  postgres:
    image: postgres:15-alpine
    container_name: minecraft-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_DB=minecraft
      - POSTGRES_USER=minecraft
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - minecraft-network
    deploy:
      resources:
        limits:
          memory: 1G

  # 監視: Prometheus
  prometheus:
    image: prom/prometheus:latest
    container_name: minecraft-prometheus
    restart: unless-stopped
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - minecraft-network

  # 監視: Grafana
  grafana:
    image: grafana/grafana:latest
    container_name: minecraft-grafana
    restart: unless-stopped
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes:
      - grafana-data:/var/lib/grafana
      - ./monitoring/grafana:/etc/grafana/provisioning:ro
    ports:
      - "3001:3000"
    depends_on:
      - prometheus
    networks:
      - minecraft-network

volumes:
  game-data:
    driver: local
  postgres-data:
    driver: local
  redis-data:
    driver: local
  logs:
    driver: local
  prometheus-data:
    driver: local
  grafana-data:
    driver: local

networks:
  minecraft-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

### 🚧 **開発用 docker-compose.dev.yml**

```yaml
version: '3.8'

services:
  minecraft-dev:
    build:
      context: .
      dockerfile: Dockerfile.dev
    container_name: minecraft-dev
    environment:
      - NODE_ENV=development
      - VITE_DEV_SERVER_HOST=0.0.0.0
    volumes:
      - .:/app
      - node_modules:/app/node_modules
    ports:
      - "3000:3000"  # アプリケーション
      - "5173:5173"  # Vite開発サーバー
      - "4173:4173"  # Vite プレビューサーバー
    depends_on:
      - postgres-dev
      - redis-dev
    networks:
      - minecraft-dev

  postgres-dev:
    image: postgres:15-alpine
    container_name: minecraft-postgres-dev
    environment:
      - POSTGRES_DB=minecraft_dev
      - POSTGRES_USER=dev
      - POSTGRES_PASSWORD=dev123
    volumes:
      - postgres-dev-data:/var/lib/postgresql/data
      - ./sql/dev-seed.sql:/docker-entrypoint-initdb.d/seed.sql:ro
    ports:
      - "5432:5432"
    networks:
      - minecraft-dev

  redis-dev:
    image: redis:7-alpine
    container_name: minecraft-redis-dev
    command: redis-server --maxmemory 128mb
    ports:
      - "6379:6379"
    networks:
      - minecraft-dev

volumes:
  node_modules:
  postgres-dev-data:

networks:
  minecraft-dev:
    driver: bridge
```

---

## 🌐 Nginx 設定

### 📄 **nginx/nginx.conf**

```nginx
user nginx;
worker_processes auto;

error_log /var/log/nginx/error.log notice;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # ログ形式
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                   '$status $body_bytes_sent "$http_referer" '
                   '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    # 基本設定
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 10M;

    # Gzip圧縮
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # セキュリティヘッダー
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # 仮想ホスト設定を読み込み
    include /etc/nginx/sites-enabled/*;
}
```

### 📄 **nginx/sites-enabled/minecraft.conf**

```nginx
# アップストリーム定義
upstream minecraft_backend {
    server minecraft-app:3000;
    keepalive 32;
}

# HTTP -> HTTPS リダイレクト
server {
    listen 80;
    server_name minecraft.example.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS メインサーバー
server {
    listen 443 ssl http2;
    server_name minecraft.example.com;

    # SSL設定
    ssl_certificate /etc/nginx/ssl/minecraft.crt;
    ssl_certificate_key /etc/nginx/ssl/minecraft.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # セキュリティヘッダー
    add_header Strict-Transport-Security "max-age=63072000" always;

    # 静的ファイルの配信
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /var/www/minecraft/static;
        expires 1y;
        add_header Cache-Control "public, immutable";

        # 存在しない場合はバックエンドに転送
        try_files $uri @backend;
    }

    # ゲームアセット（大きなファイル）
    location /assets/ {
        root /var/www/minecraft;
        expires 1M;
        add_header Cache-Control "public";

        # 範囲リクエスト対応（大きなファイル用）
        add_header Accept-Ranges bytes;

        try_files $uri @backend;
    }

    # API エンドポイント
    location /api/ {
        proxy_pass http://minecraft_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # タイムアウト設定
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket接続（ゲームの実時間通信）
    location /ws {
        proxy_pass http://minecraft_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket専用設定
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_connect_timeout 60;
    }

    # メインアプリケーション
    location / {
        try_files $uri @backend;
    }

    # バックエンドにフォールバック
    location @backend {
        proxy_pass http://minecraft_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # ヘルスチェック
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

---

## 🚀 デプロイメントスクリプト

### 📄 **deploy.sh**

```bash
#!/bin/bash

set -euo pipefail

# 設定
DOCKER_REGISTRY="your-registry.com"
IMAGE_NAME="minecraft-game"
VERSION=${1:-$(git rev-parse --short HEAD)}
ENVIRONMENT=${2:-production}

echo "🚀 Starting deployment for $ENVIRONMENT environment..."

# 1. 環境変数の読み込み
if [ -f ".env.${ENVIRONMENT}" ]; then
    export $(cat .env.${ENVIRONMENT} | grep -v '^#' | xargs)
fi

# 2. Docker イメージのビルド
echo "📦 Building Docker image..."
docker build \
    --build-arg NODE_ENV=$ENVIRONMENT \
    --build-arg BUILD_VERSION=$VERSION \
    -t $IMAGE_NAME:$VERSION \
    -t $IMAGE_NAME:latest \
    .

# 3. イメージの品質チェック
echo "🔍 Running security scan..."
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
    -v $(pwd)/reports:/reports \
    aquasec/trivy image --exit-code 0 --format json \
    --output /reports/vulnerability-report.json \
    $IMAGE_NAME:$VERSION

# 4. レジストリにプッシュ（本番環境のみ）
if [ "$ENVIRONMENT" = "production" ]; then
    echo "📤 Pushing to registry..."
    docker tag $IMAGE_NAME:$VERSION $DOCKER_REGISTRY/$IMAGE_NAME:$VERSION
    docker tag $IMAGE_NAME:latest $DOCKER_REGISTRY/$IMAGE_NAME:latest
    docker push $DOCKER_REGISTRY/$IMAGE_NAME:$VERSION
    docker push $DOCKER_REGISTRY/$IMAGE_NAME:latest
fi

# 5. デプロイメント実行
echo "🔄 Deploying to $ENVIRONMENT..."
case $ENVIRONMENT in
    "development"|"dev")
        docker-compose -f docker-compose.dev.yml up -d
        ;;
    "staging")
        docker-compose -f docker-compose.staging.yml up -d
        ;;
    "production"|"prod")
        docker-compose -f docker-compose.prod.yml up -d
        ;;
    *)
        echo "❌ Unknown environment: $ENVIRONMENT"
        exit 1
        ;;
esac

# 6. ヘルスチェック
echo "🏥 Running health check..."
for i in {1..30}; do
    if curl -f http://localhost/health > /dev/null 2>&1; then
        echo "✅ Deployment successful!"
        break
    fi

    if [ $i -eq 30 ]; then
        echo "❌ Health check failed after 30 attempts"
        echo "📋 Container logs:"
        docker-compose -f docker-compose.$ENVIRONMENT.yml logs --tail=50
        exit 1
    fi

    echo "⏳ Waiting for health check... ($i/30)"
    sleep 10
done

# 7. クリーンアップ
echo "🧹 Cleaning up old images..."
docker system prune -f
docker image prune -a -f --filter "until=72h"

echo "🎉 Deployment completed successfully!"
echo "🌐 Application is available at: http://localhost"
if [ "$ENVIRONMENT" = "production" ]; then
    echo "📊 Monitoring: http://localhost:3001 (Grafana)"
    echo "📈 Metrics: http://localhost:9090 (Prometheus)"
fi
```

### 📄 **docker-health-check.sh**

```bash
#!/bin/bash

# Docker コンテナヘルスチェックスクリプト

check_container_health() {
    local container_name=$1
    local health_status

    health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null)

    case $health_status in
        "healthy")
            echo "✅ $container_name is healthy"
            return 0
            ;;
        "unhealthy")
            echo "❌ $container_name is unhealthy"
            docker logs --tail=20 "$container_name"
            return 1
            ;;
        "starting")
            echo "⏳ $container_name is starting..."
            return 2
            ;;
        *)
            echo "❓ $container_name health status unknown: $health_status"
            return 3
            ;;
    esac
}

check_service_connectivity() {
    local service_url=$1
    local service_name=$2

    if curl -f -s --max-time 10 "$service_url" > /dev/null; then
        echo "✅ $service_name is accessible"
        return 0
    else
        echo "❌ $service_name is not accessible at $service_url"
        return 1
    fi
}

main() {
    echo "🏥 Docker Health Check Starting..."

    local exit_code=0

    # コンテナヘルスチェック
    containers=("minecraft-game" "minecraft-nginx" "minecraft-redis" "minecraft-postgres")

    for container in "${containers[@]}"; do
        if ! check_container_health "$container"; then
            exit_code=1
        fi
    done

    # サービス接続確認
    services=(
        "http://localhost/health:Game API"
        "http://localhost/api/status:Game Status"
        "http://localhost:9090/-/healthy:Prometheus"
    )

    for service in "${services[@]}"; do
        IFS=':' read -r url name <<< "$service"
        if ! check_service_connectivity "$url" "$name"; then
            exit_code=1
        fi
    done

    if [ $exit_code -eq 0 ]; then
        echo "🎉 All services are healthy!"
    else
        echo "⚠️ Some services have issues"
    fi

    exit $exit_code
}

main "$@"
```

---

## 🏗️ Kubernetes 対応

### 📄 **k8s/deployment.yml**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minecraft-game
  namespace: minecraft
  labels:
    app: minecraft-game
    version: v1
spec:
  replicas: 3
  selector:
    matchLabels:
      app: minecraft-game
  template:
    metadata:
      labels:
        app: minecraft-game
        version: v1
    spec:
      containers:
      - name: minecraft-game
        image: your-registry.com/minecraft-game:latest
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: minecraft-secrets
              key: redis-url
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: minecraft-secrets
              key: database-url
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 2000m
            memory: 2Gi
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: game-data
          mountPath: /app/data
      volumes:
      - name: game-data
        persistentVolumeClaim:
          claimName: minecraft-data-pvc

---
apiVersion: v1
kind: Service
metadata:
  name: minecraft-service
  namespace: minecraft
spec:
  selector:
    app: minecraft-game
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: minecraft-ingress
  namespace: minecraft
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - minecraft.example.com
    secretName: minecraft-tls
  rules:
  - host: minecraft.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: minecraft-service
            port:
              number: 80
```

---

## 📊 監視・ログ設定

### 📄 **monitoring/prometheus.yml**

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert-rules.yml"

scrape_configs:
  - job_name: 'minecraft-game'
    static_configs:
      - targets: ['minecraft-app:3000']
    metrics_path: '/api/metrics'
    scrape_interval: 10s

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:9113']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:9187']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### 📄 **logging/fluent-bit.conf**

```ini
[SERVICE]
    Flush         1
    Log_Level     info
    Daemon        off
    Parsers_File  parsers.conf

[INPUT]
    Name              tail
    Path              /app/logs/*.log
    Parser            json
    Tag               minecraft.app
    Refresh_Interval  5

[INPUT]
    Name              systemd
    Tag               minecraft.system
    Systemd_Filter    _SYSTEMD_UNIT=docker.service

[OUTPUT]
    Name  es
    Match *
    Host  elasticsearch
    Port  9200
    Index minecraft-logs
    Type  _doc
```

---

## 🛡️ セキュリティ設定

### 📄 **.dockerignore**

```dockerignore
# 開発ファイル
node_modules
npm-debug.log*
.env.local
.env.development

# Git
.git
.gitignore
README.md

# テスト
coverage/
test/
*.test.js

# ドキュメント
docs/
*.md

# IDE
.vscode/
.idea/

# ログ
logs/
*.log

# 一時ファイル
.tmp/
*.tmp
.cache/

# セキュリティファイル
private/
secrets/
*.pem
*.key
*.crt
```

### 🔒 **セキュリティベストプラクティス**

```bash
# Docker セキュリティスキャン
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  -v $(pwd):/src \
  aquasec/trivy fs --security-checks vuln,config /src

# 脆弱性チェック
npm audit --audit-level moderate

# Docker Bench Security
docker run -it --net host --pid host --userns host --cap-add audit_control \
    -e DOCKER_CONTENT_TRUST=$DOCKER_CONTENT_TRUST \
    -v /etc:/etc:ro \
    -v /usr/bin/containerd:/usr/bin/containerd:ro \
    -v /usr/bin/runc:/usr/bin/runc:ro \
    -v /usr/lib/systemd:/usr/lib/systemd:ro \
    -v /var/lib:/var/lib:ro \
    -v /var/run/docker.sock:/var/run/docker.sock:ro \
    --label docker_bench_security \
    docker/docker-bench-security
```

---

## 🚀 実行手順

### 📋 **初期セットアップ**

```bash
# 1. 環境設定
cp .env.example .env.production
vim .env.production  # 本番設定を入力

# 2. SSL証明書の準備
mkdir -p nginx/ssl
# SSL証明書をnginx/ssl/に配置

# 3. データベース初期化スクリプト
cat > init.sql << 'EOF'
CREATE DATABASE minecraft;
CREATE USER minecraft WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE minecraft TO minecraft;
EOF

# 4. 本番デプロイ実行
./deploy.sh $(git rev-parse --short HEAD) production

# 5. ヘルスチェック
./docker-health-check.sh
```

### 🧪 **開発環境セットアップ**

```bash
# 開発環境起動
docker-compose -f docker-compose.dev.yml up -d

# ログ確認
docker-compose -f docker-compose.dev.yml logs -f minecraft-dev

# テスト実行
docker-compose -f docker-compose.dev.yml exec minecraft-dev npm test

# 開発環境停止
docker-compose -f docker-compose.dev.yml down
```

---

## 📈 パフォーマンス最適化

### 🔧 **Docker 最適化設定**

```bash
# Docker daemon 最適化 (/etc/docker/daemon.json)
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "storage-opts": [
    "overlay2.override_kernel_check=true"
  ],
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 64000,
      "Soft": 64000
    }
  }
}

# システム最適化
echo 'vm.max_map_count=262144' >> /etc/sysctl.conf
echo 'net.core.somaxconn=65535' >> /etc/sysctl.conf
sysctl -p
```

このDockerデプロイメントガイドにより、TypeScript Minecraft Cloneを本格的な本番環境で安全かつ効率的に運用できます。開発から本番まで一貫したコンテナ環境での開発・デプロイ体験を提供します。