/**
 * ========================================
 * BRANDING TYPES & DEFAULTS
 * ========================================
 * Shared types and default values for tenant branding.
 * This file can be safely imported on both client and server.
 */

// ========================================
// TYPES
// ========================================

export interface TenantBranding {
  // Basis info
  id: string;
  name: string;
  short_name: string | null;
  tagline: string | null;
  description: string | null;

  // Kleuren
  primary_color: string | null;
  primary_dark: string | null;
  primary_light: string | null;
  secondary_color: string | null;
  background_color: string | null;
  surface_color: string | null;
  text_primary: string | null;
  text_secondary: string | null;
  text_tertiary: string | null;
  input_border_color: string | null;
  send_button_color: string | null;
  language_hint_color: string | null;
  header_gradient_start: string | null;
  header_gradient_end: string | null;

  // Logo's
  logo_url: string | null;
  icon_url: string | null;
  favicon_url: string | null;

  // Achtergrond patroon
  background_pattern_type: 'text' | 'logo' | null;
  background_pattern_text: string | null;
  background_pattern_opacity: number | null;
  background_pattern_scale: 'small' | 'medium' | 'large' | null;
  background_pattern_density: 'low' | 'medium' | 'high' | null;
  background_pattern_color_mode: 'grayscale' | 'original' | 'tinted' | null;

  // Fun facts
  fun_facts_enabled: boolean;
  fun_facts_prefix: string | null;
  fun_facts: string[];

  // Features
  show_powered_by: boolean;
  enable_feedback: boolean;

  // UI Teksten
  ui_texts: UITexts;

  // Meta
  is_active: boolean;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface UITexts {
  [languageCode: string]: LanguageTexts;
}

export interface LanguageTexts {
  appTitle: string;
  appSubtitle: string;
  welcomeTitle: string;
  welcomeSubtitle: string;
  languageHint: string;
  exampleLabel: string;
  examples: string[];
  inputPlaceholder: string;
  citationsLabel: string;
  pageLabel: string;
  viewButton: string;
}

export interface TenantListItem {
  id: string;
  name: string;
  primary_color: string | null;
  logo_url: string | null;
  is_active: boolean;
  is_demo: boolean;
  created_at: string;
}

export interface CreateTenantInput {
  id: string;
  name: string;
  primary_color?: string;
}

export interface UpdateTenantBrandingInput {
  // Basis info
  name?: string;
  short_name?: string | null;
  tagline?: string | null;
  description?: string | null;

  // Kleuren
  primary_color?: string | null;
  primary_dark?: string | null;
  primary_light?: string | null;
  secondary_color?: string | null;
  background_color?: string | null;
  surface_color?: string | null;
  text_primary?: string | null;
  text_secondary?: string | null;
  text_tertiary?: string | null;
  input_border_color?: string | null;
  send_button_color?: string | null;
  language_hint_color?: string | null;
  header_gradient_start?: string | null;
  header_gradient_end?: string | null;

  // Logo's
  logo_url?: string | null;
  icon_url?: string | null;
  favicon_url?: string | null;

  // Achtergrond patroon
  background_pattern_type?: 'text' | 'logo' | null;
  background_pattern_text?: string | null;
  background_pattern_opacity?: number | null;
  background_pattern_scale?: 'small' | 'medium' | 'large' | null;
  background_pattern_density?: 'low' | 'medium' | 'high' | null;
  background_pattern_color_mode?: 'grayscale' | 'original' | 'tinted' | null;

  // Fun facts
  fun_facts_enabled?: boolean;
  fun_facts_prefix?: string | null;
  fun_facts?: string[];

  // Features
  show_powered_by?: boolean;
  enable_feedback?: boolean;

  // UI Teksten
  ui_texts?: UITexts;
}

// ========================================
// DEFAULT VALUES
// ========================================

export const DEFAULT_UI_TEXTS: LanguageTexts = {
  appTitle: 'HR Assistent',
  appSubtitle: 'Stel al je HR vragen',
  welcomeTitle: 'Welkom bij je HR Assistent',
  welcomeSubtitle: 'Stel al je vragen over HR beleid, vakantiedagen, arbeidsvoorwaarden, verlof en meer. Ik help je graag verder!',
  languageHint: 'Tip: Ik antwoord automatisch in de taal waarin je je vraag stelt',
  exampleLabel: 'Bijvoorbeeld:',
  examples: [
    'Hoeveel vakantiedagen heb ik?',
    'Wat moet ik doen bij ziekte?',
    'Hoe vraag ik verlof aan?',
    'Welke arbeidsvoorwaarden gelden voor mij?'
  ],
  inputPlaceholder: 'Stel je vraag...',
  citationsLabel: 'Bronnen',
  pageLabel: 'Pagina',
  viewButton: 'Bekijken'
};

export const DEFAULT_COLORS = {
  primary: '#8B5CF6',
  primaryDark: '#7C3AED',
  primaryLight: '#A78BFA',
  secondary: '#10B981',
  background: '#FFFFFF',
  surface: '#F9FAFB',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF'
};
