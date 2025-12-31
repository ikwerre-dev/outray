import { createClient } from "@clickhouse/client";
import { config } from "../config";

export const clickhouse = createClient({
  url: config.clickhouse.url,
  username: config.clickhouse.user,
  password: config.clickhouse.password,
  database: config.clickhouse.database,
});

export interface TunnelEvent {
  timestamp: number;
  tunnel_id: string;
  organization_id: string;
  retention_days: number;
  host: string;
  method: string;
  path: string;
  status_code: number;
  request_duration_ms: number;
  bytes_in: number;
  bytes_out: number;
  client_ip: string;
  user_agent: string;
}

export async function checkClickHouseConnection(): Promise<boolean> {
  try {
    await clickhouse.ping();
    console.log("✅ Connected to ClickHouse");
    return true;
  } catch (error) {
    console.error("❌ Failed to connect to ClickHouse:", error);
    return false;
  }
}

class ClickHouseLogger {
  private buffer: TunnelEvent[] = [];
  private flushInterval: NodeJS.Timeout;
  private readonly BATCH_SIZE = 1000;
  private readonly FLUSH_INTERVAL_MS = 5000;

  constructor() {
    this.flushInterval = setInterval(() => {
      void this.flush();
    }, this.FLUSH_INTERVAL_MS);
  }

  public log(event: TunnelEvent) {
    this.buffer.push(event);
    if (this.buffer.length >= this.BATCH_SIZE) {
      void this.flush();
    }
  }

  private async flush() {
    if (this.buffer.length === 0) return;

    const events = [...this.buffer];
    this.buffer = [];

    try {
      await clickhouse.insert({
        table: "tunnel_events",
        values: events,
        format: "JSONEachRow",
      });
    } catch (error) {
      console.error("Failed to flush events to ClickHouse:", error);
      // Optionally re-queue events or drop them to avoid memory leaks
      // For now, we drop them to prioritize service stability
    }
  }

  public async shutdown() {
    clearInterval(this.flushInterval);
    await this.flush();
    await clickhouse.close();
  }
}

export const logger = new ClickHouseLogger();

// Protocol events for TCP/UDP tunnels
export interface ProtocolEvent {
  timestamp: number;
  tunnel_id: string;
  organization_id: string;
  retention_days: number;
  protocol: "tcp" | "udp";
  event_type: "connection" | "data" | "close" | "packet";
  connection_id: string;
  client_ip: string;
  client_port: number;
  bytes_in: number;
  bytes_out: number;
  duration_ms: number;
}

class ProtocolLogger {
  private buffer: ProtocolEvent[] = [];
  private flushInterval: NodeJS.Timeout;
  private readonly BATCH_SIZE = 1000;
  private readonly FLUSH_INTERVAL_MS = 5000;

  constructor() {
    this.flushInterval = setInterval(() => {
      void this.flush();
    }, this.FLUSH_INTERVAL_MS);
  }

  public log(event: ProtocolEvent) {
    this.buffer.push(event);
    if (this.buffer.length >= this.BATCH_SIZE) {
      void this.flush();
    }
  }

  public logTCPConnection(
    tunnelId: string,
    organizationId: string,
    connectionId: string,
    clientIp: string,
    clientPort: number,
    retentionDays: number = 3,
  ) {
    this.log({
      timestamp: Date.now(),
      tunnel_id: tunnelId,
      organization_id: organizationId,
      retention_days: retentionDays,
      protocol: "tcp",
      event_type: "connection",
      connection_id: connectionId,
      client_ip: clientIp,
      client_port: clientPort,
      bytes_in: 0,
      bytes_out: 0,
      duration_ms: 0,
    });
  }

  public logTCPData(
    tunnelId: string,
    organizationId: string,
    connectionId: string,
    clientIp: string,
    clientPort: number,
    bytesIn: number,
    bytesOut: number,
    retentionDays: number = 3,
  ) {
    this.log({
      timestamp: Date.now(),
      tunnel_id: tunnelId,
      organization_id: organizationId,
      retention_days: retentionDays,
      protocol: "tcp",
      event_type: "data",
      connection_id: connectionId,
      client_ip: clientIp,
      client_port: clientPort,
      bytes_in: bytesIn,
      bytes_out: bytesOut,
      duration_ms: 0,
    });
  }

  public logTCPClose(
    tunnelId: string,
    organizationId: string,
    connectionId: string,
    clientIp: string,
    clientPort: number,
    durationMs: number,
    retentionDays: number = 3,
  ) {
    this.log({
      timestamp: Date.now(),
      tunnel_id: tunnelId,
      organization_id: organizationId,
      retention_days: retentionDays,
      protocol: "tcp",
      event_type: "close",
      connection_id: connectionId,
      client_ip: clientIp,
      client_port: clientPort,
      bytes_in: 0,
      bytes_out: 0,
      duration_ms: durationMs,
    });
  }

  public logUDPPacket(
    tunnelId: string,
    organizationId: string,
    clientIp: string,
    clientPort: number,
    bytesIn: number,
    bytesOut: number,
    retentionDays: number = 3,
  ) {
    this.log({
      timestamp: Date.now(),
      tunnel_id: tunnelId,
      organization_id: organizationId,
      retention_days: retentionDays,
      protocol: "udp",
      event_type: "packet",
      connection_id: "",
      client_ip: clientIp,
      client_port: clientPort,
      bytes_in: bytesIn,
      bytes_out: bytesOut,
      duration_ms: 0,
    });
  }

  private async flush() {
    if (this.buffer.length === 0) return;

    const events = [...this.buffer];
    this.buffer = [];

    try {
      await clickhouse.insert({
        table: "protocol_events",
        values: events,
        format: "JSONEachRow",
      });
    } catch (error) {
      console.error("Failed to flush protocol events to ClickHouse:", error);
    }
  }

  public async shutdown() {
    clearInterval(this.flushInterval);
    await this.flush();
  }
}

export const protocolLogger = new ProtocolLogger();
