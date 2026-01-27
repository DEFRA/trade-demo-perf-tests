#!/usr/bin/env bash

echo "run_id: $RUN_ID in $ENVIRONMENT"

K6_HOME=/opt/perftest
K6_REPORT=index.html
K6_SUMMARY=summary.json

export HTTPS_PROXY=http://localhost:3128

# Profile-based configuration for CDP deployments
K6_WORKLOAD=${PROFILE:-smoke}
K6_THRESHOLD=${K6_THRESHOLD:-low}
echo "Test Profile: workload=${K6_WORKLOAD}, threshold=${K6_THRESHOLD}"

# Set VUS_MAX for user pool creation based on workload profile
# These match the preAllocatedVUs or max target from workloads.js
case $K6_WORKLOAD in
  smoke)
    VUS_MAX=${VUS_MAX:-1}
    ;;
  load)
    VUS_MAX=${VUS_MAX:-1}
    ;;
  stress)
    VUS_MAX=${VUS_MAX:-300}
    ;;
  spike)
    VUS_MAX=${VUS_MAX:-50}
    ;;
  *)
    echo "WARNING: Unknown workload profile '${K6_WORKLOAD}', defaulting to VUS_MAX=1"
    VUS_MAX=${VUS_MAX:-1}
    ;;
esac

echo "Creating user pool with ${VUS_MAX} virtual users"

# Setup: Create user pool
echo "=== Setup: Creating user pool ==="
export VUS_MAX
export USER_POOL_PREFIX=${USER_POOL_PREFIX:-k6-perf-user}
export USER_POOL_DOMAIN=${USER_POOL_DOMAIN:-${ENVIRONMENT}.performance.test}
export DEFRA_ID_STUB_URL=${DEFRA_ID_STUB_URL:-https://cdp-defra-id-stub.${ENVIRONMENT}.cdp-int.defra.cloud}
node ${K6_HOME}/src/setup/create-user-pool.js
setup_exit_code=$?

if [ $setup_exit_code -ne 0 ]; then
  echo "ERROR: User pool creation failed"
  exit $setup_exit_code
fi

# Run k6 test with profile-based configuration
echo "=== Running k6 performance test ==="
k6 run \
  -e K6_WORKLOAD=${K6_WORKLOAD} \
  -e K6_THRESHOLD=${K6_THRESHOLD} \
  -e TARGET_URL=${TARGET_URL:-https://trade-demo-frontend.${ENVIRONMENT}.cdp-int.defra.cloud} \
  -e DEFRA_ID_STUB_URL=${DEFRA_ID_STUB_URL:-https://cdp-defra-id-stub.${ENVIRONMENT}.cdp-int.defra.cloud} \
  -e USER_POOL_PREFIX=${USER_POOL_PREFIX} \
  -e USER_POOL_DOMAIN=${USER_POOL_DOMAIN} \
  ${K6_HOME}/src/tests/trade-import-notification.js \
  --summary-export=${K6_SUMMARY}
test_exit_code=$?

# Teardown: Cleanup user pool (always run, even if test failed)
echo "=== Teardown: Cleaning up user pool ==="
node ${K6_HOME}/src/setup/cleanup-user-pool.js
cleanup_exit_code=$?

if [ $cleanup_exit_code -ne 0 ]; then
  echo "WARNING: User pool cleanup had issues (non-fatal)"
fi

# Publish results to S3
if [ -n "$RESULTS_OUTPUT_S3_PATH" ]; then
  if [ -f "$K6_REPORT" -a -f "$K6_SUMMARY" ]; then
    echo "=== Publishing results to S3 ==="
    aws --endpoint-url=$S3_ENDPOINT s3 cp "$K6_REPORT" "$RESULTS_OUTPUT_S3_PATH/$K6_REPORT"
    aws --endpoint-url=$S3_ENDPOINT s3 cp "$K6_SUMMARY" "$RESULTS_OUTPUT_S3_PATH/$K6_SUMMARY"
    if [ $? -eq 0 ]; then
      echo "HTML and summary report files published to $RESULTS_OUTPUT_S3_PATH"
    fi
  else
    echo "WARNING: $K6_REPORT or $K6_SUMMARY not found"
  fi
else
  echo "RESULTS_OUTPUT_S3_PATH is not set - skipping S3 upload (OK for local runs)"
fi

# Exit with k6's exit code to preserve pass/fail status
exit $test_exit_code
