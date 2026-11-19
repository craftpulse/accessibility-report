// Measures the color contrast axe could not decide.
//
// axe reports color-contrast as "incomplete" when it cannot work out the
// background: a gradient, an image, a semi-transparent layer, an overlap, a
// pseudo-element. The text is still on screen, so its background can be read
// from the pixels. For each such element, on the page pa11y just tested:
//
//   1. wait for animations and transitions to finish (then emulate
//      prefers-reduced-motion if some are still running)
//   2. scroll it into view and work out its glyph boxes (the client rects of
//      its own text nodes), the part of them that is visible, and whether
//      anything paints on top of them
//   3. draw its text transparent (color, -webkit-text-fill-color,
//      text-shadow, caret-color, text-decoration-color), screenshot the glyph
//      boxes, and restore it
//   4. composite the text color (with the opacity of every ancestor) over
//      every background pixel inside the glyph boxes and take the worst
//      contrast, not the average, against 4.5:1 or 3:1 for large text
//      (24px, or 18.66px at weight 700 or more; WCAG 2.2 SC 1.4.3)
//
// What still cannot be measured keeps its "Check by hand" place, with the
// reason.

'use strict';

// Reasons an element stays undecided, in the order they are checked
const REASONS = {
    notFound: 'element not found',
    zeroSize: 'zero size',
    offScreen: 'off screen',
    clipped: 'clipped by an ancestor',
    covered: 'covered by another element',
    animation: 'animation not settled',
    paintedText: 'text painted with a gradient or image',
    filter: 'filter or blend mode on the text',
    invisible: 'text is transparent',
    textShadow: 'fails without its text shadow',
    iconOnly: 'icon characters only',
    emptyField: 'empty field, nothing to measure',
};

/**
 * Installs the in-page half of the resolver as window.__a11yContrast.
 * Runs in the browser, so it cannot close over anything in this file.
 */
function installInPage() {
    if (window.__a11yContrast) {
        return;
    }
    const FORM = new Set(['INPUT', 'SELECT', 'TEXTAREA']);
    const PAINTS = new Set(['IMG', 'SVG', 'CANVAS', 'VIDEO', 'IFRAME', 'PICTURE', 'OBJECT', 'EMBED']);
    const els = [];
    const saved = new Map();
    let ctx1 = null;

    const parseColor = css => {
        const m = css.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
        if (m) {
            const a = m[4] === undefined ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
            return [+m[1], +m[2], +m[3], a];
        }
        // Any other CSS color (oklch, color(), color-mix): let canvas convert it to sRGB
        ctx1 = ctx1 || new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently: true });
        ctx1.clearRect(0, 0, 1, 1);
        ctx1.fillStyle = '#000';
        ctx1.fillStyle = css;
        ctx1.fillRect(0, 0, 1, 1);
        const d = ctx1.getImageData(0, 0, 1, 1).data;
        return [d[0], d[1], d[2], d[3] / 255];
    };
    const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
    const intersect = (a, b) => {
        const left = Math.max(a.left, b.left), top = Math.max(a.top, b.top);
        const right = Math.min(a.right, b.right), bottom = Math.min(a.bottom, b.bottom);
        return right > left && bottom > top ? { left, top, right, bottom } : null;
    };
    const plain = r => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });

    // The boxes the element's own text is drawn in
    const glyphRects = el => {
        const rects = [];
        for (const n of el.childNodes) {
            if (n.nodeType === 3 && n.textContent.trim()) {
                const r = document.createRange();
                r.selectNodeContents(n);
                for (const b of r.getClientRects()) {
                    if (b.width > 0 && b.height > 0) {
                        rects.push(plain(b));
                    }
                }
            }
        }
        if (!rects.length) {
            // Form fields and text from ::before/::after: the content box
            const b = el.getBoundingClientRect(), cs = getComputedStyle(el);
            const box = {
                left: b.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft),
                top: b.top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop),
                right: b.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight),
                bottom: b.bottom - parseFloat(cs.borderBottomWidth) - parseFloat(cs.paddingBottom),
            };
            if (box.right > box.left && box.bottom > box.top) {
                rects.push(box);
            }
        }
        return rects;
    };

    // The rect minus whatever the viewport and overflow-clipping ancestors cut off
    const clipByAncestors = (el, rect) => {
        let r = rect;
        for (let p = el.parentElement; p && r; p = p.parentElement) {
            const cs = getComputedStyle(p);
            if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || /paint|strict|content/.test(cs.contain)) {
                const b = p.getBoundingClientRect();
                const box = {
                    left: cs.overflowX === 'visible' ? -Infinity : b.left,
                    right: cs.overflowX === 'visible' ? Infinity : b.right,
                    top: cs.overflowY === 'visible' ? -Infinity : b.top,
                    bottom: cs.overflowY === 'visible' ? Infinity : b.bottom,
                };
                r = intersect(r, box);
            }
            if (cs.position === 'fixed') {
                break;
            }
        }
        return r;
    };

    // Something painted on top of the text (not a descendant, not a transparent layer)
    const coveredAt = (el, x, y) => {
        const stack = document.elementsFromPoint(x, y);
        for (const n of stack) {
            if (n === el || n.contains(el)) {
                return null;
            }
            if (el.contains(n)) {
                continue;
            }
            const cs = getComputedStyle(n);
            if (parseColor(cs.backgroundColor)[3] > 0 || cs.backgroundImage !== 'none' || PAINTS.has(n.tagName.toUpperCase()) || (cs.backdropFilter && cs.backdropFilter !== 'none')) {
                return n;
            }
        }
        return null;
    };

    const related = (a, el) => a === el || a.contains(el) || el.contains(a);

    window.__a11yContrast = {
        // Finds each element and asks axe why it could not decide
        async register(selectors) {
            selectors.forEach((s, i) => { try { els[i] = document.querySelector(s); } catch (e) { els[i] = null; } });
            const keys = [];
            if (window.axe) {
                try {
                    const r = await window.axe.run(document, { runOnly: { type: 'rule', values: ['color-contrast'] }, resultTypes: ['incomplete'], elementRef: true });
                    const byEl = new Map();
                    (r.incomplete[0] ? r.incomplete[0].nodes : []).forEach(n => {
                        const c = (n.any || []).find(x => x.data && x.data.messageKey);
                        byEl.set(n.element, c ? c.data.messageKey : 'default');
                    });
                    els.forEach((el, i) => { keys[i] = byEl.get(el) || null; });
                } catch (e) { /* the reason is informative only */ }
            }
            return keys;
        },
        // Waits until every finite animation has finished, or the deadline passes
        async settle(ms) {
            const deadline = performance.now() + ms;
            const finite = () => document.getAnimations().filter(a => a.playState === 'running' && a.effect && isFinite(a.effect.getComputedTiming().endTime));
            while (finite().length && performance.now() < deadline) {
                await Promise.race([
                    Promise.all(finite().map(a => a.finished.catch(() => null))),
                    new Promise(r => setTimeout(r, Math.max(0, deadline - performance.now()))),
                ]);
            }
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            return document.getAnimations().filter(a => a.playState === 'running').length;
        },
        // Geometry and checks; draws the text transparent when it can be measured
        prepare(i) {
            const el = els[i];
            if (!el || !el.isConnected) {
                return { reason: 'notFound' };
            }
            if (!el.getClientRects().length || !glyphRects(el).length) {
                return { reason: FORM.has(el.tagName) && !el.value ? 'emptyField' : 'zeroSize' };
            }
            el.scrollIntoView({ block: 'center', inline: 'nearest' });
            const view = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
            const rects = glyphRects(el);
            const inView = rects.map(r => intersect(r, view)).filter(Boolean);
            if (!inView.length) {
                return { reason: 'offScreen' };
            }
            const visible = inView.map(r => clipByAncestors(el, r)).filter(r => r && r.right - r.left >= 1 && r.bottom - r.top >= 1);
            if (!visible.length) {
                return { reason: 'clipped' };
            }
            for (const r of visible) {
                const by = coveredAt(el, (r.left + r.right) / 2, (r.top + r.bottom) / 2);
                if (by) {
                    return { reason: 'covered', by: by.tagName.toLowerCase() + (by.id ? '#' + by.id : '') + [...by.classList].map(c => '.' + c).join('') };
                }
            }
            const union = visible.reduce((u, r) => ({ left: Math.min(u.left, r.left), top: Math.min(u.top, r.top), right: Math.max(u.right, r.right), bottom: Math.max(u.bottom, r.bottom) }));
            const moving = document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.target).some(a => {
                const t = a.effect.target;
                return related(t, el) || intersect(t.getBoundingClientRect(), union);
            });
            if (moving) {
                return { reason: 'animation' };
            }
            const cs = getComputedStyle(el);
            const fill = cs.webkitTextFillColor;
            if (/text/.test(cs.backgroundClip || cs.webkitBackgroundClip || '') || (fill && parseColor(fill).join() !== parseColor(cs.color).join() && parseColor(fill)[3] === 0)) {
                return { reason: 'paintedText' };
            }
            let opacity = 1, filtered = false;
            for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
                const s = getComputedStyle(n);
                opacity *= parseFloat(s.opacity);
                if ((s.filter && s.filter !== 'none') || (s.mixBlendMode && s.mixBlendMode !== 'normal')) {
                    filtered = true;
                }
            }
            if (filtered) {
                return { reason: 'filter' };
            }
            const color = parseColor(fill && parseColor(fill)[3] > 0 ? fill : cs.color);
            const alpha = color[3] * opacity;
            if (alpha < 0.01) {
                return { reason: 'invisible' };
            }
            const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10) || 400;
            const large = size >= 24 || (size >= 18.66 && weight >= 700);
            const props = ['color', '-webkit-text-fill-color', 'text-shadow', 'caret-color', 'text-decoration-color', 'transition'];
            saved.set(i, props.map(p => [p, el.style.getPropertyValue(p), el.style.getPropertyPriority(p)]));
            props.forEach(p => el.style.setProperty(p, p === 'transition' ? 'none' : (p === 'text-shadow' ? 'none' : 'transparent'), 'important'));
            const text = (el.textContent || el.value || '').trim();
            return {
                rects: visible, union, color, alpha, opacity, large, size, weight,
                shadow: cs.textShadow !== 'none',
                iconOnly: Boolean(text) && !/[\p{L}\p{N}]/u.test(text),
            };
        },
        // Paints the hidden text in one solid color, to see how much of it reaches the screen
        paint(i, css) {
            const el = els[i];
            el.style.setProperty('color', css, 'important');
            el.style.setProperty('-webkit-text-fill-color', css, 'important');
        },
        async frame() {
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        },
        restore(i) {
            const el = els[i], s = saved.get(i);
            if (el && s) {
                s.forEach(([p, v, pr]) => (v ? el.style.setProperty(p, v, pr) : el.style.removeProperty(p)));
            }
            saved.delete(i);
        },
        // Reads the screenshot and takes the worst contrast inside the glyph boxes
        async measure(shots, clip, m) {
            const decode = async b64 => {
                const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
                const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
                const cv = new OffscreenCanvas(bmp.width, bmp.height);
                const cx = cv.getContext('2d', { willReadFrequently: true });
                cx.drawImage(bmp, 0, 0);
                return { width: bmp.width, height: bmp.height, data: cx.getImageData(0, 0, bmp.width, bmp.height).data };
            };
            const bmp = await decode(shots.background);
            const data = bmp.data;
            const white = await decode(shots.white), black = await decode(shots.black);
            let reach = 0;
            const scale = bmp.width / clip.width;
            const [tr, tg, tb] = m.color, a = m.alpha;
            let worst = null, lightest = null, darkest = null, count = 0;
            for (const r of m.rects) {
                let x0 = Math.ceil((r.left - clip.x) * scale), x1 = Math.floor((r.right - clip.x) * scale);
                let y0 = Math.ceil((r.top - clip.y) * scale), y1 = Math.floor((r.bottom - clip.y) * scale);
                if (x1 <= x0) { x0 = Math.floor((r.left - clip.x) * scale); x1 = Math.ceil((r.right - clip.x) * scale); }
                if (y1 <= y0) { y0 = Math.floor((r.top - clip.y) * scale); y1 = Math.ceil((r.bottom - clip.y) * scale); }
                x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(bmp.width, x1); y1 = Math.min(bmp.height, y1);
                for (let y = y0; y < y1; y++) {
                    for (let x = x0; x < x1; x++) {
                        const k = (y * bmp.width + x) * 4;
                        const bg = [data[k], data[k + 1], data[k + 2]];
                        if (white.width === bmp.width && black.width === bmp.width) {
                            reach = Math.max(reach, ((white.data[k] - black.data[k]) + (white.data[k + 1] - black.data[k + 1]) + (white.data[k + 2] - black.data[k + 2])) / 765);
                        }
                        const fg = [a * tr + (1 - a) * bg[0], a * tg + (1 - a) * bg[1], a * tb + (1 - a) * bg[2]];
                        const cr = ratio(fg, bg), l = lum(bg);
                        count++;
                        if (!worst || cr < worst.ratio) { worst = { ratio: cr, bg, fg }; }
                        if (!lightest || l > lightest.l) { lightest = { l, bg }; }
                        if (!darkest || l < darkest.l) { darkest = { l, bg }; }
                    }
                }
            }
            if (!worst) {
                return null;
            }
            return {
                // How much of solid text reaches the screen: about the opacity chain when
                // nothing lies on top, lower under a scrim or an inert backdrop
                reach,
                ratio: worst.ratio, pixels: count,
                text: hex(worst.fg), background: hex(worst.bg),
                lightest: hex(lightest.bg), darkest: hex(darkest.bg),
            };
        },
    };
}

/**
 * Measures every incomplete color-contrast item pa11y found on one page.
 *
 * @param {import('puppeteer').Page} page - the page pa11y just tested, still open
 * @param {Array<{selector: string}>} items - that page's color-contrast "Check by hand" items
 * @param {{waitMs: number}} options - waitMs bounds the wait for animations
 * @returns {Promise<Array<object>>} one result per item: status pass, fail or undecided
 */
async function resolveContrast(page, items, { waitMs }) {
    if (!items.length) {
        return [];
    }
    const settleMs = Math.max(Number(waitMs) || 0, 1000);
    await page.evaluate(installInPage);
    const keys = await page.evaluate(s => window.__a11yContrast.register(s), items.map(i => i.selector || ''));
    let running = await page.evaluate(ms => window.__a11yContrast.settle(ms), settleMs);
    if (running > 0) {
        await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
        running = await page.evaluate(ms => window.__a11yContrast.settle(ms), settleMs);
    }

    const out = [];
    for (let i = 0; i < items.length; i++) {
        const base = { ...items[i], axeReason: keys[i] || null };
        let m;
        try {
            m = await page.evaluate(n => window.__a11yContrast.prepare(n), i);
        } catch (e) {
            m = { reason: 'notFound' };
        }
        if (m.reason) {
            out.push({ ...base, status: 'undecided', reason: REASONS[m.reason], ...(m.by ? { coveredBy: m.by } : {}) });
            continue;
        }
        let shot = null;
        try {
            await page.evaluate(() => window.__a11yContrast.frame());
            const clip = {
                x: Math.floor(m.union.left), y: Math.floor(m.union.top),
                width: Math.ceil(m.union.right) - Math.floor(m.union.left),
                height: Math.ceil(m.union.bottom) - Math.floor(m.union.top),
            };
            const take = () => page.screenshot({ clip, encoding: 'base64', captureBeyondViewport: false });
            const shots = { background: await take() };
            for (const [k, css] of [['white', '#fff'], ['black', '#000']]) {
                await page.evaluate((n, c) => window.__a11yContrast.paint(n, c), i, css);
                await page.evaluate(() => window.__a11yContrast.frame());
                shots[k] = await take();
            }
            await page.evaluate(n => window.__a11yContrast.restore(n), i);
            shot = await page.evaluate((d, c, mm) => window.__a11yContrast.measure(d, c, mm), shots, clip, m);
        } catch (e) {
            await page.evaluate(n => window.__a11yContrast.restore(n), i).catch(() => null);
        }
        if (!shot) {
            out.push({ ...base, status: 'undecided', reason: REASONS.zeroSize });
            continue;
        }
        // Solid text that reaches the screen at well under its own opacity is under
        // something translucent (a scrim, a backdrop) that hit testing cannot see,
        // for instance behind an inert modal backdrop
        if (shot.reach < 0.85 * m.opacity) {
            out.push({ ...base, status: 'undecided', reason: REASONS.covered, reach: Math.round(shot.reach * 100) / 100 });
            continue;
        }
        const required = m.large ? 3 : 4.5;
        const r = Math.floor(shot.ratio * 100) / 100;
        const measured = {
            ...base, ratio: r, required, large: m.large, fontSize: m.size, fontWeight: m.weight,
            textColor: shot.text, worstBackground: shot.background, lightestBackground: shot.lightest, darkestBackground: shot.darkest,
            textAlpha: Math.round(m.alpha * 1000) / 1000, reach: Math.round(shot.reach * 100) / 100, pixels: shot.pixels,
        };
        if (shot.ratio >= required) {
            out.push({ ...measured, status: 'pass' });
        } else if (m.shadow) {
            out.push({ ...measured, status: 'undecided', reason: REASONS.textShadow });
        } else if (m.iconOnly) {
            out.push({ ...measured, status: 'undecided', reason: REASONS.iconOnly });
        } else {
            out.push({ ...measured, status: 'fail' });
        }
    }
    return out;
}

module.exports = { resolveContrast, REASONS };
