import { getSavedProfile, getToken } from '@/lib/auth';

const API_URL_NOT_READY_MSG = "ระบบกำลังโหลดการตั้งค่า กรุณารีเฟรชหน้าเว็บแล้วลองใหม่อีกครั้ง";

const AUDIT_SKIP_MODES = new Set([
  "",
  "login",
  "register",
  "user_registered",
  "users",
  "list_users",
  "zones",
  "list",
  "pending",
  "get",
  "audit_logs",
  "log_audit",
  "notify_line",
  "send_line",
  "upload_file",
  "upload_attachment",
]);

function getApiUrl(): string {
  const url = import.meta.env.VITE_GOOGLE_SCRIPT_URL;
  if (!url) {
    console.warn("VITE_GOOGLE_SCRIPT_URL is not set — refresh the page after secrets are configured");
  }
  return url || "";
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

function getRequestMode(body: Record<string, any>): string {
  return String(body.mode ?? body.action ?? "").trim();
}

function shouldLogAudit(mode: string): boolean {
  return !AUDIT_SKIP_MODES.has(mode);
}

function inferTargetType(mode: string): string {
  if (mode.includes("user")) return "user";
  if (mode.includes("request") || ["create", "update", "delete", "approve", "reject", "update_status"].includes(mode)) {
    return "request";
  }
  return "system";
}

function buildAuditPayload(mode: string, body: Record<string, any>): Record<string, any> {
  const profile = getSavedProfile();
  const detailParts: string[] = [];

  if (body.status !== undefined) detailParts.push(`status=${body.status}`);
  if (body.role !== undefined) detailParts.push(`role=${body.role}`);
  if (body.budget_matching_fund !== undefined || body.budget_everysite !== undefined) {
    detailParts.push(`budget_mf=${Number(body.budget_matching_fund ?? 0)}, budget_es=${Number(body.budget_everysite ?? 0)}`);
  }

  const targetId = body.target_id ?? body.id ?? body.request_id ?? body.user_id ?? null;

  // IMPORTANT: GAS routing uses `data.action || data.mode`.
  // If we set action="create", GAS routes to handleRequestCreated instead of handleLogAudit.
  // So we set action="log_audit" for routing, and put the real action name in "detail".
  const realAction = mode;
  const detailWithAction = realAction + (detailParts.length > 0 ? ": " + detailParts.join(", ") : (body.title ? ": " + body.title : ""));
  return {
    mode: "log_audit",
    action: "log_audit",       // for GAS routing — must match mode
    actor_name: profile?.full_name || "System",
    actor_role: profile?.role || "system",
    target_type: inferTargetType(mode),
    target_id: targetId !== null && targetId !== undefined ? String(targetId) : "",
    detail: detailWithAction,
    timestamp: new Date().toISOString(),
  };
}

async function sendAuditLogIfNeeded(mode: string, body: Record<string, any>) {
  if (!shouldLogAudit(mode)) return;

  const payload = buildAuditPayload(mode, body);
  const auditResult = await callViaProxy("POST", payload);
  if (!auditResult.success) {
    console.warn("Audit log failed:", auditResult.error);
  }
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "text/plain" };
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

function getProxyUrl(): string {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  return baseUrl ? `${baseUrl}/functions/v1/google-script-proxy` : "";
}

function proxyHeaders(token?: string): Record<string, string> {
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (publishableKey) {
    headers["apikey"] = publishableKey;
    headers["Authorization"] = `Bearer ${publishableKey}`;
  }

  if (token) {
    headers["x-app-token"] = token;
  }

  return headers;
}

async function callViaProxy<T = any>(
  method: "GET" | "POST",
  payload: Record<string, any>
): Promise<ApiResponse<T>> {
  const proxyUrl = getProxyUrl();
  if (!proxyUrl) return { success: false, error: API_URL_NOT_READY_MSG };

  try {
    const token = getToken() || "";
    const res = await fetch(proxyUrl, {
      method: "POST",
      headers: proxyHeaders(token),
      body: JSON.stringify({ method, payload }),
    });

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }

    const json = await res.json();
    if (!json?.success) {
      return { success: false, error: json?.error || "Proxy request failed" };
    }

    // Unwrap nested GAS response: proxy returns {success, data: {success, data: ...}}
    const inner = json.data;
    if (inner && typeof inner === "object" && "success" in inner) {
      if (!inner.success) {
        return { success: false, error: inner.error || "GAS request failed" };
      }
      return { success: true, data: inner.data as T };
    }

    return { success: true, data: inner as T };
  } catch (err) {
    console.error("Proxy API error:", err);
    return { success: false, error: String(err) };
  }
}

/**
 * GET request to Google Apps Script
 */
export async function apiGet<T = any>(
  params: Record<string, string>
): Promise<ApiResponse<T>> {
  try {
    const API_URL = getApiUrl();
    if (!API_URL) {
      return callViaProxy<T>("GET", params);
    }

    const url = new URL(API_URL);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: authHeaders(),
    });

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json };
  } catch (err) {
    console.error("API GET error:", err);
    return { success: false, error: String(err) };
  }
}

/**
 * POST request to Google Apps Script
 */
export async function apiPost<T = any>(
  body: Record<string, any>
): Promise<ApiResponse<T>> {
  try {
    const mode = getRequestMode(body);
    const API_URL = getApiUrl();
    let result: ApiResponse<T>;

    if (!API_URL) {
      result = await callViaProxy<T>("POST", body);
    } else {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}` };
      }

      const json = await res.json();
      result = { success: true, data: json };
    }

    if (result.success) {
      await sendAuditLogIfNeeded(mode, body);
    }

    return result;
  } catch (err) {
    console.error("API POST error:", err);
    return { success: false, error: String(err) };
  }
}


