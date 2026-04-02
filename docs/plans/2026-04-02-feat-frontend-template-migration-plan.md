---
title: "Frontend Template Migration: MUI → shadcn/ui + Tailwind"
type: feat
date: 2026-04-02
---

# Frontend Template Migration

## Overview

Migrate the web app from MUI to shadcn/ui + Tailwind CSS, adopting the visual language from the v0Template. Keep the product simpler than the template — extract only the design elements (ASCII sphere, animations, navigation, card patterns) and rebuild all pages for MajorMap's specific use case.

## What to Extract from v0Template

### Must have:

- **AnimatedSphere** — ASCII art rotating globe (canvas-based, `components/landing/animated-sphere.tsx`)
- **Navigation** — scroll-aware nav that shrinks + blurs on scroll
- **Grid lines background** — subtle grid overlay on hero
- **Noise overlay** — CSS-based film grain effect
- **Animated word cycling** — char-in blur animation for hero text
- **Feature cards** — numbered layout with SVG animated visuals
- **shadcn/ui components** — Button, Card, Input, Badge, Tabs
- **Tailwind v4 CSS** — design tokens via CSS variables
- **Typography** — Instrument Sans/Serif + JetBrains Mono

### Skip (too complex for our needs):

- Pricing section, testimonials, security section, integrations
- Three.js / @react-three/fiber (the template includes it but only uses canvas)
- Most Radix primitives (we only need a handful)
- Dark mode toggle (defer)

## Migration Steps

1. Install Tailwind v4, shadcn/ui deps, lucide-react, fonts
2. Remove MUI + Emotion deps
3. Port globals.css with design tokens + animations
4. Port shadcn/ui components: Button, Card, Input, Badge, Tabs
5. Rebuild Navigation (adapted for MajorMap routes)
6. Rebuild Landing page with AnimatedSphere + MajorMap-specific content
7. Rebuild Programs page with shadcn Card components
8. Rebuild Program Detail with requirement tree
9. Rebuild Courses page with table
10. Rebuild Course Detail with prereq display
11. Remove ThemeRegistry, AppNav, theme.ts (MUI artifacts)

## Acceptance Criteria

- [ ] All pages render with new design
- [ ] ASCII sphere animates on landing page
- [ ] Navigation shrinks on scroll
- [ ] Programs/courses pages show real Supabase data
- [ ] Build passes
- [ ] All existing tests pass (update theme tests)
