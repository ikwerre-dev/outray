import { IncomingMessage, ServerResponse } from "http";
import fs from "fs";
import path from "path";
import { TunnelRouter } from "./TunnelRouter";
import { getBandwidthKey } from "../../../../shared/utils";
import { logger } from "../lib/clickhouse";
import { LogManager } from "./LogManager";

export class HTTPProxy {
  private router: TunnelRouter;
  private baseDomain: string;
  private logManager: LogManager;

  constructor(
    router: TunnelRouter,
    baseDomain: string,
    logManager: LogManager,
  ) {
    this.router = router;
    this.baseDomain = baseDomain;
    this.logManager = logManager;
  }

  async handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const start = Date.now();
    const host = req.headers.host || "";

    const cleanHost = host.split(":")[0].toLowerCase();
    const tunnelId = cleanHost;

    if (tunnelId === this.baseDomain.toLowerCase()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Tunnel not found");
      return;
    }

    if (!tunnelId) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Tunnel not found");
      return;
    }

    try {
      const headers: Record<string, string | string[]> = {};
      Object.entries(req.headers).forEach(([key, value]) => {
        if (value !== undefined) {
          headers[key] = value;
        }
      });

      const metadata = this.router.getTunnelMetadata(tunnelId);
      const redis = this.router.getRedis();
      const bandwidthKey =
        metadata?.organizationId && redis
          ? getBandwidthKey(metadata.organizationId)
          : null;
      const bandwidthLimit = metadata?.bandwidthLimit;
      const shouldEnforce =
        bandwidthKey && bandwidthLimit !== undefined && bandwidthLimit !== -1;

      // Check initial limit
      if (shouldEnforce && redis) {
        const currentUsage = await redis.get(bandwidthKey!);
        if (currentUsage && parseInt(currentUsage) >= bandwidthLimit!) {
          res.writeHead(402, { "Content-Type": "text/html" });
          res.end(this.getBandwidthExceededHtml(tunnelId));
          return;
        }
      }

      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        const bufferChunk = Buffer.from(chunk);

        if (shouldEnforce && redis) {
          const newUsage = await redis.incrby(
            bandwidthKey!,
            bufferChunk.length,
          );
          if (newUsage > bandwidthLimit!) {
            res.writeHead(402, { "Content-Type": "text/html" });
            res.end(this.getBandwidthExceededHtml(tunnelId));
            return;
          }
        }

        chunks.push(bufferChunk);
      }
      const bodyBuffer = Buffer.concat(chunks);
      const bodyBase64 =
        bodyBuffer.length > 0 ? bodyBuffer.toString("base64") : undefined;

      const response = await this.router.forwardRequest(
        tunnelId,
        req.method || "GET",
        req.url || "/",
        headers,
        bodyBase64,
      );

      let responseSize = 0;
      let responseBuffer: Buffer | undefined;

      if (response.body) {
        responseBuffer = Buffer.from(response.body, "base64");
        responseSize = responseBuffer.length;

        if (shouldEnforce && redis) {
          const newUsage = await redis.incrby(bandwidthKey!, responseSize);
          if (newUsage > bandwidthLimit!) {
            res.writeHead(402, { "Content-Type": "text/html" });
            res.end(this.getBandwidthExceededHtml(tunnelId));
            return;
          }
        }
      }

      res.writeHead(response.statusCode, response.headers);
      if (responseBuffer) {
        res.end(responseBuffer);
      } else {
        res.end();
      }

      if (metadata?.organizationId) {
        const event = {
          timestamp: Date.now(),
          tunnel_id: metadata.dbTunnelId || tunnelId,
          organization_id: metadata.organizationId,
          retention_days: metadata.retentionDays || 3,
          host: host,
          method: req.method || "GET",
          path: req.url || "/",
          status_code: response.statusCode,
          request_duration_ms: Date.now() - start,
          bytes_in: bodyBuffer.length,
          bytes_out: responseSize,
          client_ip: this.getClientIp(req),
          user_agent: req.headers["user-agent"] || "",
        };

        logger.log(event);
        this.logManager.addLog(event);
      }
    } catch (error) {
      if (error instanceof Error && error.message === "Tunnel disconnected") {
        console.log(`⚠️ Tunnel disconnected during request: ${tunnelId}`);
      } else {
        console.error("Proxy error:", error);
      }
      res.writeHead(502, { "Content-Type": "text/html" });
      res.end(this.getOfflineHtml(tunnelId));
    }
  }

  private getClientIp(req: IncomingMessage): string {
    let ip =
      (req.headers["x-forwarded-for"] as string) ||
      req.socket.remoteAddress ||
      "0.0.0.0";

    // Handle comma-separated list in x-forwarded-for
    if (ip.includes(",")) {
      ip = ip.split(",")[0].trim();
    }

    // Handle IPv4-mapped IPv6 addresses
    if (ip.startsWith("::ffff:")) {
      ip = ip.substring(7);
    }

    // Handle localhost IPv6
    if (ip === "::1") {
      ip = "127.0.0.1";
    }

    return ip;
  }

  private getOfflineHtml(tunnelId: string): string {
    try {
      const paths = [
        path.join(__dirname, "../offline.html"), // Dev: src/core/../offline.html -> src/offline.html
        path.join(__dirname, "offline.html"), // Prod: dist/offline.html
        path.join(process.cwd(), "src/offline.html"), // Fallback
      ];

      let template = "";
      for (const p of paths) {
        if (fs.existsSync(p)) {
          template = fs.readFileSync(p, "utf-8");
          break;
        }
      }

      if (!template) {
        return `<h1>${tunnelId} is offline</h1>`;
      }

      return template.replace(/{{TUNNEL_ID}}/g, tunnelId);
    } catch (error) {
      console.error("Failed to load offline page template", error);
      return `<h1>${tunnelId} is offline</h1>`;
    }
  }

  private getBandwidthExceededHtml(tunnelId: string): string {
    try {
      const paths = [
        path.join(__dirname, "../bandwidth_exceeded.html"),
        path.join(__dirname, "bandwidth_exceeded.html"),
        path.join(process.cwd(), "src/bandwidth_exceeded.html"),
      ];

      let template = "";
      for (const p of paths) {
        if (fs.existsSync(p)) {
          template = fs.readFileSync(p, "utf-8");
          break;
        }
      }

      if (!template) {
        return `<h1>Bandwidth Limit Exceeded for ${tunnelId}</h1>`;
      }

      return template.replace(/{{TUNNEL_ID}}/g, tunnelId);
    } catch (error) {
      console.error("Failed to load bandwidth exceeded page template", error);
      return `<h1>Bandwidth Limit Exceeded for ${tunnelId}</h1>`;
    }
  }
}
