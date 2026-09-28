/**
 * Contrato del tema del POS (schemaVersion 1) y las reglas puras que lo rigen:
 * contraste WCAG y derivación de `assets`.
 *
 * El tema es SOLO DATOS. Nunca CSS, HTML ni JS: la caja es un kiosco que puede
 * tener a un tercero escribiéndole en la pantalla, así que el servidor valida
 * contra lista cerrada y el cliente valida cada campo por su cuenta con
 * fallback al valor por defecto (el POS se actualiza aparte del CRM y no puede
 * romperse porque le llegue un campo que aún no conoce).
 */

export const POS_THEME_SCHEMA_VERSION = 1;

/** Tope del JSON del tema. Un kiosco no necesita más y un JSON sin tope es una
 * puerta abierta a meter cualquier cosa en la base y en la memoria de la caja. */
export const POS_THEME_CONFIG_MAX_BYTES = 8192;

/** Nombre que se muestra cuando el punto cae al tema integrado del POS. */
export const POS_THEME_BUILTIN_NAME = 'POS KIOSKO';

export const POS_THEME_MODES = ['light', 'dark', 'schedule'] as const;
export const POS_THEME_FONT_FAMILIES = [
  'system',
  'inter',
  'roboto',
  'poppins',
  'nunito',
  'montserrat',
  'source-sans',
  'jetbrains-mono',
] as const;
export const POS_THEME_RADII = ['none', 'sm', 'md', 'lg', 'xl'] as const;
export const POS_THEME_DENSITIES = ['compact', 'comfortable', 'spacious'] as const;
export const POS_THEME_HEADING_WEIGHTS = [500, 600, 700] as const;
export const POS_THEME_BORDER_WIDTHS = [0, 1, 2] as const;
export const POS_THEME_CART_POSITIONS = ['left', 'right'] as const;
export const POS_THEME_CART_WIDTHS = ['narrow', 'normal', 'wide'] as const;
export const POS_THEME_PRODUCT_CARDS = ['image-top', 'image-left', 'text-only', 'compact'] as const;
export const POS_THEME_CATEGORIES_PLACEMENTS = ['top', 'left', 'hidden'] as const;
export const POS_THEME_STATUS_BAR_POSITIONS = ['top', 'bottom'] as const;
export const POS_THEME_LOGO_POSITIONS = ['left', 'right'] as const;
export const POS_THEME_LOGO_SIZES = ['sm', 'md', 'lg'] as const;

/** Los diez tokens. Las variantes (hover, activo, tono suave, color del texto
 * sobre el primario) las deriva el cliente: guardarlas duplicaría datos que el
 * cliente sabe calcular mejor que el servidor. */
export const POS_THEME_COLOR_TOKENS = [
  'primary',
  'background',
  'surface',
  'surfaceAlt',
  'text',
  'textMuted',
  'border',
  'success',
  'warning',
  'danger',
] as const;

export type PosThemeMode = (typeof POS_THEME_MODES)[number];
export type PosThemeFontFamily = (typeof POS_THEME_FONT_FAMILIES)[number];
export type PosThemeRadius = (typeof POS_THEME_RADII)[number];
export type PosThemeDensity = (typeof POS_THEME_DENSITIES)[number];
export type PosThemeHeadingWeight = (typeof POS_THEME_HEADING_WEIGHTS)[number];
export type PosThemeBorderWidth = (typeof POS_THEME_BORDER_WIDTHS)[number];
export type PosThemeCartPosition = (typeof POS_THEME_CART_POSITIONS)[number];
export type PosThemeCartWidth = (typeof POS_THEME_CART_WIDTHS)[number];
export type PosThemeProductCard = (typeof POS_THEME_PRODUCT_CARDS)[number];
export type PosThemeCategoriesPlacement = (typeof POS_THEME_CATEGORIES_PLACEMENTS)[number];
export type PosThemeStatusBarPosition = (typeof POS_THEME_STATUS_BAR_POSITIONS)[number];
export type PosThemeLogoPosition = (typeof POS_THEME_LOGO_POSITIONS)[number];
export type PosThemeLogoSize = (typeof POS_THEME_LOGO_SIZES)[number];
export type PosThemeColorToken = (typeof POS_THEME_COLOR_TOKENS)[number];

export interface PosThemeColors {
  primary: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
}

/** Unión y no un objeto con `type: string`: un fondo de login con
 * `type: 'image'` y `imageFileId: null` no tiene sentido, y con una unión el
 * compilador obliga a que `imageFileId` solo exista en la variante que lo usa. */
export type PosThemeLoginBackground =
  | { type: 'color'; color: string | null; imageFileId: null }
  | { type: 'image'; color: null; imageFileId: string };

export interface PosThemeBranding {
  /** Imagen de la empresa que va a un lado del header. `null` = se dibuja el
   * logotipo "POS KIOSKO" con los tokens del tema. */
  logoFileId: string | null;
  /** Versión del logo para modo oscuro: un logo de letras oscuras desaparece
   * sobre fondo oscuro. `null` = se usa `logoFileId` en ambos modos. */
  logoDarkFileId: string | null;
  logoPosition: PosThemeLogoPosition;
  logoSize: PosThemeLogoSize;
  showLogoOnLogin: boolean;
  loginBackground: PosThemeLoginBackground;
  welcomeMessage: string | null;
}

export interface PosThemeConfig {
  schemaVersion: typeof POS_THEME_SCHEMA_VERSION;
  mode: PosThemeMode;
  allowCashierToggle: boolean;
  schedule: { darkFrom: string; darkTo: string };
  colors: { light: PosThemeColors; dark: PosThemeColors };
  typography: {
    fontFamily: PosThemeFontFamily;
    baseSize: number;
    headingWeight: PosThemeHeadingWeight;
  };
  shape: {
    radius: PosThemeRadius;
    density: PosThemeDensity;
    shadows: boolean;
    borderWidth: PosThemeBorderWidth;
  };
  layout: {
    cartPosition: PosThemeCartPosition;
    cartWidth: PosThemeCartWidth;
    catalogColumns: 'auto' | number;
    productCard: PosThemeProductCard;
    categoriesPlacement: PosThemeCategoriesPlacement;
    statusBarPosition: PosThemeStatusBarPosition;
    showProductImages: boolean;
  };
  branding: PosThemeBranding;
}

export type PosThemeAssetRole = 'logo' | 'logoDark' | 'loginBackground';

export interface PosThemeAsset {
  role: PosThemeAssetRole;
  fileId: string;
}

/** Tope de los `fileId` de marca: un uuid. El POS repite esta validación antes
 * de tocar disco (ver §10 del encargo), pero el servidor no debe aceptar ni
 * guardar algo que el cliente no va a poder usar. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Los assets se calculan del config para que el POS sepa qué descargar sin
 * tener que interpretar el JSON. `logoDark` solo aparece si hay una versión para
 * modo oscuro: si no, el POS cae a `logo`.
 */
export function resolveThemeAssets(config: PosThemeConfig): PosThemeAsset[] {
  const assets: PosThemeAsset[] = [];
  const { logoFileId, logoDarkFileId, loginBackground } = config.branding;

  if (logoFileId) assets.push({ role: 'logo', fileId: logoFileId });
  if (logoDarkFileId) assets.push({ role: 'logoDark', fileId: logoDarkFileId });
  if (loginBackground.type === 'image' && loginBackground.imageFileId) {
    assets.push({ role: 'loginBackground', fileId: loginBackground.imageFileId });
  }

  return assets;
}

export function isValidHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/.test(value);
}

export function isValidTimeHHMM(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/* ------------------------------------------------------------------ *
 * Contraste (WCAG 2.1)
 * ------------------------------------------------------------------ */

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16) / 255,
    parseInt(clean.slice(2, 4), 16) / 255,
    parseInt(clean.slice(4, 6), 16) / 255,
  ];
}

/** Luminancia relativa WCAG 2.1. El peso por canal no es simétrico (el verde
 * aporta más que el azul a la percepción de brillo), por eso los coeficientes
 * 0.2126/0.7152/0.0722 y no un promedio plano. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Ratio de contraste entre dos colores, de 1 a 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export interface ContrastPair {
  /** Token del texto, o 'on-primary' para el texto derivado sobre el primario. */
  a: string;
  /** Token del fondo contra el que se lee. */
  b: string;
  ratio: number;
  min: number;
}

export const CONTRAST_MIN_BLOCKING = 3;
/** El editor avisa por debajo de 4.5 (WCAG AA) pero no bloquea: entre 3 y 4.5
 * es un tema usable, solo justo. */
export const CONTRAST_MIN_ADVISORY = 4.5;

const WHITE = '#ffffff';
const BLACK = '#000000';

/**
 * Parejas que tienen que leerse. `text/background` y `text/surface` son el
 * cuerpo de la venta; `textMuted/surface` es el precio y los subtotales. Y el
 * texto del botón primario, que el cliente no guarda: se deriva eligiendo
 * blanco o negro, el que mejor contraste dé.
 *
 * OJO sobre esa última pareja: eligiendo entre blanco y negro, lo peor que
 * puede salir es el primario en el punto donde ambos empatan, y ahí el ratio es
 * sqrt(21) ≈ 4.58. Con los cortes de 3 y de 4.5 esa pareja NO puede disparar
 * nunca — hoy es una red de seguridad, no un filtro que llegue a parar nada.
 * Se deja porque es la que protege si el corte baja o si algún día el texto
 * derivado deja de ser blanco/negro.
 *
 * Se evalúan los DOS modos por separado: un tema puede leerse bien de día y
 * ser ilegible de noche, y la caja cambia sola a las 19:00.
 */
export function checkContrast(config: PosThemeConfig, min: number = CONTRAST_MIN_BLOCKING): ContrastPair[] {
  const failing: ContrastPair[] = [];

  for (const mode of ['light', 'dark'] as const) {
    const c = config.colors[mode];
    const pairs: Array<[string, string]> = [
      ['text', 'background'],
      ['text', 'surface'],
      ['textMuted', 'surface'],
    ];

    for (const [a, b] of pairs) {
      const ratio = contrastRatio(c[a as keyof PosThemeColors], c[b as keyof PosThemeColors]);
      if (ratio < min) {
        failing.push({ a: `${mode}.${a}`, b: `${mode}.${b}`, ratio, min });
      }
    }

    const onPrimaryWhite = contrastRatio(WHITE, c.primary);
    const onPrimaryBlack = contrastRatio(BLACK, c.primary);
    const best = Math.max(onPrimaryWhite, onPrimaryBlack);
    if (best < min) {
      failing.push({
        a: `${mode}.on-primary`,
        b: `${mode}.primary`,
        ratio: best,
        min,
      });
    }
  }

  return failing;
}

/** ETag estable del tema resuelto. El POS lo manda en `If-None-Match` en cada
 * pull para que un pull sin cambios sea un 304 barato. El tema integrado no
 * tiene versión en la base: se identifica aparte para que su ETag tampoco
 * choque con el de ningún tema guardado. */
export function buildThemeEtag(themeId: string | null, version: number): string {
  return `"${themeId ?? 'builtin'}-${version}"`;
}

export function isValidAssetFileId(value: string): boolean {
  return UUID_RE.test(value);
}
