/**
 * Shared secret used to authorize scheduled/system backend function invocations.
 *
 * Scheduled automations run with no authenticated user context, so destructive
 * service-role functions cannot rely on `base44.auth.me()` alone. Each scheduled
 * automation passes this secret via `function_args` (received as `body.args.automation_secret`);
 * manual admin triggers may pass it via the `x-automation-secret` header instead.
 *
 * Anonymous external HTTP callers do not know this value and are rejected at the gate.
 */
export const AUTOMATION_SECRET = "cm-automation-7f3a9b2e1d8c4a6f0b5e2c9d1a7f4e3b";

/**
 * Extracts and validates the shared automation secret from a request.
 *
 * Checks, in order:
 *   1. The `x-automation-secret` header (manual admin triggers).
 *   2. The `automation_secret` field of the JSON body — under `args.automation_secret`
 *      for scheduled automations, or top-level `automation_secret` for manual invokes.
 *
 * @param {Request} req - The incoming request.
 * @returns {Promise<string|null>} The validated secret value, or null if absent/invalid.
 */
export async function getAutomationSecret(req) {
  const headerSecret = req.headers.get("x-automation-secret");
  if (headerSecret === AUTOMATION_SECRET) return headerSecret;
  try {
    if (req.method === "POST") {
      const body = await req.json();
      const bodySecret = body?.args?.automation_secret ?? body?.automation_secret ?? null;
      if (bodySecret === AUTOMATION_SECRET) return bodySecret;
    }
  } catch {
    // No JSON body or unparseable — ignore.
  }
  return null;
}