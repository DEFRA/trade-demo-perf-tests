FROM grafana/k6:latest

ENV TZ="Europe/London"

USER root

RUN apk add --no-cache \
   aws-cli \
   bash \
   curl \
   nodejs \
   npm

USER k6

WORKDIR /opt/perftest

COPY package.json ./
COPY src/ ./src/
COPY entrypoint.sh .

ENV S3_ENDPOINT=https://s3.eu-west-2.amazonaws.com

ENTRYPOINT [ "./entrypoint.sh" ]
