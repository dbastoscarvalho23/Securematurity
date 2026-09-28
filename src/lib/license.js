/**
 * License utilities for the frontend.
 * Provides helpers to fetch and check the effective license.
 */
import { base44 } from "@/api/base44Client";
import { moduleForRoute } from "@/lib/licenseModules";

/**
 * Fetch the effective license for a customer.
 * Returns a license object or a permissive default if the call fails.
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
    // Return a permissive default so the app doesn't lock up on error
    return {
      licensed: true,
      status: "active",
      modules: [],
      standards: [],
      tier_code: "core",
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
 * Permissive (true) if license is loading, not enforced, or module is null.
 * Otherwise checks if the module is in the license's modules array.
 */
export function isModuleLicensed(license, moduleCode) {
  // No module code = admin route, always allowed
  if (!moduleCode) return true;

  // No license or license not loaded — permissive (don't block on loading)
  if (!license) return true;

  // If license is not active but we got one, check anyway
  // If license has no modules array (error state), be permissive
  if (!license.modules || !Array.isArray(license.modules)) return true;

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
  if (!license) return null;
  if (isModuleLicensed(license, moduleCode)) return null;

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
