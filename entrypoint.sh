#!/usr/bin/env bash

echo "run_id: $RUN_ID in $ENVIRONMENT"

K6_HOME=/opt/perftest
K6_REPORT=index.html
K6_SUMMARY=summary.json

export HTTPS_PROXY=http://localhost:3128

k6 run \
  -e K6_TARGET_URL=https://trade-demo-perf-tests.perf-test.cdp-int.defra.cloud \
  -e K6_WORKLOAD=${K6_WORKLOAD} \
  -e K6_THRESHOLD=low \
  -e TEST_CLIENT_LOGIN_URL=${TEST_CLIENT_LOGIN_URL} \
  -e TEST_CLIENT_APP_ID=${TEST_CLIENT_APP_ID} \
  -e TEST_CLIENT_SECRET=${TEST_CLIENT_SECRET} \
  ${K6_HOME}/src/tests/updates.js \
  --summary-export=${K6_SUMMARY}
test_exit_code=$?

if [ -n "$RESULTS_OUTPUT_S3_PATH" ]; then
  if [ -f "$K6_REPORT" -a -f "$K6_SUMMARY" ]; then
    aws --endpoint-url=$S3_ENDPOINT s3 cp "$K6_REPORT" "$RESULTS_OUTPUT_S3_PATH/$K6_REPORT"
    aws --endpoint-url=$S3_ENDPOINT s3 cp "$K6_SUMMARY" "$RESULTS_OUTPUT_S3_PATH/$K6_SUMMARY"
    if [ $? -eq 0 ]; then
      echo "HTML and summary report files published to $RESULTS_OUTPUT_S3_PATH"
    fi
  else
    echo "$K6_REPORT or $K6_SUMMARY not found"
    exit 1
  fi
else
  echo "RESULTS_OUTPUT_S3_PATH is not set"
  exit 1
fi

exit $test_exit_code
