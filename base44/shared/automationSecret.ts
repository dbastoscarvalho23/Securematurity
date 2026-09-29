import { secrets } from "base44:runtime";

/**
 * Shared secret used to authorize scheduled/system backend function invocations.
 *
 * The value is NOT stored in the repository: it lives only in the app's Secrets
 * (dashboard → Secrets → `AUTOMATION_SECRET`) and is read per request from the
 * runtime. Rotating the secret is therefore a dashboard-only operation.
 *
 * Scheduled and entity automations run with no authenticated user context, so
 * destructive service-role functions cannot rely on `base44.auth.me()` alone.
 * Automations present the secret as a function argument — received as
 * `body.args.automation_secret`, or top-level `automation_secret` for manual
 * invokes — while manual admin triggers may pass it in the
 * `x-automation-secret` header instead.
 *
 * Anonymous external HTTP callers do not know this value and are rejected at the gate.
 */
export const AUTOMATION_SECRET_NAME = "AUTOMATION_SECRET";

/**
 * Reads the expected secret value from the app's secrets.
 *
 * `secrets.get()` must be called per request: at module load, before any request
 * runs, it returns `undefined`.
 *
 * @returns {string|null} The expected secret, or null when it is not configured.
 */
function expectedSecret() {
  try {
    const value = secrets.get(AUTOMATION_SECRET_NAME);
    return typeof value === "string" && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * Parses the JSON body without disturbing the original request, so a caller can
 * still read the body itself afterwards. Returns null when the body is absent,
 * unparseable, or already consumed by the caller.
 */
async function readJsonBody(req) {
  if (req.method !== "POST") return null;
  try {
    return await req.clone().json();
  } catch {
    return null;
  }
}

/**
 * Extracts and validates the shared automation secret from a request.
 *
 * Checks, in order:
 *   1. The `x-automation-secret` header (manual admin triggers).
 *   2. The `automation_secret` field of the JSON body — under `args.automation_secret`
 *      for scheduled automations, or top-level `automation_secret` for manual invokes.
 *
 * Callers that already parsed the body (because they need other fields from it)
 * pass it in `body` instead of leaving the helper to read the request again.
 *
 * @param {Request} req - The incoming request.
 * @param {object|null} [body] - The already-parsed JSON body, when the caller read it.
 * @returns {Promise<string|null>} The expected secret when the caller presented it, or null.
 */
export async function getAutomationSecret(req, body = null) {
  const expected = expectedSecret();
  if (!expected) return null;

  const headerSecret = req.headers.get("x-automation-secret");
  if (headerSecret === expected) return expected;

  const payload = body ?? (await readJsonBody(req));
  const provided = payload?.args?.automation_secret ?? payload?.automation_secret ?? null;
  return provided === expected ? expected : null;
}
