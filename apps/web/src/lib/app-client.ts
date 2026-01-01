import axios from "axios";

const apiClient = axios.create({
  baseURL: typeof window !== "undefined" ? window.location.origin : "",
  headers: {
    "Content-Type": "application/json",
  },
});

export interface Tunnel {
  id: string;
  url: string;
  userId: string;
  name: string | null;
  protocol: "http" | "tcp" | "udp";
  remotePort: number | null;
  isOnline: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthToken {
  id: string;
  userId: string;
  token: string;
  name: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export interface Subdomain {
  id: string;
  subdomain: string;
  organizationId: string;
  userId: string;
  createdAt: Date;
}

export interface Domain {
  id: string;
  domain: string;
  organizationId: string;
  userId: string;
  status: "pending" | "active" | "failed";
  createdAt: Date;
  updatedAt: Date;
}

interface CreateAuthTokenParams {
  name: string;
  orgSlug: string;
}

interface DeleteAuthTokenParams {
  id: string;
  orgSlug: string;
}

interface CreateDomainParams {
  domain: string;
  orgSlug: string;
}

type SuccessResponse<T> = T;
type ErrorResponse = { error: string; details?: string };
type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

// Helper function to handle API calls with consistent error handling
async function apiCall<T = any>(
  method: "get" | "post" | "patch" | "delete",
  url: string,
  options?: { params?: any; data?: any },
): Promise<ApiResponse<T>> {
  try {
    let response;
    if (method === "get" || method === "delete") {
      response = await apiClient[method](url, {
        params: options?.params,
        data: options?.data,
      });
    } else {
      response = await apiClient[method](url, options?.data, {
        params: options?.params,
      });
    }
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      return error.response.data;
    }
    return { error: "An unexpected error occurred" };
  }
}

export const appClient = {
  tunnels: {
    list: async (orgSlug: string) =>
      apiCall<{ tunnels: Tunnel[] }>("get", `/api/${orgSlug}/tunnels`),

    get: async (orgSlug: string, tunnelId: string) =>
      apiCall<{ tunnel: Tunnel }>("get", `/api/${orgSlug}/tunnels/${tunnelId}`),

    stop: async (orgSlug: string, tunnelId: string) =>
      apiCall<{ message: string }>(
        "post",
        `/api/${orgSlug}/tunnels/${tunnelId}/stop`,
      ),
  },

  authTokens: {
    list: async (orgSlug: string) =>
      apiCall<{ tokens: AuthToken[] }>("get", `/api/${orgSlug}/auth-tokens`),

    create: async ({ name, orgSlug }: CreateAuthTokenParams) =>
      apiCall<{ token: AuthToken }>("post", `/api/${orgSlug}/auth-tokens`, {
        data: { name },
      }),

    delete: async ({ id, orgSlug }: DeleteAuthTokenParams) =>
      apiCall<{ success: boolean }>("delete", `/api/${orgSlug}/auth-tokens`, {
        data: { id },
      }),
  },

  subdomains: {
    list: async (orgSlug: string) =>
      apiCall<{ subdomains: Subdomain[] }>("get", `/api/${orgSlug}/subdomains`),

    create: async (params: { subdomain: string; orgSlug: string }) =>
      apiCall<{ subdomain: Subdomain }>(
        "post",
        `/api/${params.orgSlug}/subdomains`,
        {
          data: { subdomain: params.subdomain },
        },
      ),

    delete: async (orgSlug: string, id: string) =>
      apiCall<{ success: boolean }>(
        "delete",
        `/api/${orgSlug}/subdomains/${id}`,
      ),
  },

  domains: {
    list: async (orgSlug: string) =>
      apiCall<{ domains: Domain[] }>("get", `/api/${orgSlug}/domains`),

    create: async (params: CreateDomainParams) =>
      apiCall<{ domain: Domain }>("post", `/api/${params.orgSlug}/domains`, {
        data: { domain: params.domain },
      }),

    delete: async (orgSlug: string, domainId: string) =>
      apiCall<{ message: string }>(
        "delete",
        `/api/${orgSlug}/domains/${domainId}`,
      ),

    verify: async (orgSlug: string, domainId: string) =>
      apiCall<{ verified: boolean; message?: string }>(
        "post",
        `/api/${orgSlug}/domains/${domainId}/verify`,
      ),
  },

  stats: {
    overview: async (orgSlug: string, range: string = "24h") =>
      apiCall<{
        totalRequests: number;
        requestsChange: number;
        activeTunnels: number | null;
        activeTunnelsChange: number;
        totalDataTransfer: number;
        dataTransferChange: number;
        chartData: Array<{ hour: string; requests: number }>;
      }>("get", `/api/${orgSlug}/stats/overview`, {
        params: { range },
      }),

    tunnel: async (orgSlug: string, tunnelId: string, range: string = "24h") =>
      apiCall<{
        stats: {
          totalRequests: number;
          avgDuration: number;
          totalBandwidth: number;
          errorRate: number;
        };
        chartData: Array<{ time: string; requests: number; duration: number }>;
        requests: Array<{
          id: string;
          method: string;
          path: string;
          status: number;
          duration: number;
          time: string;
          size: number;
        }>;
      }>("get", `/api/${orgSlug}/stats/tunnel`, {
        params: { tunnelId, range },
      }),

    bandwidth: async (orgSlug: string) =>
      apiCall<{
        usage: number;
        limit: number;
        percentage: number;
      }>("get", `/api/${orgSlug}/stats/bandwidth`),
  },
};
