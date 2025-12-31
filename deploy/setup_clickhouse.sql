CREATE TABLE IF NOT EXISTS tunnel_events
(
    `timestamp` DateTime64(3) DEFAULT now64(),
    `tunnel_id` String,
    `organization_id` String,
    `retention_days` UInt16 DEFAULT 3,
    `host` String,
    `method` LowCardinality(String),
    `path` String,
    `status_code` UInt16,
    `request_duration_ms` UInt32,
    `bytes_in` UInt32,
    `bytes_out` UInt32,
    `client_ip` IPv4,
    `user_agent` String
)
ENGINE = MergeTree
PARTITION BY toDate(timestamp)
ORDER BY (tunnel_id, timestamp)
TTL timestamp + toIntervalDay(retention_days)
SETTINGS index_granularity = 8192;

CREATE TABLE IF NOT EXISTS tunnel_stats_1m
(
    `minute` DateTime,
    `tunnel_id` String,
    `retention_days` UInt16 DEFAULT 3,
    `requests` UInt32,
    `errors` UInt32,
    `avg_latency_ms` Float32,
    `p95_latency_ms` UInt32,
    `bytes_in` UInt64,
    `bytes_out` UInt64
)
ENGINE = SummingMergeTree
PARTITION BY toDate(minute)
ORDER BY (tunnel_id, minute)
TTL minute + toIntervalDay(retention_days)
SETTINGS index_granularity = 8192;

CREATE MATERIALIZED VIEW IF NOT EXISTS tunnel_events_to_stats_1m TO tunnel_stats_1m
AS SELECT
    toStartOfMinute(timestamp) AS minute,
    tunnel_id,
    any(retention_days) as retention_days,
    count() AS requests,
    countIf(status_code >= 400) AS errors,
    CAST(avg(request_duration_ms), 'Float32') AS avg_latency_ms,
    CAST(quantileExact(0.95)(request_duration_ms), 'UInt32') AS p95_latency_ms,
    sum(bytes_in) AS bytes_in,
    sum(bytes_out) AS bytes_out
FROM tunnel_events
GROUP BY
    minute,
    tunnel_id;

-- Protocol events for TCP/UDP tunnels
CREATE TABLE IF NOT EXISTS protocol_events
(
    `timestamp` DateTime64(3) DEFAULT now64(),
    `tunnel_id` String,
    `organization_id` String,
    `retention_days` UInt16 DEFAULT 3,
    `protocol` LowCardinality(String),  -- 'tcp' or 'udp'
    `event_type` LowCardinality(String), -- 'connection', 'data', 'close' for TCP; 'packet' for UDP
    `connection_id` String,              -- For TCP connections, empty for UDP
    `client_ip` String,
    `client_port` UInt16,
    `bytes_in` UInt32,
    `bytes_out` UInt32,
    `duration_ms` UInt32 DEFAULT 0       -- For TCP connection duration
)
ENGINE = MergeTree
PARTITION BY toDate(timestamp)
ORDER BY (tunnel_id, timestamp)
TTL timestamp + toIntervalDay(retention_days)
SETTINGS index_granularity = 8192;

-- Aggregated stats for protocol events per minute
CREATE TABLE IF NOT EXISTS protocol_stats_1m
(
    `minute` DateTime,
    `tunnel_id` String,
    `protocol` LowCardinality(String),
    `retention_days` UInt16 DEFAULT 3,
    `connections` UInt32,       -- Number of new TCP connections or UDP clients
    `active_connections` UInt32, -- For TCP: connections that were active during this minute
    `packets` UInt32,           -- Number of data packets/messages
    `bytes_in` UInt64,
    `bytes_out` UInt64
)
ENGINE = SummingMergeTree
PARTITION BY toDate(minute)
ORDER BY (tunnel_id, protocol, minute)
TTL minute + toIntervalDay(retention_days)
SETTINGS index_granularity = 8192;

-- Materialized view to auto-aggregate protocol events
CREATE MATERIALIZED VIEW IF NOT EXISTS protocol_events_to_stats_1m TO protocol_stats_1m
AS SELECT
    toStartOfMinute(timestamp) AS minute,
    tunnel_id,
    protocol,
    any(retention_days) as retention_days,
    countIf(event_type = 'connection') AS connections,
    uniqExactIf(connection_id, event_type = 'data' AND protocol = 'tcp') AS active_connections,
    countIf(event_type = 'data' OR event_type = 'packet') AS packets,
    sum(bytes_in) AS bytes_in,
    sum(bytes_out) AS bytes_out
FROM protocol_events
GROUP BY
    minute,
    tunnel_id,
    protocol;
