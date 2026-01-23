# Trade Demo Frontend Docker Compose Integration Design

Date: 2026-01-16
Updated: 2026-01-19

## Problem

The trade-demo-frontend service needs to be added to the performance testing docker-compose stack. Previous attempts failed with HTTP 500 errors during the OAuth callback from DEFRA ID stub to the frontend.

## Root Cause

The defra-id-stub was not configured with `APP_BASE_URL`, so it defaulted to `http://localhost:3200`. This caused the OIDC discovery document to return endpoint URLs with `localhost`:

```json
{
  "authorization_endpoint": "http://localhost:3200/cdp-defra-id-stub/authorize",
  "token_endpoint": "http://localhost:3200/cdp-defra-id-stub/token"
}
```

**The OAuth flow has two phases:**
1. **Browser-based authorization** (frontend → browser → defra-id-stub → browser → frontend callback)
2. **Server-side token exchange** (frontend container → defra-id-stub token endpoint)

When the frontend container tried to call `http://localhost:3200/token` for the token exchange, it failed because `localhost` inside the frontend container points to itself, not to defra-id-stub.

## Solution

The solution requires coordinating URLs across three different contexts:

### 1. Host /etc/hosts Configuration

Add hostname resolution for the browser:
```bash
sudo nano /etc/hosts
# Add:
127.0.0.1  defra-id-stub
```

This allows the browser to resolve `defra-id-stub` to localhost, enabling it to reach the defra-id-stub container via the published port 3200.

### 2. Defra-ID-Stub Configuration

Set `APP_BASE_URL` to use the service name:
```yaml
defra-id-stub:
  environment:
    APP_BASE_URL: http://defra-id-stub:3200
    REDIRECT_URLS: http://trade-demo-frontend:3000/auth/callback
```

This makes the OIDC discovery document return URLs like:
- `http://defra-id-stub:3200/cdp-defra-id-stub/authorize` (browser can resolve via /etc/hosts)
- `http://defra-id-stub:3200/cdp-defra-id-stub/token` (containers can resolve via Docker DNS)

### 3. Container-to-Container URLs

All internal service URLs use Docker service names:
- DEFRA ID: `http://defra-id-stub:3200/...`
- Backend API: `http://trade-demo-backend:8085`
- Commodity API: `http://trade-commodity-codes:8086`
- Redis: `redis:6379`

### Why This Works

- **Browser** resolves `defra-id-stub` → `127.0.0.1` (via /etc/hosts) → reaches port 3200 on host → Docker port mapping → defra-id-stub container
- **Containers** resolve `defra-id-stub` → defra-id-stub container IP (via Docker DNS) → direct container communication
- Both contexts can successfully call the same URLs returned by the OIDC discovery endpoint

### Build Strategy

The frontend uses the `development` Dockerfile target which expects assets to be pre-built on the host. This is required because:
1. The `@defra/cdp-auditing` postinstall script hangs in Docker
2. webpack/sass-embedded has platform emulation issues
3. This matches the CDP template pattern

Before starting the compose stack, run:
```bash
cd ../trade-demo-frontend && npm run build:frontend
```

Or use the Makefile if available.

## Configuration

### Service Definition

```yaml
trade-demo-frontend:
  build:
    context: ../trade-demo-frontend
    target: development
  container_name: cdp-trade-demo-frontend
  profiles: ['services', 'performance']
  ports:
    - '3000:3000'
    - '9229:9229'  # Debug port
  depends_on:
    redis:
      condition: service_healthy
    localstack:
      condition: service_healthy
    defra-id-stub:
      condition: service_healthy
    trade-demo-backend:
      condition: service_healthy
    trade-commodity-codes:
      condition: service_healthy
  env_file:
    - 'compose/aws.env'
  environment:
    PORT: 3000
    NODE_ENV: development

    # Redis configuration
    REDIS_HOST: redis
    REDIS_PORT: 6379
    SESSION_CACHE_ENGINE: redis
    USE_SINGLE_INSTANCE_CACHE: true
    REDIS_TLS: false

    # DEFRA ID configuration (service name, not localhost)
    DEFRA_ID_OIDC_CONFIGURATION_URL: http://defra-id-stub:3200/cdp-defra-id-stub/.well-known/openid-configuration
    DEFRA_ID_CLIENT_ID: test-client
    DEFRA_ID_CLIENT_SECRET: test-secret
    DEFRA_ID_SERVICE_ID: test-service

    # Backend API URLs (service names, not localhost)
    BACKEND_API_URL: http://trade-demo-backend:8085
    COMMODITY_CODE_API_URL: http://trade-commodity-codes:8086

    # OAuth callback (localhost for browser)
    APP_BASE_URL: http://localhost:3000

    # Development settings
    LOG_LEVEL: debug
    LOG_FORMAT: pino-pretty
    ENABLE_SECURE_CONTEXT: false
    ENABLE_METRICS: false
  networks:
    - cdp-tenant
  healthcheck:
    test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 30s
```

### Key Configuration Details

1. **Profiles**: Added to `['services', 'performance']` so it starts with `docker compose --profile performance up`

2. **Dependencies**: Waits for all required services to be healthy before starting

3. **Health Check**:
   - Uses `localhost:3000` (checking from inside the container)
   - 30-second start period to allow Node.js initialization
   - Calls the `/health` endpoint

4. **Environment Variables**:
   - All internal service URLs use Docker service names
   - `APP_BASE_URL` uses `localhost` for browser OAuth flow
   - Development-friendly logging and security settings

## Usage

### Prerequisites

1. **Add defra-id-stub to /etc/hosts** (one-time setup):
```bash
sudo nano /etc/hosts
# Add this line:
127.0.0.1  defra-id-stub
```

2. **Build frontend assets**:
```bash
cd ../trade-demo-frontend
npm run build:frontend
cd ../trade-demo-perf-tests
```

### Start the Stack

```bash
docker compose --profile performance up
```

The frontend will be available at http://localhost:3000

**Note**: You can also access the defra-id-stub at http://defra-id-stub:3200 in your browser (thanks to the /etc/hosts entry)

## Testing

To verify the fix worked:
1. Check that the frontend container starts successfully
2. Verify health check passes: `docker compose ps`
3. Access http://localhost:3000 in a browser
4. Attempt to authenticate via DEFRA ID stub
5. Verify backend API calls work (dashboard, commodity code searches)

## Future Considerations

- The `development` target requires pre-built assets on the host. Consider documenting this requirement in the main README.
- If the production_build Dockerfile issues are resolved, could switch to that target for a simpler workflow.
