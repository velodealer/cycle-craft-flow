

## Update Open Graph Preview Image

The link preview currently shows the default Lovable OG image because `index.html` references `https://lovable.dev/opengraph-image-p98pqg.png` for both `og:image` and `twitter:image`.

### Plan

1. **Create a VeloDealer OG image** — Generate an SVG-based OG image (1200x630px) with VeloDealer branding (bike icon, name, tagline) and save it to `public/og-image.svg` or create a simple HTML-rendered PNG alternative.

2. **Update `index.html` meta tags** — Change the `og:image` and `twitter:image` URLs from the Lovable placeholder to the new VeloDealer image path. Since OG images need absolute URLs, we'll reference the published/preview domain path.

### Technical Detail

OG images must be absolute URLs and ideally PNG/JPEG (not all platforms support SVG). The simplest approach is to create a static OG image as a PNG in `public/` and reference it with the preview domain URL. Alternatively, we can use an inline SVG converted to a data URL or reference the preview domain.

Since we can't generate raster images directly, we have two options:
- **Option A**: Create an SVG OG image in `public/` and reference it (works on most platforms but not all)
- **Option B**: Use a free OG image generator URL or a simple HTML page that renders the OG card

I recommend **Option A** — create a branded SVG in `public/og-image.svg` with VeloDealer logo, name, and tagline, then update `index.html` to point to it.

### Files Changed
- `public/og-image.svg` — New branded OG image
- `index.html` — Update `og:image` and `twitter:image` meta tags

