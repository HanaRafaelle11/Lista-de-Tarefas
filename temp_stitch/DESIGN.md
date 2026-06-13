---
name: Kinetic Horizon
colors:
  surface: '#101415'
  surface-dim: '#101415'
  surface-bright: '#363a3b'
  surface-container-lowest: '#0b0f10'
  surface-container-low: '#191c1e'
  surface-container: '#1d2022'
  surface-container-high: '#272a2c'
  surface-container-highest: '#323537'
  on-surface: '#e0e3e5'
  on-surface-variant: '#c7c4d8'
  inverse-surface: '#e0e3e5'
  inverse-on-surface: '#2d3133'
  outline: '#918fa1'
  outline-variant: '#464555'
  surface-tint: '#c3c0ff'
  primary: '#c3c0ff'
  on-primary: '#1d00a5'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#4d44e3'
  secondary: '#bec6e0'
  on-secondary: '#283044'
  secondary-container: '#3f465c'
  on-secondary-container: '#adb4ce'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#006e4b'
  on-tertiary-container: '#67f4b7'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#101415'
  on-background: '#e0e3e5'
  surface-variant: '#323537'
typography:
  headline-xl:
    fontFamily: Montserrat
    fontSize: 64px
    fontWeight: '700'
    lineHeight: 72px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Montserrat
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Montserrat
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Montserrat
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 1280px
  gutter: 24px
  margin-mobile: 20px
  stack-sm: 8px
  stack-md: 24px
  stack-lg: 64px
  section-padding: 120px
---

## Brand & Style

This design system is engineered to evoke a sense of high-performance luxury and technological precision. The target audience is health-conscious achievers and tech enthusiasts who value both form and function. 

The aesthetic merges **Modern Minimalism** with **Glassmorphism** to create a multi-layered, immersive experience. By utilizing frosted glass surfaces and high-contrast typography, the UI feels lightweight yet substantial. The emotional response should be one of "attainable exclusivity"—professional, motivating, and cutting-edge. Every interaction must feel fluid and responsive, mirroring the high-frequency sensors of the smartwatch itself.

## Colors

The color palette is anchored by **Electric Indigo** (`#4F46E5`), used strategically for primary actions and brand presence. The background utilizes a deep **Slate Navy** (`#0F172A`) to establish a premium, "night-mode" default that makes product imagery pop. 

**Emerald Green** (`#10B981`) is reserved exclusively for health-positive data (e.g., heart rate, step goals), while **Pulse Red** (`#EF4444`) is used for alerts or critical biometrics. High-purity whites and grays provide the necessary contrast for text, ensuring a sophisticated, high-end tech feel.

## Typography

Typography is a key driver of the premium narrative. **Montserrat** is used for headlines to provide a bold, geometric authority that feels modern and striking. For body copy and technical data, **Inter** provides exceptional legibility and a systematic, clean look. 

Large display titles should use tight letter spacing to feel "locked-in" and engineered. Body text requires generous line heights (1.5x - 1.6x) to maintain breathability against the dark background. Use `label-caps` for small metadata or section eyebrows to add an editorial touch.

## Layout & Spacing

The design system utilizes a **12-column fluid grid** for desktop with a maximum container width of 1280px. Spacing follows a strict 8px base unit to ensure mathematical harmony across all components.

Vertical rhythm is defined by generous section padding (`120px`) to give the product imagery space to breathe—essential for high-conversion luxury sales. On mobile, the grid collapses to 4 columns with 20px margins. Grouping of information should use tight `stack-sm` for related items (label + value) and `stack-md` for distinct content blocks.

## Elevation & Depth

Depth is achieved through **Glassmorphism** rather than traditional drop shadows. Surfaces use a semi-transparent background (e.g., `rgba(255, 255, 255, 0.05)`) combined with a `backdrop-filter: blur(20px)`. 

To define these surfaces, use a **1px semi-transparent inner border** (stroke) that simulates a light catching the edge of a glass pane. Shadows, when used for the primary "Buy Now" button, should be long, soft, and tinted with the Primary Indigo color to create a "glow" effect rather than a dark silhouette.

## Shapes

The shape language is "Soft Tech." We use a base radius of **16px** (rounded-lg) for secondary cards and **24px** (rounded-xl) for primary feature containers. These large radii soften the "hard tech" feel, making the product appear more wearable and friendly to the human body. Buttons should follow the `rounded-lg` rule (16px) to maintain a distinct, clickable appearance that isn't as aggressive as a sharp corner but more structured than a full pill-shape.

## Components

### Buttons
Primary "Buy Now" buttons feature a subtle linear gradient (Indigo to a slightly lighter Violet) with a 16px corner radius. The hover state should include a soft indigo outer glow. Secondary buttons use a ghost style with a 1px Slate border.

### Feature Cards
These are the hero of the glassmorphic style. Use 20px background blur, a 1px border at 10% opacity, and rounded-xl (24px) corners. Content inside should be highly legible Inter typography.

### Data Points (Biometrics)
Use thin-line icons (1.5pt stroke) paired with the accent colors (Emerald for Heart Rate, Pulse Red for Stress). Data should be displayed in a tabular, clean format within glass containers.

### Input Fields
Fields should have a dark, semi-transparent fill (`rgba(15, 23, 42, 0.5)`) and a subtle white border at 10% opacity. Upon focus, the border transitions to the Primary Indigo color with a 2px stroke.

### Health Chips
Small, high-contrast labels used to denote features like "Waterproof," "GPS," or "LTE." These use a `label-caps` font and a background tint that matches the accent color at 15% opacity.