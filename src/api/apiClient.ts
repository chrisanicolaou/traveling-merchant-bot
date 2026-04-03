import type { RequestBody } from "discord.js";

export class ApiClient {
  constructor(readonly baseUrl: string = "") {}

  async get(
    endpoint: string,
    params?: URLSearchParams,
    headers?: Headers,
    body?: any,
  ) {
    return this.makeRequest("GET", endpoint, params, headers, body);
  }

  private async makeRequest(
    method: string,
    endpoint: string,
    params?: URLSearchParams,
    headers?: Headers,
    body?: any,
  ) {
    return fetch(`${this.baseUrl}${endpoint}${params ? `?${params}` : ""}`, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}
