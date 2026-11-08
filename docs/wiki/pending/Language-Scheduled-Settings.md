# Scheduled settings

## Behaviour

Rules switch any appearance or language setting by time of day and weekday, in your local time zone with daylight saving handled by the clock. Later rules win. A rule can take its value from an HTTPS URL that returns {"value": …}.

## Configuration

Settings > Schedules, with a calm-evenings preset.

## When something goes wrong

A failing URL rule is skipped and the previous value stays.

## Security and privacy

Only HTTPS URLs are fetched.

## How to verify

Add a theme rule for the current hour and watch it apply.

## 廣東話摘要

按時間自動改設定，可以由 HTTPS 網址攞值。

## Suggested articles

- [Command palette (Ctrl+Shift+F)](Navigation-Command-Palette)
- [Settings that explain themselves](Navigation-Settings-Explanations)
