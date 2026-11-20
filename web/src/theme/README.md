# Design system

Everything visual comes from **`tokens.css`**, built from the approved mockups. See it all rendered at `/_styleguide`.

## Rules (enforced by `npm run lint`)

- **No raw colors outside `tokens.css`**: no hex, `rgb()`, `hsl()` or named colors in CSS, JS or JSX.
- `font-family`, `font-size`, `font-weight`, `line-height`, `border-radius` and `box-shadow` take token values only.
- Components use **semantic tokens** (`--color-text`, `--color-accent`, …), never `--palette-*`.
- Inline `style` is for layout values only (a progress width), never colors or type.
- Styles live in CSS Modules (`Thing.module.css`, camelCase classes).

## Category colors

A category's color is a **tone name** (`rose`, `sage`, `terracotta`, `sand`), stored as-is in the Sheet's `Categories.color` column. Put it on an element as `data-tone="rose"` and use:

| Token           | Use                                  |
| --------------- | ------------------------------------ |
| `--tone-strong` | stripes, dashed outlines             |
| `--tone-soft`   | tile and icon backgrounds            |
| `--tone-ink`    | text or icons on the soft background |

## Adding something new

1. Need a color, size or shadow that isn't there? Add it to `tokens.css`: a primitive in the palette if it's a new raw value, then a semantic token that says what it's for.
2. Use the semantic token in your CSS Module.
3. Add it to the styleguide page if it's a new kind of thing.

## Components

`Button` (primary, secondary, quiet; small), `Chip` (toggle, link, dashed), `Card` (with `tone` stripe), `Polaroid` (tilt, tape, handwritten caption). Import from `src/components`.
