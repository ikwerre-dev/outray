import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT || "3547", 10),
  baseDomain: process.env.BASE_DOMAIN || "localhost.direct",
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  redisTunnelTtlSeconds: parseInt(
    process.env.REDIS_TUNNEL_TTL_SECONDS || "120",
    10,
  ),
  redisHeartbeatIntervalMs: parseInt(
    process.env.REDIS_HEARTBEAT_INTERVAL_MS || "20000",
    10,
  ),
};
