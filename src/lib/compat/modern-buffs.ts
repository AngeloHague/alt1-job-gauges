import * as a1 from 'alt1';
import LegacyReader from 'alt1/buffs';
import * as OCR from 'alt1/ocr';
// Font from skillbert/alt1 src/buffs/imgs/font_small_main.data.png.
const fontImage = a1.webpackImages({
    digits: require('./modern-font.data.png'),
});
let modernFont: OCR.FontDefinition | null = null;
export const ready = fontImage.promise.then(() => {
    modernFont = OCR.loadFontImage(fontImage.digits, {
        basey: 9,
        spacewidth: 3,
        treshold: 0.3,
        color: [255, 255, 255],
        unblendmode: 'raw',
        shadow: true,
        chars: '0123456789m%hr.',
        seconds: '.',
    });
});
export function findModernSlots(image: ImageData, debuffs = false) {
    const points: { x: number; y: number; size: number }[] = [];
    const top = (x: number, y: number) => {
        const i = (y * image.width + x) * 4,
            r = image.data[i],
            g = image.data[i + 1],
            b = image.data[i + 2];
        return debuffs
            ? r > 180 && g < 30 && b < 30
            : g > 130 && g < 170 && r > 70 && r < 110 && b < 45;
    };
    for (let y = 0; y <= image.height - 27; y++)
        for (let x = 0; x <= image.width - 27; x++) {
            if (!top(x, y) || (x > 0 && top(x - 1, y))) continue;
            let length = 0;
            while (x + length < image.width && top(x + length, y)) length++;
            if (length !== 27) continue;
            const size = 27;
            const left = x;
            if (left < 0 || left + size > image.width) continue;
            // Both vertical edges must remain in the buff/debuff colour family.
            let edges = 0;
            for (let dy = 2; dy < size - 2; dy++) {
                for (const xx of [left, left + size - 1]) {
                    const i = ((y + dy) * image.width + xx) * 4,
                        r = image.data[i],
                        g = image.data[i + 1],
                        b = image.data[i + 2];
                    if (
                        debuffs
                            ? r > g * 1.6 && r > b * 1.6 && r > 100
                            : g > r * 1.15 && g > b * 1.4 && g > 70
                    )
                        edges++;
                }
            }
            if (edges >= 36) points.push({ x: left, y, size });
        }
    return points;
}
export class ModernBuff {
    bufferx = 0;
    buffery = 0;
    constructor(
        public buffer: ImageData,
        public isdebuff: boolean,
    ) {}
    readArg(type: string) {
        if (this.buffer.width === 27 && modernFont) {
            const padded = new a1.ImageData(35, 35);
            this.buffer.copyTo(padded, 0, 0, 27, 27, 4, 4);
            const result = OCR.readLine(
                padded,
                modernFont,
                [255, 255, 255],
                6,
                27,
                true,
                false,
            );
            const text = result.text.trim();
            const match = text.match(/^(\d+)(hr|m)?$/);
            return {
                time: match
                    ? Number(match[1]) *
                      (match[2] === 'hr' ? 3600 : match[2] === 'm' ? 60 : 1)
                    : NaN,
                arg: type === 'arg' ? text : '',
            };
        }
        return { time: NaN, arg: '' };
    }

    readTime() {
        return this.readArg('time').time;
    }
    countMatch(template: ImageData, _aggressive = false) {
        // Match the unchanged icon artwork above the timer; normalise scores for existing thresholds.
        let best = { tested: 0, failed: 999, passed: 0, skipped: 0 };
        for (let dx = -1; dx <= 1; dx++)
            for (let dy = -1; dy <= 1; dy++) {
                let passed = 0,
                    failed = 0,
                    skipped = 0;
                for (let y = 0; y < template.height; y++)
                    for (let x = 0; x < template.width; x++) {
                        const t = (y * template.width + x) * 4,
                            xx =
                                1 +
                                Math.floor(
                                    (x * (this.buffer.width - 2)) /
                                        template.width,
                                ) +
                                dx,
                            yy =
                                1 +
                                Math.floor(
                                    (y * (this.buffer.height - 2)) /
                                        template.height,
                                ) +
                                dy;
                        if (
                            template.data[t + 3] < 240 ||
                            xx < 1 ||
                            xx > this.buffer.width - 2 ||
                            yy < 1 ||
                            yy > Math.floor(this.buffer.height * 0.48)
                        ) {
                            skipped++;
                            continue;
                        }
                        const i = (yy * this.buffer.width + xx) * 4;
                        let diff = 0;
                        for (let c = 0; c < 3; c++)
                            diff += Math.abs(
                                this.buffer.data[i + c] - template.data[t + c],
                            );
                        if (diff < 105) passed++;
                        else failed++;
                    }
                if (passed > best.passed)
                    best = { tested: passed + failed, passed, failed, skipped };
            }
        // Existing gauge thresholds refer to a complete 25px icon.
        const ratio = best.passed / Math.max(1, best.tested);
        return {
            ...best,
            passed:
                best.tested >= 20 && ratio >= 0.65
                    ? Math.round(ratio * template.width * template.height)
                    : 0,
            failed: ratio >= 0.95 ? 0 : best.failed,
        };
    }
    compareBuffer(template: ImageData) {
        return this.countMatch(template).passed > 0;
    }
}
export default class CompatibleBuffReader {
    pos: { x: number; y: number; maxhor: number; maxver: number } | null = null;
    debuffs = false;
    private legacy = new LegacyReader();
    private cached: Array<ModernBuff | import('alt1/buffs').Buff> = [];
    private capturedAt = 0;
    find(image?: a1.ImgRef) {
        const shot = image || a1.captureHoldFullRs();
        const points = findModernSlots(shot.toData(), this.debuffs);
        if (points.length) {
            this.pos = { ...points[0], maxhor: 5, maxver: 1 };
            return true;
        }
        this.legacy.debuffs = this.debuffs;
        const found = this.legacy.find(shot);
        this.pos = this.legacy.pos;
        return found;
    }
    read(buffer?: ImageData): Array<ModernBuff | import('alt1/buffs').Buff> {
        if (!buffer && Date.now() - this.capturedAt < 100) return this.cached;
        const shot = buffer || a1.captureHoldFullRs().toData();
        const points = findModernSlots(shot, this.debuffs);
        if (points.length) {
            this.pos = { ...points[0], maxhor: 5, maxver: 1 };
            this.cached = points.map(
                (p) =>
                    new ModernBuff(
                        shot.clone({
                            x: p.x,
                            y: p.y,
                            width: p.size,
                            height: p.size,
                        }),
                        this.debuffs,
                    ),
            );
        } else {
            this.legacy.debuffs = this.debuffs;
            try {
                this.cached = this.legacy.find(new a1.ImgRefData(shot))
                    ? this.legacy.read() || []
                    : [];
            } catch {
                this.cached = [];
            }
        }
        this.capturedAt = Date.now();
        return this.cached;
    }
}
