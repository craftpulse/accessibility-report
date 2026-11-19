const pa11y = require('pa11y');
// The Puppeteer pa11y itself depends on, so the versions match (pa11y README, `browser`)
const puppeteer = require(require.resolve('puppeteer', { paths: [require.resolve('pa11y')] }));
const { resolveContrast } = require('./contrast-resolver');
const fs = require('fs');
const markdownpdf = (...a) => require('markdown-pdf')(...a);
const version = '2.2'; // wcag 2.2

let wcagData = JSON.parse(fs.readFileSync(__dirname + '/wcag/wcag-22-aa-expanded.json', 'utf-8'));
let wcagStructure = JSON.parse(fs.readFileSync(__dirname + '/wcag/wcag-22-aa-structure.json', 'utf-8'));

// Load WCAG SC metadata and structure
if (version == '2.1') {
    wcagData = JSON.parse(fs.readFileSync(__dirname + '/wcag/wcag-21-aa-expanded.json', 'utf-8'));
    wcagStructure = JSON.parse(fs.readFileSync(__dirname + '/wcag/wcag-21-aa-structure.json', 'utf-8'));
}


// Pages to test, fed in rather than hard-coded:
//   node accessibility-report.js https://example.com/ https://example.com/about
//   node accessibility-report.js urls.json        (or URLS_FILE=urls.json)
// A list file is JSON [{ "url": "...", "label": "..." }] or plain text, one URL
// per line. With nothing given, urls.json is used when present, else
// urls.example.json.
function loadUrls() {
    const args = process.argv.slice(2);
    let file = process.env.URLS_FILE || args.find(a => /\.(json|txt)$/i.test(a));
    const direct = args.filter(a => /^https?:\/\//i.test(a));
    if (direct.length) {
        return direct.map(url => ({ url, label: url }));
    }
    if (!file) {
        file = fs.existsSync(__dirname + '/urls.json') ? __dirname + '/urls.json' : __dirname + '/urls.example.json';
    }
    const text = fs.readFileSync(file, 'utf-8').trim();
    if (text.startsWith('[')) {
        return JSON.parse(text).map(u => (typeof u === 'string' ? { url: u, label: u } : { url: u.url, label: u.label || u.url }));
    }
    return text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(url => ({ url, label: url }));
}
const urls = loadUrls();

const outDir = process.env.OUT_DIR || '.';
// Only errors decide a criterion's status; notices and warnings are prompts for
// manual checks and would mark every criterion Not Met. ALL_TYPES=1 counts them.

(async () => {
    const date = new Date().toISOString().split('T')[0];
    const resultsByPage = {};
    const issuesBySC = {};
    const rawIssues = [];
    // axe "incomplete" results: axe could not decide, so a person has to. pa11y 10
    // flags them with runnerExtras.needsFurtherReview; they are never errors and
    // never dropped, they go to the "Check by hand" list.
    const checkByHand = [];
    // Contrast axe could not decide, measured from the pixels (contrast-resolver.js).
    // On by default; RESOLVE_CONTRAST=0 turns it off.
    const resolve = process.env.RESOLVE_CONTRAST !== '0';
    const measured = [];

    // One browser for the run; each page gets a fresh tab, which stays open after
    // pa11y so the resolver measures the page exactly as it was tested.
    // CHROME_PATH runs a system Chrome or Chromium (e.g. in a container)
    const launchConfig = { acceptInsecureCerts: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] } : {}) };
    let browser = null;

    // Run Pa11y and collect issues
    for (const { url, label } of urls) {
        console.log(`Running test for ${label} (${url})...`);
        if (!browser || !browser.connected) {
            browser = await puppeteer.launch(launchConfig);
        }
        const page = await browser.newPage();
        const result = await pa11y(url, {
            browser,
            page,
            standard: 'WCAG2AA',
            wait: Number(process.env.WAIT_MS || 0),
            ignore: (process.env.IGNORE || '').split('|').filter(Boolean),
            timeout: 60000,
            runners: ['axe', 'htmlcs'],
            includeNotices: true,
            includeWarnings: true,
            // Caps axe "needs further review" results at warning, so only real
            // violations are errors (pa11y 9.1+; the default is error)
            levelCapWhenNeedsReview: 'warning',
            rules: [
                'Principle1.Guideline1_1.1_1_1', // Non-text Content (images, logos)
            ]
        });

        resultsByPage[label] = [];
        const needsReview = i => Boolean(i.runnerExtras && i.runnerExtras.needsFurtherReview);
        result.issues.filter(i => i.type === 'error' && !needsReview(i)).forEach(i => rawIssues.push({ label, url, runner: i.runner, code: i.code, message: i.message, selector: i.selector }));
        const undecided = result.issues.filter(needsReview).map(i => ({ label, url, runner: i.runner, code: i.code, message: i.message, selector: i.selector }));
        const contrast = resolve ? undecided.filter(i => i.code === 'color-contrast') : [];
        undecided.filter(i => !contrast.includes(i)).forEach(i => checkByHand.push(i));
        if (contrast.length) {
            let results;
            try {
                results = await resolveContrast(page, contrast, { waitMs: process.env.WAIT_MS });
            } catch (e) {
                results = contrast.map(i => ({ ...i, status: 'undecided', reason: 'could not measure: ' + e.message.split('\n')[0] }));
            }
            results.forEach(r => {
                measured.push(r);
                if (r.status === 'fail') {
                    rawIssues.push({ label, url, runner: 'resolver', code: 'color-contrast', message: measuredMessage(r), selector: r.selector });
                    resultsByPage[label].push('1.4.3');
                    (issuesBySC['1.4.3'] = issuesBySC['1.4.3'] || new Set()).add(label);
                } else if (r.status === 'undecided') {
                    checkByHand.push({ label, url, runner: r.runner, code: r.code, message: `${r.message} Not measured: ${r.reason}${r.ratio ? ` (${r.ratio}:1, needs ${r.required}:1)` : ''}.`, selector: r.selector, reason: r.reason });
                }
            });
        }
        await page.close().catch(() => null);

        result.issues.filter(issue => process.env.ALL_TYPES === '1' || issue.type === 'error').forEach(issue => {
            // Handle both standard Pa11y format and axe/htmlcs format
            let sc = null;
            
            // Standard Pa11y format
            const match = issue.code && issue.code.match(/^WCAG2AA\.Principle\d+\.Guideline[\d_]+\.([\d_]+)\./);
            if (match) {
                sc = match[1].replace(/_/g, '.'); // Normalize SC number (replace underscores with dots)
            } 
            // Handle axe format
            else if (issue.runner === 'axe' && issue.code) {
                // Map axe rules to WCAG SC
                const axeToWcag = {
                    'image-alt': '1.1.1',
                    'image-redundant-alt': '1.1.1',
                    'input-image-alt': '1.1.1',
                    'object-alt': '1.1.1',
                    'role-img-alt': '1.1.1'
                };
                
                sc = axeToWcag[issue.code] || axeScFromTags(issue.code);
            }
            // Handle htmlcs format
            else if (issue.runner === 'htmlcs' && issue.code) {
                // Extract SC from HTMLCS format (e.g., WCAG2AA.Principle1.Guideline1_1.1_1_1.H37)
                const htmlcsMatch = issue.code.match(/WCAG2AA\.Principle\d+\.Guideline[\d_]+\.([\d_]+)\./);
                if (htmlcsMatch) {
                    sc = htmlcsMatch[1].replace(/_/g, '.');
                }
            }

            
            if (sc) {
                resultsByPage[label].push(sc);
        
                if (!issuesBySC[sc]) {
                    issuesBySC[sc] = new Set();
                }
        
                issuesBySC[sc].add(label);
            }
        });        

    }
    if (browser) {
        await browser.close();
    }
    console.log(issuesBySC)

    // Create Markdown Table
    let markdownContent = `# Accessibility Evaluation Report\n\n`;
    markdownContent += `## 1. Evaluation Scope\n\n- **Date**: ${date}\n- **Tool**: [Pa11y](https://pa11y.org) with [axe-core](https://github.com/dequelabs/axe-core) and [HTML_CodeSniffer](https://github.com/squizlabs/HTML_CodeSniffer)\n- **Pages evaluated**:\n`;
    urls.forEach(({ label, url }) => markdownContent += `  - ${label}: ${url}\n`);
    
    markdownContent += `\n## 2. Methodology\n\nThis report was generated using **automated evaluation** only. Manual testing is recommended for full conformance verification.\n- **Standard**: WCAG ${version}\n- **Conformance Level**: AA\n- **Tools**: Pa11y (headless Chrome) with axe-core and HTML_CodeSniffer runners\n\n## 3. Summary Table of WCAG Success Criteria\n\n`;

    // Loop through the structured WCAG data
    wcagStructure.forEach(({ principle, principleTitle, guidelines }) => {
        markdownContent += `### ${principle}. ${principleTitle}\n\n`;

        guidelines.forEach(({ guideline, title, sc }) => {
            markdownContent += `#### ${guideline} ${title}\n\n`;

            // Create the SC table for each guideline
            let scTable = `| SC | Title | Description | Level | Status | Pages |\n`;
            scTable += `|----|--------------|--------------------------|-------|--------|--------|\n`;

            sc.forEach(scCode => {
                const affectedPages = issuesBySC[scCode] ? Array.from(issuesBySC[scCode]) : [];
                const scDetails = wcagData.find(item => item.sc === scCode); // Find the SC details from wcagData

                let status = 'Met';
                let pagesInfo = '-';
                
                if (affectedPages.length > 0) {
                    // Get list of pages that meet the criteria
                    const allPageLabels = urls.map(u => u.label);
                    const failingPages = affectedPages;
                    const passingPages = allPageLabels.filter(label => !failingPages.includes(label));
                    
                    if (passingPages.length > 0 && failingPages.length > 0) {
                        // Some pages pass, some fail
                        status = 'Partially Met';
                        pagesInfo = `Failing: ${failingPages.join(', ')} | Passing: ${passingPages.join(', ')}`;
                    } else {
                        // All pages fail
                        status = 'Not Met';
                        pagesInfo = affectedPages.join(', ');
                    }
                }

                // Use the title from the wcagData for each SC
                const scTitle = scDetails ? scDetails.title : 'Unknown';
                const scDescription = scDetails.description ? escapeTableCell(scDetails.description) : '-';

                scTable += `| ${scCode} | ${scTitle} | ${scDescription} | ${scLevel(scCode)} | ${status} | ${pagesInfo} |\n`;
            });

            markdownContent += scTable;
        });
    });


    // Check by hand: what axe could not decide, counted per code, then listed
    const byCode = {};
    checkByHand.forEach(i => { byCode[i.code] = (byCode[i.code] || 0) + 1; });
    const codeCounts = Object.entries(byCode).sort((a, b) => b[1] - a[1]);
    markdownContent += `\n## 4. Check by hand\n\n`;
    if (!checkByHand.length) {
        markdownContent += `Nothing: axe decided every check it ran.\n`;
    } else {
        markdownContent += `axe could not decide these (its "needs further review" results). They are not errors and do not change the status above, but each one needs a person to look at it. The color contrast ones are what the report could not measure either; the message says why (section 5).\n\n`;
        markdownContent += `${checkByHand.length} items on ${new Set(checkByHand.map(i => i.label)).size} pages.\n\n| Code | Count |\n|------|-------|\n`;
        codeCounts.forEach(([code, n]) => markdownContent += `| ${code} | ${n} |\n`);
        markdownContent += `\n| Page | Code | Selector | Message |\n|------|------|----------|---------|\n`;
        checkByHand.forEach(i => markdownContent += `| ${escapeTableCell(i.label)} | ${i.code} | \`${escapeTableCell(i.selector || '-').replace(/\|/g, '\\|')}\` | ${escapeTableCell(i.message || '').replace(/\|/g, '\\|')} |\n`);
    }

    // Measured by the report: the color contrast axe could not decide
    const tally = { incomplete: measured.length, passed: 0, failed: 0, undecided: 0, undecidedByReason: {}, byAxeReason: {} };
    measured.forEach(r => {
        tally[{ pass: 'passed', fail: 'failed', undecided: 'undecided' }[r.status]]++;
        if (r.status === 'undecided') {
            tally.undecidedByReason[r.reason] = (tally.undecidedByReason[r.reason] || 0) + 1;
        }
        const k = r.axeReason || 'unknown';
        tally.byAxeReason[k] = tally.byAxeReason[k] || { passed: 0, failed: 0, undecided: 0 };
        tally.byAxeReason[k][{ pass: 'passed', fail: 'failed', undecided: 'undecided' }[r.status]]++;
    });
    markdownContent += `\n## 5. Measured by the report\n\n`;
    if (!resolve) {
        markdownContent += `Off (RESOLVE_CONTRAST=0): the color contrast axe could not decide is listed under "Check by hand".\n`;
    } else if (!measured.length) {
        markdownContent += `Nothing to measure: axe decided every color contrast check.\n`;
    } else {
        markdownContent += `axe could not decide ${measured.length} color contrast checks (text over a gradient, an image, a semi-transparent layer or an overlap). The report measured them from the pixels on screen: the text drawn transparent, the background captured, the text color composited over every background pixel inside the glyph boxes, and the worst pixel compared with 4.5:1, or 3:1 for large text. Failures are errors above (runner \`resolver\`); what could not be measured stays under "Check by hand" with the reason.\n\n`;
        markdownContent += `| Result | Count |\n|--------|-------|\n| Passed | ${tally.passed} |\n| Failed | ${tally.failed} |\n| Still undecided | ${tally.undecided} |\n`;
        Object.entries(tally.undecidedByReason).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => markdownContent += `| Undecided: ${k} | ${n} |\n`);
        const failed = measured.filter(r => r.status === 'fail');
        if (failed.length) {
            markdownContent += `\n| Page | Selector | Ratio | Needs | Text | Worst background |\n|------|----------|-------|-------|------|------------------|\n`;
            failed.forEach(r => markdownContent += `| ${escapeTableCell(r.label)} | \`${escapeTableCell(r.selector || '-').replace(/\|/g, '\\|')}\` | ${r.ratio}:1 | ${r.required}:1 | ${r.textColor} | ${r.worstBackground} |\n`);
        }
    }

    // Write the markdown content to a file
    fs.writeFileSync(outDir + '/accessibility-report.md', markdownContent);
    fs.writeFileSync(outDir + '/accessibility-issues.json', JSON.stringify(rawIssues, null, 2));
    fs.writeFileSync(outDir + '/accessibility-check-by-hand.json', JSON.stringify({ counts: Object.fromEntries(codeCounts), checkByHand }, null, 2));
    fs.writeFileSync(outDir + '/accessibility-contrast-measured.json', JSON.stringify({ enabled: resolve, counts: tally, measured }, null, 2));

    // Convert the markdown to PDF
    console.log('✅ Report written to ' + outDir + '/accessibility-report.md');
    // NO_PDF=1 skips the PDF (markdown-pdf needs PhantomJS, which has no linux/arm64 build)
    if (process.env.NO_PDF !== '1') {
        try {
            markdownpdf().from(outDir + '/accessibility-report.md').to(outDir + '/accessibility-report.pdf', () => {
                console.log('✅ Report written to ' + outDir + '/accessibility-report.pdf');
            });
        } catch (e) {
            console.log('PDF skipped: ' + e.message);
        }
    }
})();

// The message for a contrast failure the resolver measured
function measuredMessage(r) {
    return `Measured contrast ${r.ratio}:1, needs ${r.required}:1${r.large ? ' (large text)' : ''}: text ${r.textColor} over ${r.worstBackground}, the worst background pixel inside the glyph boxes (axe could not decide: ${r.axeReason || 'unknown'})`;
}

// Helper function to get SC Level (A, AA)
function scLevel(sc) {
    const scData = wcagData.find(item => item.sc === sc);
    return scData ? scData.level : 'Unknown';
}

function escapeTableCell(str) {
    return str.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
}
// axe-core tags each rule with its success criteria (e.g. wcag143 -> 1.4.3)
let axeRuleSc = null;
function axeScFromTags(code) {
    if (!axeRuleSc) {
        axeRuleSc = {};
        require(require.resolve('axe-core', { paths: [require.resolve('pa11y')] })).getRules().forEach(r => {
            const t = r.tags.find(x => /^wcag\d{3,4}$/.test(x));
            if (t) { const d = t.slice(4); axeRuleSc[r.ruleId] = d[0] + '.' + d[1] + '.' + d.slice(2); }
        });
    }
    return axeRuleSc[code] || null;
}
