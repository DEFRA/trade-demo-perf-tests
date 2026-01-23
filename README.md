# trade-demo-perf-tests

A k6-based performance test suite for the trade-demo-frontend application on the CDP Platform.

## Architecture

This project provides k6-based load testing for the trade-demo-frontend import notification journey:

- **k6 HTTP-based load testing**: Direct HTTP requests for high concurrency testing
- **Live DEFRA ID authentication**: Each virtual user authenticates via the DEFRA ID stub during test execution
- **Complete journey validation**: Tests the full import notification flow from login to submission

### User Pool Management

Tests require authenticated users from the DEFRA ID stub. User pools are created before tests and expired afterward:

- Users follow predictable naming: `k6-perf-user-1@example.com`, `k6-perf-user-2@example.com`, etc.
- Each k6 Virtual User (VU) gets a dedicated user from the pool (VU 1 uses user-1, VU 2 uses user-2, etc.)
- Pool size is controlled by `VUS_MAX` environment variable
- Setup script creates users via DEFRA ID stub API (`POST /cdp-defra-id-stub/API/register`)
- Cleanup script expires users after test completion (`POST /cdp-defra-id-stub/API/register/{userId}/expire`)
- User details (including userId) are stored in `users-pool.json` for cleanup

## Table of Contents

- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Test Journey](#test-journey)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Test Output](#test-output)
- [Available npm Scripts](#available-npm-scripts)
- [Advanced Configuration](#advanced-configuration)
- [How Authentication Works](#how-authentication-works)
- [Troubleshooting](#troubleshooting)
- [Build](#build)
- [Run](#run)
- [Local Testing with Docker Compose](#local-testing-with-docker-compose)
- [Licence](#licence)

## Project Structure

```
trade-demo-perf-tests/
├── src/
│   ├── lib/
│   │   └── defra-id-stub-client.js         # DEFRA ID stub API client
│   ├── setup/
│   │   ├── create-user-pool.js             # Creates user pool before tests
│   │   └── cleanup-user-pool.js            # Expires users after tests
│   └── tests/
│       ├── trade-import-notification.js    # Main k6 performance test
│       └── notification-journey.js         # Legacy test (deprecated)
├── entrypoint.sh                           # Orchestrates setup → test → teardown
├── package.json
├── users-pool.json                         # Generated: user pool data with userIds
├── index.html                              # Generated: HTML test report
├── summary.json                            # Generated: JSON test results
└── Dockerfile
```

## Test Journey

The k6 test (`trade-import-notification.js`) executes the complete import notification journey:

1. **Authentication**: Login via DEFRA ID stub (scrapes HTML to find user-specific login link)
2. **Home Page**: Verify authenticated landing page
3. **Dashboard**: Navigate to user dashboard
4. **Origin**: Select random country of origin from EU/international list
5. **Commodity Search**: Search for commodity code (0102 - Live bovine animals)
6. **Commodity Selection**: Select species (Bison bison)
7. **Quantities**: Enter random number of animals and packs
8. **Purpose**: Select random internal market purpose (e.g., Slaughter, Commercial Sale)
9. **Transport**: Enter BCP (Dover) and random vehicle identifier
10. **Review Validation**: Validate all entered data appears correctly on review page
11. **Change Journey**: Modify commodity quantities and resubmit through the flow
12. **Second Review Validation**: Re-validate review page with updated data
13. **Submit**: Submit notification and verify confirmation

## Quick Start

### Prerequisites

1. Ensure the services are running:
```bash
docker compose --profile performance up -d
```
This will start:
- localstack (S3, SNS, SQS, etc.)
- DEFRA ID stub (port 3200)
- trade-demo-frontend (port 3000)
- redis (cache)
- postgres (trade-commodity-codes)
- mongodb (trade-demo-backend)
- trade-commodity-codes (commodity codes service)
  - trade-commodity-codes liquibase schema
  - trade-commodity-codes liquibase data
- trade-demo-backend (trade-demo-backend)


2. Install dependencies:
```bash
npm install
```

### Run Performance Test

Full workflow (recommended):
```bash
VUS_MAX=5 \
RAMP_UP_DURATION=10s \
HOLD_DURATION=20s \
RAMP_DOWN_DURATION=5s \
npm run test:new
```

Or run steps individually:
```bash
VUS_MAX=5 npm run setup:users     # Create user pool
VUS_MAX=5 npm run k6:new          # Run k6 test
npm run cleanup:users              # Expire users
```

## Environment Variables

### Test Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `TARGET_URL` | `http://localhost:3000` | Frontend URL to test |
| `VUS_MAX` | `50` | Maximum virtual users (determines pool size) |
| `RAMP_UP_DURATION` | `5m` | Time to ramp up to max VUs |
| `HOLD_DURATION` | `10m` | Time to hold at max VUs |
| `RAMP_DOWN_DURATION` | `2m` | Time to ramp down to zero |

### Thresholds

| Variable | Default | Description |
|----------|---------|-------------|
| `THRESHOLD_P95_MS` | `3000` | 95th percentile response time (ms) |
| `THRESHOLD_P99_MS` | `5000` | 99th percentile response time (ms) |
| `THRESHOLD_ERROR_RATE` | `0.01` | Maximum error rate (1%) |

### User Pool Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `USER_POOL_PREFIX` | `k6-perf-user` | Email prefix for test users |
| `USER_POOL_DOMAIN` | `example.com` | Email domain for test users |
| `DEFRA_ID_STUB_URL` | `http://localhost:3200` | DEFRA ID stub URL |

### AWS/S3 Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `S3_ENDPOINT` | `https://s3.eu-west-2.amazonaws.com` | S3 endpoint URL |
| `RESULTS_OUTPUT_S3_PATH` | (none) | S3 path for results (e.g., `s3://bucket/path`) |
| `AWS_REGION` | `eu-west-2` | AWS region |
| `AWS_ACCESS_KEY_ID` | (required if using S3) | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | (required if using S3) | AWS secret key |

## Build

Test suites are built automatically by the [.github/workflows/publish.yml](.github/workflows/publish.yml) action whenever a change are committed to the `main` branch.
A successful build results in a Docker container that is capable of running your tests on the CDP Platform and publishing the results to the CDP Portal.

## Run

The performance test suites are designed to be run from the CDP Portal.
The CDP Platform runs test suites in much the same way it runs any other service, it takes a docker image and runs it as an ECS task, automatically provisioning infrastructure as required.

## Local Testing with Docker Compose

You can run the entire performance test stack locally using Docker Compose, including LocalStack, Redis, and the target service. This is useful for development, integration testing, or verifying your test scripts **before committing to `main`**, which will trigger GitHub Actions to build and publish the Docker image.

### Prerequisites

#### 1. Configure /etc/hosts (one-time setup)

Add `defra-id-stub` to your system hosts file so the browser can resolve it:

```bash
sudo nano /etc/hosts
# Add this line:
127.0.0.1  defra-id-stub
```

This is required for OAuth authentication to work correctly. The OIDC discovery endpoint returns URLs with `defra-id-stub` as the hostname, which must be resolvable by both your browser and the Docker containers.

#### 2. Build Frontend Assets

Before starting the stack, you must build the frontend assets:

```bash
cd ../trade-demo-frontend
npm run build:frontend
cd ../trade-demo-perf-tests
```

This is required because the frontend's Dockerfile development target expects pre-built assets on the host.

### Build the Docker image

```bash
docker compose build --no-cache development
```

This ensures any changes to `entrypoint.sh` or other scripts are picked up properly.

---

### Start the full test stack

Use the `performance` profile to start all required services:

```bash
docker compose --profile performance up --build
```

This brings up:

* `development`: the container that runs your performance tests
* `localstack`: simulates AWS S3, SNS, SQS, etc.
* `redis`: backing service for cache
* `postgres`: PostgreSQL database for trade-commodity-codes
* `mongodb`: MongoDB database for trade-demo-backend
* `defra-id-stub`: DEFRA ID authentication stub
* `trade-demo-frontend`: Node.js/Hapi.js frontend (port 3000)
* `trade-demo-backend`: Spring Boot backend (port 8085)
* `trade-commodity-codes`: Spring Boot commodity codes service (port 8086)

Once all services are healthy, your performance tests will automatically start.

---

### Access the Services

Once the stack is running:

* **Frontend**: http://localhost:3000 (includes DEFRA ID authentication)
* **Backend API**: http://localhost:8085/health
* **Commodity Codes API**: http://localhost:8086/health
* **DEFRA ID Stub**: http://localhost:3200

---

### Notes

* **IMPORTANT**: `/etc/hosts` must include `127.0.0.1  defra-id-stub` for OAuth authentication to work (see Prerequisites above)
* **Frontend assets**: Must be pre-built on the host before starting the stack (see Prerequisites above)
* S3 bucket is expected to be `s3://test-results`, automatically created inside LocalStack
* Logs and reports are written to `./reports` on your host
* `entrypoint.sh` should contain the logic to wait for dependencies and kick off the test run
* The `depends_on` healthchecks ensure services like `localstack` and all backends are ready before tests start
* If you make changes to test scripts or entrypoints, rerun with:

```bash
docker compose --profile performance up --build
```

## Local Testing with LocalStack

### Build a new Docker image
```
docker build . -t my-performance-tests
```
### Create a Localstack bucket
```
aws --endpoint-url=localhost:4566 s3 mb s3://my-bucket
```

### Run performance tests

```
docker run \
-e S3_ENDPOINT='http://host.docker.internal:4566' \
-e RESULTS_OUTPUT_S3_PATH='s3://my-bucket' \
-e AWS_ACCESS_KEY_ID='test' \
-e AWS_SECRET_ACCESS_KEY='test' \
-e AWS_SECRET_KEY='test' \
-e AWS_REGION='eu-west-2' \
my-performance-tests
```

docker run -e S3_ENDPOINT='http://host.docker.internal:4566' -e RESULTS_OUTPUT_S3_PATH='s3://cdp-infra-dev-test-results/cdp-portal-perf-tests/95a01432-8f47-40d2-8233-76514da2236a' -e AWS_ACCESS_KEY_ID='test' -e AWS_SECRET_ACCESS_KEY='test' -e AWS_SECRET_KEY='test' -e AWS_REGION='eu-west-2' -e ENVIRONMENT='perf-test' my-performance-tests

## Test Output

After running the test, the following files are generated:

- **`users-pool.json`**: Contains user pool data including userIds for cleanup
- **`index.html`**: Beautiful HTML performance report with metrics, graphs, and threshold results
- **`summary.json`**: Machine-readable JSON results for CI/CD integration

View the HTML report:
```bash
open index.html  # macOS
xdg-open index.html  # Linux
```

## Available npm Scripts

| Script | Description |
|--------|-------------|
| `npm run setup:users` | Create user pool via DEFRA ID stub API |
| `npm run cleanup:users` | Expire users from pool |
| `npm run k6:new` | Run the main k6 performance test |
| `npm run test:new` | Full workflow: setup → test → cleanup |
| `npm run k6:local` | Run legacy k6 test (deprecated) |
| `npm run test:full` | Full workflow with legacy test (deprecated) |

## Advanced Configuration

### Custom User Pool

```bash
VUS_MAX=10 \
USER_POOL_PREFIX=perf-test-user \
USER_POOL_DOMAIN=testing.com \
DEFRA_ID_STUB_URL=http://localhost:3200 \
npm run setup:users
```

### Custom Load Profile

```bash
VUS_MAX=100 \
RAMP_UP_DURATION=5m \
HOLD_DURATION=15m \
RAMP_DOWN_DURATION=2m \
TARGET_URL=http://localhost:3000 \
npm run k6:new
```

### Custom Thresholds

```bash
THRESHOLD_P95_MS=2000 \
THRESHOLD_P99_MS=4000 \
THRESHOLD_ERROR_RATE=0.005 \
npm run k6:new
```

## How Authentication Works

The k6 test uses live DEFRA ID stub authentication for each virtual user:

1. **User Pool Creation**: Setup script creates users via `POST /cdp-defra-id-stub/API/register` with predictable emails
2. **Login Flow**: Each VU navigates to `/auth/login` which redirects to the DEFRA ID stub
3. **User Selection**: K6 scrapes the stub's HTML to find the login link with query parameter `user={email}`
4. **Authentication**: K6 follows the user-specific link to complete OAuth flow
5. **Session Management**: K6 maintains session cookies throughout the journey
6. **CSRF Protection**: Each form page contains a hidden `crumb` field extracted from HTML
7. **Cleanup**: After tests, script calls `POST /cdp-defra-id-stub/API/register/{userId}/expire` to remove users

This approach provides realistic authentication load while maintaining test isolation (each VU has its own dedicated user).

## Troubleshooting

### Users Not Found During Cleanup

If cleanup fails to find `users-pool.json`:
```bash
# The file is generated during setup and must exist for cleanup
# Re-run setup if the file was deleted:
VUS_MAX=5 npm run setup:users
```

### Authentication Failures

If virtual users fail to authenticate:
1. Verify DEFRA ID stub is running: `curl http://localhost:3200`
2. Check user pool was created: `cat users-pool.json`
3. Ensure VUS_MAX matches between setup and test

### Crumb Extraction Failures

If tests fail with "crumb not found":
1. Verify frontend is running: `curl http://localhost:3000`
2. Check session cookies are being maintained
3. Look for redirect loops (indicates session issues)

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government licence v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
