# Dark mode — token checklist

Fill **dark** hex (or rgba) for each row. Light values are the current shipped UI.

Source of truth:

- CSS: `app/globals.css` → `:root` (light) / `.dark` (dark)
- Checklist: this file
- Tailwind: `bg-page`, `bg-panel`, `bg-surface`, `text-icon`, `border-stroke`, …

Theme switching is wired via `next-themes` (`html.dark`, `localStorage` key `theme`):

1. **System** follows OS `prefers-color-scheme` (default for first visit / first signup).
2. Auth pages (login / signup / …) use the same provider — no forced light theme.
3. Choosing **Light** or **Dark** is remembered across logout and login on that browser.
4. Profile menu → Appearance → Light / Dark / System.

---

## Required (core UI)

| Token | CSS variable | Light | Dark | Used for |
|-------|--------------|-------|------|----------|
| **Page** | `--fs-page` | `#F3F3F4` | `#000000` ✅ | Outer chrome / app wash around main panel |
| **Canvas** | `--fs-canvas` | `#FAFAFA` | `#000000` ✅ | Mobile grey behind cards; blur wash |
| **Panel** | `--fs-panel` | `#FCFCFD` | `#000000` ✅ | Main desktop panel + top bar + watchlist rail |
| **Nav** | `--fs-nav` | `#F3F3F4` ✅ | `#000000` ✅ | Left navigation rail (separate from page/panel) |
| **Surface** | `--fs-surface` | `#FFFFFF` | `#151515` ✅ | Cards (not dropdowns) |
| **Dropdown** | `--fs-dropdown` | `#FFFFFF` ✅ | `#212123` ✅ | Floating menu fill (matches `--fs-button`; dark shell uses `/70` + blur glass) |
| **Dropdown stroke** | `--fs-dropdown-stroke` | `#E4E4E7` ✅ | `#484848` ✅ | Light menus; dark shell uses `white/12` glass edge |
| **Dropdown item hover** | `--fs-dropdown-item-hover` | `#FAFAFA` ✅ | `#2C2C2E` ✅ | Menu row hover + selected |
| **Button** | `--fs-button` | `#FFFFFF` | `#212123` ✅ | Outline / white-chrome buttons (topbar, Customize, chips) |
| **Modal** | `--fs-modal` | `#FCFCFD` | `#0A0A0B` ✅ | Legacy token |
| **Modal title** | `--fs-modal-title` | `#F3F3F4` ✅ | `#212123` ✅ | Modal title chrome fill (aligned with `--fs-dropdown`; dark uses `/70` + blur glass) |
| **Modal title stroke** | `--fs-modal-title-stroke` | `transparent` ✅ | `white/12` ✅ | Modal title chrome edge (aligned with dropdown glass edge; separate token) |
| **Switch thumb** | `--fs-switch-thumb` | `#FFFFFF` | `#FFFFFF` ✅ | Active switch knob on accent track |
| **Switch thumb off** | `--fs-switch-thumb-off` | `#FFFFFF` | `#5D5D5F` ✅ | Idle switch knob (matches placeholder) |
| **Chart value label shadow** | `--fs-chart-value-label-shadow` | panel mix | panel mix ✅ | Soft halo behind bar value labels (follows `--fs-panel`) |
| **Surface muted** | `--fs-surface-muted` | `#F4F4F5` | `#242424` ✅ | Grey fill controls |
| **Surface section** | `--fs-surface-section` | `#F4F4F5` | `#191919` ✅ | Table year / sector divider bands |
| **Sidebar nav active** | `--fs-sidebar-nav-active` | `#E6E6E6` | `#1A1A1A` ✅ | Active left-nav pill (matches secondary tabs / `--fs-surface-subtle`) |
| **Surface subtle** | `--fs-surface-subtle` | `#F1F1F2` | `#1A1A1A` ✅ | Segmented track, group fills |
| **Surface hover** | `--fs-surface-hover` | `#EBEBEB` | `#232325` ✅ | Buttons, misc hover fills |
| **Input** | `--fs-field` | `#F1F1F2` | `#151515` ✅ | Text-entry + search fill (aligned with `--fs-surface`; separate token) |
| **Input stroke** | `--fs-field-stroke` | `transparent` | `#222222` ✅ | Text-entry border (aligned with `--fs-stroke-subtle`; separate token) |
| **Input hover** | `--fs-field-hover` | `#EBEBEB` | `#2C2C2E` ✅ | Dropdown trigger hover fill (legacy; prefer menu-item-hover) |
| **Input stroke hover** | `--fs-field-stroke-hover` | `transparent` | `#2A2A2A` ✅ | Text-entry idle hover border (dark only) |
| **Input stroke active** | `--fs-field-stroke-active` | `transparent` | `#222222` ✅ | Same as resting (legacy; prefer ring) |
| **Input ring** | `--fs-field-ring` | `transparent` | `rgba(255,255,255,0.12)` ✅ | Focus / open 2px outer shadow |
| **Menu item hover** | `--fs-menu-item-hover` | → dropdown-item-hover | → dropdown-item-hover | Alias of `--fs-dropdown-item-hover` |
| **Table row hover** | `--fs-table-row-hover` | `#FAFAFA` | `#1C1C1E` ✅ | Screener / data-table inset row hover (`neutral-50` light) |
| **Foreground** | `--fs-fg` | `#141414` | `#FFFFFF` ✅ | Primary text / prices |
| **Foreground muted** | `--fs-fg-muted` | `#5C5D5F` | `#999999` ✅ | Secondary text, inactive nav |
| **Placeholder** | `--fs-fg-subtle` | `#A1A1AA` | `#5D5D5F` ✅ | Placeholders, scrollbar, muted chrome |
| **Icon** | `--fs-icon` | `#141414` | `#FFFFFF` ✅ | Default icons |
| **Stroke** | `--fs-stroke` | `#E4E4E7` | `#212121` ✅ | Primary dividers, controls |
| **Table row stroke** | `--fs-table-row-stroke` | `#EFEFEF` | `#1F1F1F` ✅ | Inset table row rules |
| **Stroke subtle** | `--fs-stroke-subtle` | `#EBEBEC` | `#222222` ✅ | Card stroke |
| **Stroke shell** | `--fs-stroke-shell` | `#EBEBEC` | `#161617` ✅ | Main panel outline, top bar rule, watchlist rail |
| **Stroke muted** | `--fs-stroke-muted` | `#E8E8EB` | `#222222` ✅ | Button border (light). Dark chrome uses diagonal `#4E4E4E` @ 93%/43%/73% via `.fs-button-gradient-stroke` |
| **Up** | `--fs-up` | `#16A34A` | `#35D96C` ✅ | Positive % |
| **Down** | `--fs-down` | `#DC2626` | `#FF3349` ✅ | Negative % |
| **Accent** | `--fs-accent` | `#364AFF` ✅ | `#364AFF` ✅ | Links / interactive blue |
| **Accent hover** | `--fs-accent-hover` | `#2B3FE6` ✅ | `#2B3FE6` ✅ | Hover on accent buttons / links |
| **Orange** | `--fs-orange` | `#EA580C` | `#F7931A` ✅ | Watchlist / follow star; pre-market sun (dark) |
| **Orange soft** | `--fs-orange-soft` | `#FFEDD5` | `#322817` ✅ | Soft orange wash; pre-market bg (dark). Light pre-market icon keeps `#EA580C` / `#FFEDD5` hardcoded |
| **Accent soft** | `--fs-accent-soft` | `#DBEAFE` | `#0F1E29` ✅ | Soft blue wash; post-market moon bg (dark). Light moon keeps `#2563EB` / `#DBEAFE` hardcoded |

## Soft / flash

| Token | Light | Dark |
|-------|-------|------|
| **Up soft** | `#D1FAE5` | `#002C17` ✅ |
| **Down soft** | `#FECACA` | `#49080E` ✅ |
| **Alert bg** | `#FEF2F2` | `#382828` ✅ | Form error banners |
| **Alert border** | `#FECACA` | `#382828` ✅ | Form error banners |
| **Alert fg** | `#B91C1C` | `#EF4444` ✅ | Form error banners |
| **Info bg** | `#EFF6FF` | `#0F1E29` ✅ | Info banners (signed out) |
| **Info border** | `#BFDBFE` | `#0F1E29` ✅ | Info banners |
| **Info fg** | `#1D4ED8` | `#3B9EFF` ✅ | Info banners |
| **Success bg** | `#F0FDF4` | `#0E170E` ✅ | Success banners (signed in, password updated) |
| **Success border** | `#BBF7D0` | `#0E170E` ✅ | Success banners |
| **Success fg** | `#166534` | `#A3E635` ✅ | Success banners |
| **Chart dot** | `rgba(228,228,231,0.42)` | `rgba(255,255,255,0.095)` ✅ | Plot backdrop dots |
| **Chart watermark** | `rgba(161,161,170,0.2)` | `rgba(144,144,144,0.08)` ✅ | “Finsepa” behind series |
| **Chart skeleton** | `#E4E4E7` → `#F4F4F5` | `#1C1C1E` → `#161617` ✅ | Loading area shape |
| **Skeleton** | `--fs-skeleton` `#F4F4F5` | `#1A1A1B` ✅ | UI bars / pills (`.skeleton`, `bg-skeleton`) |

## RGB companions

| Token | Light | Dark |
|-------|-------|------|
| **Canvas RGB** | `250, 250, 250` | `0, 0, 0` ✅ |
| **Stroke RGB** | `228, 228, 231` | `33, 33, 33` ✅ (from `#212121`) |
| **Surface RGB** | `255, 255, 255` | `21, 21, 21` ✅ (from `#151515`) |
| **Shadow RGB** | `10, 10, 10` | `0, 0, 0` ✅ |
| **Shadow α 03** | `0.03` | `0.10` ✅ |
| **Shadow α 04** | `0.04` | `0.14` ✅ |
| **Shadow α 06** | `0.06` | `0.20` ✅ |
| **Shadow α 07** | `0.07` | `0.22` ✅ |
| **Shadow α 08** | `0.08` | `0.26` ✅ |
| **Shadow α 10** | `0.10` | `0.32` ✅ |
| **Shadow α 12** | `0.12` | `0.36` ✅ |

## Optional

| Token | Light | Dark |
|-------|-------|------|
| **Body** (`--foreground`) | `#171717` | `#FFFFFF` ✅ |

---

Core dark palette is complete (including soft up/down washes).
