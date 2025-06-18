const pa11y = require('pa11y');
const fs = require('fs');
const markdownpdf = require('markdown-pdf');
const version = '2.2'; // wcag 2.2

let wcagData = JSON.parse(fs.readFileSync('./wcag/wcag-22-aa-expanded.json', 'utf-8'));
let wcagStructure = JSON.parse(fs.readFileSync('./wcag/wcag-22-aa-structure.json', 'utf-8'));

// Load WCAG SC metadata and structure
if (version == '2.1') {
    wcagData = JSON.parse(fs.readFileSync('./wcag/wcag-21-aa-expanded.json', 'utf-8'));
    wcagStructure = JSON.parse(fs.readFileSync('./wcag/wcag-21-aa-structure.json', 'utf-8'));
}


// Pages to test
const urls = [
    { url: 'https://test.be', label: 'Homepage' },
];

(async () => {
    const date = new Date().toISOString().split('T')[0];
    const resultsByPage = {};
    const issuesBySC = {};

    // Run Pa11y and collect issues
    for (const { url, label } of urls) {
        console.log(`Running test for ${label} (${url})...`);
        const result = await pa11y(url, {
            standard: 'WCAG2AA'
        });

        resultsByPage[label] = [];

        result.issues.forEach(issue => {
            const match = issue.code.match(/^WCAG2AA\.Principle\d+\.Guideline[\d_]+\.([\d_]+)\./);
            
            if (match) {
                const sc = match[1].replace(/_/g, '.'); // Normalize SC number (replace underscores with dots)
                
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
    markdownContent += `## 1. Evaluation Scope\n\n- **Date**: ${date}\n- **Tool**: [Pa11y](https://pa11y.org)\n- **Pages evaluated**:\n`;
    urls.forEach(({ label, url }) => markdownContent += `  - ${label}: ${url}\n`);
    
    markdownContent += `\n## 2. Methodology\n\nThis report was generated using **automated evaluation** only. Manual testing is recommended for full conformance verification.\n- **Standard**: WCAG ${version}\n- **Conformance Level**: AA\n- **Tool**: Pa11y (headless Chrome)\n\n## 3. Summary Table of WCAG Success Criteria\n\n`;

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

                let status = '✅ Met';
                if (affectedPages.length > 0) {
                    status = affectedPages.length < urls.length
                        ? '⚠️ Partially Met'
                        : '❌ Not Met';
                }

                // Use the title from the wcagData for each SC
                const scTitle = scDetails ? scDetails.title : 'Unknown';
                const scDescription = scDetails.description ? escapeTableCell(scDetails.description) : '-';

                scTable += `| ${scCode} | ${scTitle} | ${scDescription} | ${scLevel(scCode)} | ${status} | ${affectedPages.join(', ') || '-'} |\n`;
            });

            markdownContent += scTable;
        });
    });


    // Write the markdown content to a file
    fs.writeFileSync('accessibility-report.md', markdownContent);

    // Convert the markdown to PDF
    markdownpdf().from('accessibility-report.md').to('accessibility-report.pdf', () => {
        console.log('✅ Report written to accessibility-report.pdf');
    });
})();

// Helper function to get SC Level (A, AA)
function scLevel(sc) {
    const scData = wcagData.find(item => item.sc === sc);
    return scData ? scData.level : 'Unknown';
}

function escapeTableCell(str) {
    return str.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
}