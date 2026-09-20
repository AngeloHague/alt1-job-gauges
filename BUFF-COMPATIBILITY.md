# January 2026 buff UI compatibility

Job Gauges now uses `src/lib/compat/modern-buffs.ts` instead of depending solely on the installed `alt1/buffs` implementation. The desktop capture API is unchanged.

The reader locates native 27px buff/debuff slots by their coloured edges, without comparing transparent backgrounds. It scans the current game image rather than trusting saved coordinates, supports separate/moved bars and caches reads for 100ms. Icon matching uses the existing template artwork above timer text and normalises scores for the gauge thresholds. The bundled font is sourced from https://github.com/skillbert/alt1/blob/master/src/buffs/imgs/font_small_main.data.png . Unrecognised timer text is not passed into gauge state as NaN. Legacy layouts retain the original reader as a fallback.

Regression fixtures are native-resolution crops from the supplied full game screenshot. Some separately supplied close-up images were resized to 24px slots; they are not valid native capture fixtures. This interim reader supports the small native 27px layout, not arbitrary UI scaling or medium/large icons. Its geometry is independent of screen position and does not rely on background opacity. Live ALT1 capture still needs verification.

Run `npm run test:buff-compat`, `npx tsc --noEmit` and `npm run build`. Tests cover souls=2, necrosis=12, Split Soul=2 seconds, Living Death=6 seconds, debuffs=37 seconds / 4 minutes / 426 seconds, cross-icon rejection, moved bars, invalid borders and empty frames. The test harness stubs only the old legacy fallback, avoiding its Node canvas requirement; the modern reader, OCR font and icon templates are real.

Reload the rebuilt app in ALT1 and use Scan for Buff and Debuff Bars with buffs visible. There is no need to modify node_modules or install a modified ALT1 desktop client. Rendering can start when buffs are found even if no debuff is currently active; repeated startup callbacks no longer create multiple render intervals.

Cooldowns are still inferred by the existing plugin logic from buff transitions. This change does not add action-bar cooldown OCR or guarantee recovery when the final second of an active buff is missed. Multi-line time/argument text and other combat styles need additional native screenshot fixtures before broader recognition claims can be made.
