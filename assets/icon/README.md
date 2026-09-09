# Cadence app icon — Direction H (rest arc + barbell)

Chosen 2026-09-09. Family rules from Threshold / Spindle: ink ground #0A0A0D, warm gradient #5D3147 → #CF5D22 → #F19B18, cream #F7E2BA for the "now" element.

- cadence-icon.svg — full 512 mark with rounded ground (store listing, site, README)
- ic_launcher_foreground.svg / ic_launcher_background.svg — adaptive icon layers; artwork sits inside the central 66 % safe zone
- ic_launcher_monochrome.svg — Android 13+ themed icon layer (single colour, system tints it)
- ic_notification.svg — 24 dp small icon, currentColor, bar + arc only

Convert SVGs to Android VectorDrawable with Android Studio's Vector Asset tool; keep viewportWidth/Height 512 for launcher layers and 24 for the notification icon.
