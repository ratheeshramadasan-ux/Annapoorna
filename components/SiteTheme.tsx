import { getSettings } from "@/lib/db";

const fontStacks: Record<string, string> = {
  cambria: 'Cambria, Georgia, "Times New Roman", serif',
  aptos: 'Aptos, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, Arial, sans-serif',
  georgia: 'Georgia, Cambria, "Times New Roman", serif',
  system: 'Inter, Aptos, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, Arial, sans-serif',
};

const themes: Record<string, Record<string, string>> = {
  cream_gold: {
    "--page-bg": "#f7f4ed",
    "--card-bg": "#fffdfa",
    "--text": "#183328",
    "--muted": "#65736b",
    "--line": "#ded8ca",
    "--gold": "#c99a3e",
    "--gold-light": "#e6bd63",
  },
  porcelain: {
    "--page-bg": "#f6f8f7",
    "--card-bg": "#ffffff",
    "--text": "#182620",
    "--muted": "#64716b",
    "--line": "#dce4df",
    "--gold": "#b88b32",
    "--gold-light": "#d6ad57",
  },
  graphite: {
    "--page-bg": "#f3f2ee",
    "--card-bg": "#ffffff",
    "--text": "#191714",
    "--muted": "#69635a",
    "--line": "#ded8cc",
    "--gold": "#bd9140",
    "--gold-light": "#dfb85c",
  },
};

function cssUrl(value: string | undefined) {
  const safe = (value ?? "").trim();
  if (!safe || safe.includes('"') || safe.includes("'") || safe.includes(")")) {
    return "";
  }
  return `url("${safe}")`;
}

function cssColor(value: string | undefined, fallback: string) {
  const safe = (value ?? "").trim();
  return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(safe) ? safe : fallback;
}

export default async function SiteTheme() {
  const settings = await getSettings().catch(() => ({} as Record<string, string>));
  const font = fontStacks[settings.brand_font_family || ""] || fontStacks.aptos;
  const displayFont = fontStacks[settings.brand_display_font || ""] || fontStacks.cambria;
  const size = Number(settings.brand_font_scale || "100");
  const fontScale = Number.isFinite(size) ? Math.min(115, Math.max(90, size)) / 100 : 1;
  const theme = themes[settings.brand_background_theme || "cream_gold"] || themes.cream_gold;
  const backgroundImage = cssUrl(settings.brand_background_image_url);
  const topBarImage = cssUrl(settings.brand_top_bar_image_url || "/assets/Main Banner.png");
  const brandLogo = cssUrl(settings.brand_icon_url);
  const backgroundColor = cssColor(settings.brand_background_color, theme["--page-bg"]);
  const declarations = {
    ...theme,
    "--page-bg": backgroundColor,
    "--font-ui": font,
    "--font-professional": displayFont,
    "--brand-font-scale": String(fontScale),
    "--site-bg-image": backgroundImage || "none",
    "--brand-logo-image": brandLogo || "none",
    "--top-bar-image": topBarImage || 'url("/assets/Main Banner.png")',
  };
  const css = `:root{${Object.entries(declarations)
    .map(([key, value]) => `${key}:${value}`)
    .join(";")};}`;
  return <style id="annapoorna-theme" dangerouslySetInnerHTML={{ __html: css }} />;
}
