/**
 * URL Branding Extractor Service
 *
 * Extracts branding information (colors, logo, company name) from a website URL.
 * Uses cheerio for HTML parsing - no heavy dependencies like Puppeteer.
 */

import * as cheerio from 'cheerio';

export interface ExtractedBranding {
  name: string | null;
  tagline: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  og_image_url: string | null;
}

export interface ExtractionResult {
  success: boolean;
  extracted: ExtractedBranding;
  source_url: string;
  errors: string[];
}

/**
 * Extract branding information from a website URL
 */
export async function extractBrandingFromUrl(url: string): Promise<ExtractionResult> {
  const errors: string[] = [];
  const extracted: ExtractedBranding = {
    name: null,
    tagline: null,
    primary_color: null,
    secondary_color: null,
    logo_url: null,
    favicon_url: null,
    og_image_url: null,
  };

  try {
    // Validate and normalize URL
    const normalizedUrl = normalizeUrl(url);
    const baseUrl = new URL(normalizedUrl).origin;

    console.log(`🔍 [URL Extractor] Fetching: ${normalizedUrl}`);

    // Fetch the website HTML
    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BrandingBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract company name
    extracted.name = extractCompanyName($);
    console.log(`📛 [URL Extractor] Name: ${extracted.name}`);

    // Extract tagline/description
    extracted.tagline = extractTagline($);
    console.log(`📝 [URL Extractor] Tagline: ${extracted.tagline?.substring(0, 50)}...`);

    // Extract primary color from meta theme-color
    extracted.primary_color = extractPrimaryColor($);
    console.log(`🎨 [URL Extractor] Primary color: ${extracted.primary_color}`);

    // Extract secondary color (from CSS or computed)
    extracted.secondary_color = extractSecondaryColor($, extracted.primary_color);
    console.log(`🎨 [URL Extractor] Secondary color: ${extracted.secondary_color}`);

    // Extract favicon
    extracted.favicon_url = extractFavicon($, baseUrl);
    console.log(`🖼️ [URL Extractor] Favicon: ${extracted.favicon_url}`);

    // Extract logo (og:image or explicit logo)
    extracted.logo_url = extractLogo($, baseUrl);
    console.log(`🖼️ [URL Extractor] Logo: ${extracted.logo_url}`);

    // Extract og:image separately
    extracted.og_image_url = extractOgImage($, baseUrl);

    return {
      success: true,
      extracted,
      source_url: normalizedUrl,
      errors,
    };

  } catch (error: any) {
    console.error(`❌ [URL Extractor] Error:`, error.message);
    errors.push(error.message);

    return {
      success: false,
      extracted,
      source_url: url,
      errors,
    };
  }
}

/**
 * Normalize URL (add https:// if missing)
 */
function normalizeUrl(url: string): string {
  url = url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url;
}

/**
 * Extract company name from various sources
 */
function extractCompanyName($: cheerio.CheerioAPI): string | null {
  // Priority order:
  // 1. og:site_name
  // 2. application-name meta
  // 3. Title tag (cleaned)
  // 4. First h1

  const ogSiteName = $('meta[property="og:site_name"]').attr('content');
  if (ogSiteName) return cleanCompanyName(ogSiteName);

  const appName = $('meta[name="application-name"]').attr('content');
  if (appName) return cleanCompanyName(appName);

  const title = $('title').text();
  if (title) return cleanCompanyName(title);

  const h1 = $('h1').first().text();
  if (h1) return cleanCompanyName(h1);

  return null;
}

/**
 * Clean company name (remove taglines, special chars)
 */
function cleanCompanyName(name: string): string {
  // Remove common separators and everything after
  name = name.split(/\s*[-|–—:]\s*/)[0];
  // Remove extra whitespace
  name = name.replace(/\s+/g, ' ').trim();
  // Limit length
  if (name.length > 50) {
    name = name.substring(0, 50);
  }
  return name;
}

/**
 * Extract tagline/description
 */
function extractTagline($: cheerio.CheerioAPI): string | null {
  // Priority: og:description > meta description > first subtitle
  const ogDesc = $('meta[property="og:description"]').attr('content');
  if (ogDesc) return ogDesc.substring(0, 200);

  const metaDesc = $('meta[name="description"]').attr('content');
  if (metaDesc) return metaDesc.substring(0, 200);

  return null;
}

/**
 * Extract primary color from meta tags or CSS
 */
function extractPrimaryColor($: cheerio.CheerioAPI): string | null {
  // 1. Check meta theme-color (most reliable)
  const themeColor = $('meta[name="theme-color"]').attr('content');
  if (themeColor && isValidHexColor(themeColor)) {
    return normalizeHexColor(themeColor);
  }

  // 2. Check msapplication-TileColor
  const tileColor = $('meta[name="msapplication-TileColor"]').attr('content');
  if (tileColor && isValidHexColor(tileColor)) {
    return normalizeHexColor(tileColor);
  }

  // 3. Try to find color in inline styles (buttons, headers, links)
  const inlineColor = findColorInStyles($);
  if (inlineColor) return inlineColor;

  // 4. Find most common non-neutral color from CSS
  const allColors = findAllColorsInStyles($);
  const colorCounts = countColorOccurrences($);

  // Sort by frequency and find first non-neutral color
  const sortedColors = Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([color]) => color);

  for (const color of sortedColors) {
    if (!isNeutralColor(color)) {
      return color;
    }
  }

  return null;
}

/**
 * Count color occurrences in stylesheets
 */
function countColorOccurrences($: cheerio.CheerioAPI): Record<string, number> {
  const counts: Record<string, number> = {};

  $('style').each((_, el) => {
    const css = $(el).text();
    const hexMatches = css.match(/#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})\b/g);
    if (hexMatches) {
      hexMatches.forEach(color => {
        const normalized = normalizeHexColor(color);
        counts[normalized] = (counts[normalized] || 0) + 1;
      });
    }
  });

  return counts;
}

/**
 * Check if a color is neutral (black, white, gray)
 */
function isNeutralColor(hex: string): boolean {
  const neutrals = [
    '#FFFFFF', '#FFF', '#000000', '#000',
    '#F5F5F5', '#FAFAFA', '#F0F0F0', '#E5E5E5',
    '#D4D4D4', '#A3A3A3', '#737373', '#525252',
    '#404040', '#262626', '#171717',
    '#F9FAFB', '#F3F4F6', '#E5E7EB', '#D1D5DB',
    '#9CA3AF', '#6B7280', '#4B5563', '#374151',
    '#1F2937', '#111827',
    '#ABB8C3', // WordPress gray
  ];

  const upper = hex.toUpperCase();

  // Check exact matches
  if (neutrals.includes(upper)) return true;

  // Check if it's a grayscale color (R ≈ G ≈ B)
  const rgb = hexToRgb(hex);
  if (rgb) {
    const { r, g, b } = rgb;
    const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
    if (maxDiff < 20) return true; // Very close to gray
  }

  return false;
}

/**
 * Extract secondary color (computed from primary or found in CSS)
 */
function extractSecondaryColor($: cheerio.CheerioAPI, primaryColor: string | null): string | null {
  // Get color frequency counts
  const colorCounts = countColorOccurrences($);

  // Sort by frequency
  const sortedColors = Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([color]) => color);

  // Find second most common non-neutral color that isn't the primary
  for (const color of sortedColors) {
    if (color !== primaryColor && !isNeutralColor(color)) {
      // Make sure it's visually different from primary
      if (primaryColor && areColorsSimilar(color, primaryColor)) {
        continue;
      }
      return color;
    }
  }

  // If we have a primary color, compute a complementary secondary
  if (primaryColor) {
    return computeSecondaryColor(primaryColor);
  }

  return null;
}

/**
 * Check if two colors are visually similar
 */
function areColorsSimilar(color1: string, color2: string): boolean {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) return false;

  const diff = Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  );

  // If color distance is less than 50, consider them similar
  return diff < 50;
}

/**
 * Find colors in inline styles
 */
function findColorInStyles($: cheerio.CheerioAPI): string | null {
  const selectors = [
    'header',
    'nav',
    '.header',
    '.navbar',
    '.nav',
    'button',
    '.btn',
    '.button',
    '[class*="primary"]',
    '[class*="brand"]',
    'a',
  ];

  for (const selector of selectors) {
    const element = $(selector).first();
    const style = element.attr('style') || '';
    const bgColor = element.css('background-color') || '';
    const color = element.css('color') || '';

    // Check for hex colors in style attribute
    const hexMatch = style.match(/#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})\b/);
    if (hexMatch) {
      return normalizeHexColor(hexMatch[0]);
    }

    // Check for rgb colors
    const rgbMatch = style.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (rgbMatch) {
      return rgbToHex(parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3]));
    }
  }

  return null;
}

/**
 * Find all colors in styles
 */
function findAllColorsInStyles($: cheerio.CheerioAPI): string[] {
  const colors: string[] = [];

  // Look for style tags
  $('style').each((_, el) => {
    const css = $(el).text();
    const hexMatches = css.match(/#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})\b/g);
    if (hexMatches) {
      hexMatches.forEach(color => {
        const normalized = normalizeHexColor(color);
        if (!colors.includes(normalized)) {
          colors.push(normalized);
        }
      });
    }
  });

  return colors.slice(0, 10); // Limit to first 10
}

/**
 * Extract favicon URL
 */
function extractFavicon($: cheerio.CheerioAPI, baseUrl: string): string | null {
  // Priority order for favicons
  const selectors = [
    'link[rel="icon"][type="image/svg+xml"]',
    'link[rel="icon"][sizes="32x32"]',
    'link[rel="icon"][sizes="16x16"]',
    'link[rel="apple-touch-icon"]',
    'link[rel="icon"]',
    'link[rel="shortcut icon"]',
  ];

  for (const selector of selectors) {
    const href = $(selector).attr('href');
    if (href) {
      return resolveUrl(href, baseUrl);
    }
  }

  // Default fallback
  return `${baseUrl}/favicon.ico`;
}

/**
 * Extract logo URL
 */
function extractLogo($: cheerio.CheerioAPI, baseUrl: string): string | null {
  // Look for explicit logo elements - priority order
  const logoSelectors = [
    // High priority: explicit logo classes/ids
    'img[class*="logo"]',
    'img[id*="logo"]',
    '.logo img',
    '#logo img',
    '[class*="logo"] img',
    '[id*="logo"] img',
    // Medium priority: alt text
    'img[alt*="logo" i]',
    // Lower priority: header/nav images
    'header img:first-of-type',
    'nav img:first-of-type',
    '.header img:first-of-type',
    '.navbar img:first-of-type',
    '.site-branding img',
    '.brand img',
  ];

  for (const selector of logoSelectors) {
    try {
      const src = $(selector).first().attr('src');
      if (src && !src.includes('data:') && !src.includes('gravatar')) {
        return resolveUrl(src, baseUrl);
      }
    } catch {
      // Selector might be invalid, continue
    }
  }

  // Check for images with 'logo' in the URL
  let logoFromUrl: string | null = null;
  $('img').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (src && src.toLowerCase().includes('logo') && !src.includes('data:')) {
      if (!logoFromUrl) {
        logoFromUrl = resolveUrl(src, baseUrl);
      }
    }
  });
  if (logoFromUrl) return logoFromUrl;

  // Fall back to og:image if no explicit logo found
  return extractOgImage($, baseUrl);
}

/**
 * Extract og:image URL
 */
function extractOgImage($: cheerio.CheerioAPI, baseUrl: string): string | null {
  const ogImage = $('meta[property="og:image"]').attr('content');
  if (ogImage) {
    return resolveUrl(ogImage, baseUrl);
  }

  const twitterImage = $('meta[name="twitter:image"]').attr('content');
  if (twitterImage) {
    return resolveUrl(twitterImage, baseUrl);
  }

  return null;
}

/**
 * Resolve relative URLs to absolute
 */
function resolveUrl(url: string, baseUrl: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('//')) {
    return 'https:' + url;
  }
  if (url.startsWith('/')) {
    return baseUrl + url;
  }
  return baseUrl + '/' + url;
}

/**
 * Validate hex color
 */
function isValidHexColor(color: string): boolean {
  return /^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color);
}

/**
 * Normalize hex color to #RRGGBB format
 */
function normalizeHexColor(color: string): string {
  color = color.replace('#', '').toUpperCase();
  if (color.length === 3) {
    color = color.split('').map(c => c + c).join('');
  }
  return '#' + color;
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('').toUpperCase();
}

/**
 * Compute a complementary secondary color
 */
function computeSecondaryColor(primaryHex: string): string {
  // Simple approach: shift hue by ~120 degrees
  const rgb = hexToRgb(primaryHex);
  if (!rgb) return '#10B981'; // Default green

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Shift hue by 120 degrees (complementary-ish)
  hsl.h = (hsl.h + 0.33) % 1;

  const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
}

/**
 * Hex to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * RGB to HSL
 */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h, s, l };
}

/**
 * HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}
