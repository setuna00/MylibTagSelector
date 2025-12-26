/**
 * Tag Color Utilities
 *
 * Utilities for reading and rendering tag colors from node.meta.color
 */

import type { TagNode } from '@tagselector/tag-core';

/**
 * Color hex validation regex: #RGB, #RRGGBB, or #RRGGBBAA
 */
const COLOR_HEX_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * Get tag color hex from node.data.color if valid.
 * Returns undefined if color is missing or invalid format.
 * 
 * Note: The data field is preserved from JSON import but not in TagNode type definition.
 */
export function getTagColorHex(node: TagNode): string | undefined {
  // Access data field (may exist in runtime even if not in type definition)
  const nodeWithData = node as TagNode & { data?: { color?: string } };
  const color = nodeWithData.data?.color;
  if (typeof color !== 'string') {
    return undefined;
  }
  if (COLOR_HEX_REGEX.test(color)) {
    return color;
  }
  return undefined;
}

/**
 * Convert hex color to RGB values.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  // Remove # and expand shorthand (#RGB -> #RRGGBB)
  let cleanHex = hex.slice(1);
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  // Parse RGB (ignore alpha if present)
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  return { r, g, b };
}

/**
 * Calculate relative luminance (luma) of a color.
 * Returns a value between 0 (dark) and 1 (light).
 * Uses ITU-R BT.709 formula.
 */
function getLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  // Normalize to 0-1 range
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const val = c / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  // ITU-R BT.709 luminance formula
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Determine readable text color (black or white) based on background color.
 * Uses luminance threshold: >= 0.5 use black, < 0.5 use white.
 */
export function getReadableTextColor(bgHex: string): '#000' | '#fff' {
  const luminance = getLuminance(bgHex);
  return luminance >= 0.5 ? '#000' : '#fff';
}

/**
 * Get text color for outline variant (white/transparent background).
 * For light colors (high luminance), use black text for contrast.
 * For dark colors (low luminance), use the border color itself.
 */
export function getOutlineTextColor(borderHex: string): string {
  const luminance = getLuminance(borderHex);
  // If border color is light (high luminance), use black text for contrast
  // If border color is dark (low luminance), use the border color itself
  return luminance >= 0.5 ? '#000' : borderHex;
}

