import "server-only";

/**
 * Thin client for Seam (https://seam.co), one API for Schlage, Yale, August, Kwikset, Igloo, Lockly, Nuki and more.
 * SEAM_API_KEY: a workspace API key ("seam_..."). Use a Sandbox workspace for virtual test locks.
 * Tests swap in a fake with setSeamClient().
 */

export type SeamDevice = { id: string; name: string; provider: string; online: boolean; supportsCodes: boolean };
export type SeamCode = { id: string; code: string | null; status: string; error: string | null };

export interface SeamClient {
  createConnectWebview(redirectUrl: string): Promise<{ id: string; url: string }>;
  getConnectWebview(id: string): Promise<{ status: string; connectedAccountId: string | null }>;
  getConnectedAccount(id: string): Promise<{ provider: string; label: string }>;
  deleteConnectedAccount(id: string): Promise<void>;
  listDevices(connectedAccountId: string): Promise<SeamDevice[]>;
  createAccessCode(input: { deviceId: string; name: string; code?: string; startsAt: Date; endsAt: Date }): Promise<SeamCode>;
  getAccessCode(id: string): Promise<SeamCode | null>;
  deleteAccessCode(id: string): Promise<void>;
}

export class SeamError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const BASE = "https://connect.getseam.com";

type Json = Record<string, unknown>;

class HttpSeam implements SeamClient {
  constructor(private key: string) {}

  private async call<T = Json>(path: string, body: Json): Promise<T> {
    const res = await fetch(BASE + path, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json().catch(() => ({}))) as Json;
    if (!res.ok) {
      const err = (data.error ?? {}) as Json;
      throw new SeamError(String(err.message ?? `Lock service error (${res.status})`), res.status);
    }
    return data as T;
  }

  async createConnectWebview(redirectUrl: string) {
    const { connect_webview: w } = await this.call<{ connect_webview: Json }>("/connect_webviews/create", { custom_redirect_url: redirectUrl, wait_for_device_creation: true });
    return { id: String(w.connect_webview_id), url: String(w.url) };
  }

  async getConnectWebview(id: string) {
    const { connect_webview: w } = await this.call<{ connect_webview: Json }>("/connect_webviews/get", { connect_webview_id: id });
    return { status: String(w.status), connectedAccountId: (w.connected_account_id as string) ?? null };
  }

  async getConnectedAccount(id: string) {
    const { connected_account: a } = await this.call<{ connected_account: Json }>("/connected_accounts/get", { connected_account_id: id });
    const ident = (a.user_identifier ?? {}) as Json;
    return {
      provider: String(a.account_type_display_name ?? a.account_type ?? "Lock account"),
      label: String(ident.email ?? ident.username ?? ident.phone ?? ""),
    };
  }

  async deleteConnectedAccount(id: string) {
    await this.call("/connected_accounts/delete", { connected_account_id: id });
  }

  async listDevices(connectedAccountId: string) {
    const { devices } = await this.call<{ devices: Json[] }>("/devices/list", { connected_account_id: connectedAccountId });
    return devices.map((d) => {
      const p = (d.properties ?? {}) as Json;
      const caps = (d.capabilities_supported ?? []) as string[];
      return {
        id: String(d.device_id),
        name: String(d.display_name ?? p.name ?? "Lock"),
        provider: String(((p.model ?? {}) as Json).manufacturer_display_name ?? p.manufacturer ?? d.device_type ?? ""),
        online: p.online !== false,
        supportsCodes: caps.includes("access_code"),
      };
    });
  }

  private toCode(c: Json): SeamCode {
    const errors = (c.errors ?? []) as Json[];
    return { id: String(c.access_code_id), code: (c.code as string) ?? null, status: String(c.status ?? "unset"), error: errors.length ? String(errors[0]!.message ?? "Lock error") : null };
  }

  async createAccessCode(input: { deviceId: string; name: string; code?: string; startsAt: Date; endsAt: Date }) {
    const { access_code } = await this.call<{ access_code: Json }>("/access_codes/create", {
      device_id: input.deviceId,
      name: input.name,
      ...(input.code ? { code: input.code } : {}),
      starts_at: input.startsAt.toISOString(),
      ends_at: input.endsAt.toISOString(),
    });
    return this.toCode(access_code);
  }

  async getAccessCode(id: string) {
    try {
      const { access_code } = await this.call<{ access_code: Json }>("/access_codes/get", { access_code_id: id });
      return this.toCode(access_code);
    } catch (e) {
      if (e instanceof SeamError && e.status === 404) return null;
      throw e;
    }
  }

  async deleteAccessCode(id: string) {
    try {
      await this.call("/access_codes/delete", { access_code_id: id });
    } catch (e) {
      if (!(e instanceof SeamError && e.status === 404)) throw e;
    }
  }
}

let override: SeamClient | null = null;

/** For tests. */
export function setSeamClient(c: SeamClient | null) {
  override = c;
}

export function locksConfigured(): boolean {
  return Boolean(override || process.env.SEAM_API_KEY);
}

export function seam(): SeamClient {
  if (override) return override;
  const key = process.env.SEAM_API_KEY;
  if (!key) throw new SeamError("Smart locks aren't turned on yet (SEAM_API_KEY is missing).", 503);
  return new HttpSeam(key);
}
