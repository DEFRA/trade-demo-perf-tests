#!/usr/bin/env bash

echo "run_id: $RUN_ID in $ENVIRONMENT"

K6_HOME=/opt/perftest
K6_REPORT=index.html
K6_SUMMARY=summary.json

export HTTPS_PROXY=http://localhost:3128

# Validate VUS_MAX matches pool size
VUS_MAX=${VUS_MAX:-50}
echo "Configured for ${VUS_MAX} virtual users"

# Setup: Create user pool
echo "=== Setup: Creating user pool ==="
node ${K6_HOME}/src/setup/create-user-pool.js
setup_exit_code=$?

if [ $setup_exit_code -ne 0 ]; then
  echo "ERROR: User pool creation failed"
  exit $setup_exit_code
fi

# Run k6 test
echo "=== Running k6 performance test ==="
k6 run \
  -e TARGET_URL=${TARGET_URL:-https://trade-demo-frontend.${ENVIRONMENT}.cdp-int.defra.cloud} \
  -e VUS_MAX=${VUS_MAX} \
  -e RAMP_UP_DURATION=${RAMP_UP_DURATION:-5m} \
  -e HOLD_DURATION=${HOLD_DURATION:-10m} \
  -e RAMP_DOWN_DURATION=${RAMP_DOWN_DURATION:-2m} \
  -e THRESHOLD_P95_MS=${THRESHOLD_P95_MS:-3000} \
  -e THRESHOLD_P99_MS=${THRESHOLD_P99_MS:-5000} \
  -e THRESHOLD_ERROR_RATE=${THRESHOLD_ERROR_RATE:-0.01} \
  -e DEFRA_ID_STUB_URL=${DEFRA_ID_STUB_URL:-http://defra-id-stub:3200} \
  ${K6_HOME}/src/tests/notification-journey.js \
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
