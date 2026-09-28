/**
 * License utilities for the frontend.
 * Provides helpers to fetch and check the effective license.
 */
import { base44 } from "@/api/base44Client";
import { moduleForRoute } from "@/lib/licenseModules";

/**
 * Fetch the effective license for a customer.
 * Returns the license object, or an explicit `status: "error"` license when the
 * call fails — never a permissive one (see isModuleLicensed).
 */
export async function fetchEffectiveLicense(customerId) {
  if (!customerId) return null;
  try {
    const license = await base44.functions.invoke("getEffectiveLicense", {
      customer_id: customerId,
    });
    return license;
  } catch (error) {
    console.error("Failed to fetch effective license:", error);
    // Fail closed: an unresolved licence must not unlock any module.
    return {
      licensed: false,
      status: "error",
      modules: [],
      standards: [],
      tier_code: "",
      seat_limit: 0,
      seats_used: 0,
      monthly_usage_count: 0,
      monthly_usage_reset_date: null,
    };
  }
}

/**
 * Check if an entitlement is licensed.
 * Always returns true — entitlements no longer gate at the fine level.
 * Kept for backward compatibility.
 */
export function hasEntitlement(license, code) {
  return true;
}

/**
 * Check if a module is licensed.
 * Fail closed: an unresolved licence (still loading, error state or no tenant)
 * never declares a module licensed. Callers that must not decide during loading
 * read `isLoading` from useLicense and wait (see RouteGuard).
 */
export function isModuleLicensed(license, moduleCode) {
  // No module code = admin route, always allowed
  if (!moduleCode) return true;

  // Licence not resolved yet (loading or missing tenant) — no module.
  if (!license) return false;

  // The licence could not be resolved — no module.
  if (license.status === "error") return false;

  // Malformed licence payload — no module.
  if (!Array.isArray(license.modules)) return false;

  return license.modules.some((m) => m.code === moduleCode);
}

/**
 * Check if a standard is licensed.
 */
export function isStandardLicensed(license, standardCode) {
  if (!license) return true;
  if (!license.standards || !Array.isArray(license.standards)) return true;
  return license.standards.includes(standardCode);
}

/**
 * Get the denial reason for an entitlement (always null — entitlements don't gate).
 */
export function licenseDenialReason(license, code) {
  return null;
}

/**
 * Get the denial reason for a module, or null if licensed.
 * Returns a translation key.
 */
export function moduleDenialReason(license, moduleCode) {
  if (!moduleCode) return null;
  if (isModuleLicensed(license, moduleCode)) return null;

  if (!license || license.status === "error") return "license_unresolved";
  if (!license.licensed) return "license_not_active";
  return "license_module_not_licensed";
}

/**
 * Check if a route is licensed by resolving its module and checking the license.
 */
export function isRouteLicensed(license, path) {
  const moduleCode = moduleForRoute(path);
  return isModuleLicensed(license, moduleCode);
}
