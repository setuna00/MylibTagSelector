/**
 * Centralized logging utility
 * 
 * - debug: Only outputs in DEV mode
 * - info: Defaults to DEV-only, but can be configured
 * - warn/error: Always output (even in production), but should be minimized
 */

const isDev = import.meta.env.DEV;

/**
 * Debug logs - only output in development mode
 */
export function debug(...args: unknown[]): void {
  if (isDev) {
    console.debug(...args);
  }
}

/**
 * Info logs - default to DEV-only, but can be configured if needed
 * For now, only outputs in DEV mode
 */
export function info(...args: unknown[]): void {
  if (isDev) {
    console.info(...args);
  }
}

/**
 * Warning logs - always output (including production)
 * Use sparingly for important warnings
 */
export function warn(...args: unknown[]): void {
  console.warn(...args);
}

/**
 * Dev-only warning logs - only output in development mode
 * Use for warnings that are safely handled and don't need production visibility
 */
export function devWarn(...args: unknown[]): void {
  if (isDev) {
    console.warn(...args);
  }
}

/**
 * Error logs - always output (including production)
 * Use for actual errors that need attention
 */
export function error(...args: unknown[]): void {
  console.error(...args);
}

