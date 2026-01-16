const { isMainThread } = require('node:worker_threads');

if (isMainThread) {
  const { NodeSDK } = require('@opentelemetry/sdk-node');
  const {
    getNodeAutoInstrumentations,
  } = require('@opentelemetry/auto-instrumentations-node');

  const {
    OTLPTraceExporter,
  } = require('@opentelemetry/exporter-trace-otlp-http');
  const {
    OTLPMetricExporter,
  } = require('@opentelemetry/exporter-metrics-otlp-http');
  const {
    PeriodicExportingMetricReader,
  } = require('@opentelemetry/sdk-metrics');

  // OTLP exporters read standard OTEL_* env vars (endpoint, headers, etc.)
  const traceExporter = new OTLPTraceExporter();
  const metricExporter = new OTLPMetricExporter();

  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 60000,
  });

  const sdk = new NodeSDK({
    traceExporter,
    metricReader,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();
}
