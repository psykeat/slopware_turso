# Stripi Inspired Design System

> version: alpha
> name: Stripi Inspired
> description: An inspired interpretation of Stripi's design language — a financial-infrastructure brand built on a deep navy ink, an electric indigo primary, and a recurring atmospheric gradient mesh that occupies the upper third of nearly every marketing page. The system pairs the proprietary Sohne family at thin (300) weights with negative letter-spacing for editorial-density display headlines, and uses tabular-figure body type where money and numerics matter. Buttons are tight-radius pills, cards live on near-white surfaces, and the dashboard track flips polarity to a familiar dark-app shell.

## Tokens

### Colors

- **primary**: `#533afd` (Signature CTA)
- **primary-deep**: `#4434d4`
- **primary-press**: `#2e2b8c`
- **primary-soft**: `#665efd`
- **primary-bg-subdued-hover**: `#b9b9f9`
- **brand-dark-900**: `#1c1e54` (Featured tiers/Dashboard shell)
- **ink**: `#0d253d` (Default text)
- **ink-secondary**: `#273951`
- **ink-mute**: `#64748d` (Captions/Labels)
- **on-primary**: `#ffffff`
- **canvas**: `#ffffff`
- **canvas-soft**: `#f6f9fc`
- **canvas-cream**: `#f5e9d4`
- **hairline**: `#e3e8ee` (Borders)
- **hairline-input**: `#a8c3de`
- **ruby**: `#ea2261`
- **magenta**: `#f96bee`
- **lemon**: `#9b6829`

### Typography (Sohne / Inter)

| Token          | Size | Weight | Letter Spacing | Use                    |
| :------------- | :--- | :----- | :------------- | :--------------------- |
| `display-xxl`  | 56px | 300    | -1.4px         | Hero headline          |
| `display-md`   | 26px | 300    | -0.26px        | Card title             |
| `body-md`      | 15px | 300    | 0              | Default UI body        |
| `body-tabular` | 14px | 300    | -0.42px        | Money/Numbers (`tnum`) |
| `caption`      | 13px | 400    | -0.39px        | Helper, labels         |
| `micro`        | 11px | 300    | 0              | Fine print             |

### Shapes & Spacing

- **Radius**: `xs`: 4px, `sm`: 6px (Inputs), `md`: 8px, `lg`: 12px (Cards), `pill`: 9999px (Buttons)
- **Padding**: `sm`: 8px, `md`: 12px, `lg`: 16px, `xl`: 24px, `xxl`: 32px

## Components

### Buttons

- **Primary Pill**: Background `primary`, Text `on-primary`, Rounded `pill`, Padding `8px 16px`.
- **Secondary**: Outline `primary`, Text `primary`, Background `canvas`.
- **On Dark**: Background `brand-dark-900`, Text `on-primary`.

### Cards

- **Feature/Data Card**: Background `canvas`, Padding `24px` or `32px`, Rounded `lg`, Border `hairline`.
- **Dashboard Mockup**: Background `canvas`, Tabular type, Rounded `lg`, Level 2 shadow.

### Inputs

- **Text Input**: Background `canvas`, Rounded `sm`, Border `hairline-input`. Focus: Border `primary`.

## B2B & Data Density Principles

1. **Tabular Figures**: Use `font-variant-numeric: tabular-nums` (or `tnum`) for all numeric data.
2. **Visual Hierarchy**: Use `ink-mute` for labels and `ink` for data values.
3. **Dense UI**: Dashboard surfaces use tighter padding (32-48px) than marketing.
4. **Dark Shell**: Use `brand-dark-900` or `ink` for sidebar/app-shell to reduce eye strain.
5. **Decisive Actions**: Short, pill-shaped buttons for transactional rows.

## Do's and Don'ts

- **DO**: Use thin weights (300) for headers with negative tracking.
- **DO**: Enable `ss01` stylistic set globally.
- **DON'T**: Use pure black. Use `ink` (`#0d253d`).
- **DON'T**: Use heavy button radii unless it's a pill.
