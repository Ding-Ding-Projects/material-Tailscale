# Per-element appearance editor

## Behaviour

Right-click any element (or Shift+F10) and choose Edit appearance… to change typography (font, size, weight, letter spacing, line height, italic, underline, strikethrough, case, alignment), colours with the infinite picker, border, radius, padding, shadow, opacity, an image layer with opacity and blend mode, and filters, for normal, hover, focus, active and disabled states. The panel is anchored, resizable and draggable, and every change is in local history.

### Animation and transition

A second tab edits motion for each interaction state:

- **Animation**: none, fade, rise, scale, slide, pulse, spin or custom keyframes.
- **Timing**: duration, delay, repeat count or loop forever, direction, fill mode and play or pause.
- **Easing**: standard, emphasized, spring, decelerate, accelerate, linear, steps, or a custom cubic Bézier curve. The curve is drawn as you change it.
- **Keyframe timeline**: select a keyframe to edit its position, opacity, X and Y movement, scale and rotation. You can add or remove keyframes.
- **Transition between states**: which properties animate (all, transform, colour, shadow or opacity), with duration, delay and easing.
- **With reduced motion**: none, or a short fade.
- **Play preview**: plays the animation on a sample shape.

An animation set on the hover state plays on hover; one set on the normal state plays when the element appears. Reduced motion, from Settings or the system, always wins. Not available yet: scroll-driven timelines and sequences across sibling elements. Overrides apply to one element and its states, so give each element its own delay instead.

## Configuration

Reset one state, every state, or every element from Settings > Appearance.

## When something goes wrong

Elements without an id explain that their container should be styled.

## Security and privacy

Images stay local.

## How to verify

Edit the title bar background and reset it.

## 廣東話摘要

逐個元素改外觀，包括每個互動狀態。

## Suggested articles

- [Command palette (Ctrl+Shift+F)](../navigation/command-palette.md)
- [Settings that explain themselves](../navigation/settings-explanations.md)
