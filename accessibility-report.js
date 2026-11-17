const pa11y = require('pa11y');
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

    // Run Pa11y and collect issues
    for (const { url, label } of urls) {
        console.log(`Running test for ${label} (${url})...`);
        const result = await pa11y(url, {
            standard: 'WCAG2AA',
            wait: Number(process.env.WAIT_MS || 0),
            ignore: (process.env.IGNORE || '').split('|').filter(Boolean),
            timeout: 60000,
            // CHROME_PATH runs a system Chrome or Chromium (e.g. in a container)
            ...(process.env.CHROME_PATH ? { chromeLaunchConfig: { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] } } : {}),
            runners: ['axe', 'htmlcs'],
            includeNotices: true,
            includeWarnings: true,
            rules: [
                'Principle1.Guideline1_1.1_1_1', // Non-text Content (images, logos)
            ]
        });

        resultsByPage[label] = [];
        result.issues.filter(i => i.type === 'error').forEach(i => rawIssues.push({ label, url, runner: i.runner, code: i.code, message: i.message, selector: i.selector }));

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


    // Write the markdown content to a file
    fs.writeFileSync(outDir + '/accessibility-report.md', markdownContent);
    fs.writeFileSync(outDir + '/accessibility-issues.json', JSON.stringify(rawIssues, null, 2));

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
