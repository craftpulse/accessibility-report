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
    { url: 'https://www.antwerpen.be/nl/overzicht/district-berchem-1', label: 'Homepage' },
    { url: 'https://www.antwerpen.be/nl/overzicht/district-berchem-1/nieuws', label: 'Nieuws' },
    { url: 'https://www.antwerpen.be/nl/overzicht/district-berchem-1/nieuws/bar-brilschans-strijkt-neer-in-het-de-villegaspark', label: 'Nieuws detail' },
    { url: 'https://www.antwerpen.be/nl/overzicht/district-berchem-1/vraag-of-melding', label: 'FAQ' },
    { url: 'https://www.antwerpen.be/nl/overzicht/district-berchem-1/vraag-of-melding/een-vraag-melding-of-klacht-voor-het-district-berchem', label: 'FAQ detail' },
    { url: 'https://www.antwerpen.be/nl/overzicht/district-berchem-1/openbare-werken', label: 'Openbare werken' },
    { url: 'https://www.antwerpen.be/nl/overzicht/district-berchem-1/openbare-werken', label: 'Streetart' },
    { url: 'https://www.antwerpen.be/nl/overzicht/district-berchem-1/openbare-werken/heraanleg-cogels-osylei', label: 'Streetart detail' },
    { url: 'https://www.antwerpen.be/nl/overzicht/district-berchem-1/berchem-buurt', label: 'Berchem buurt' },
    { url: 'https://www.antwerpen.be/nl/overzicht/district-berchem-1/berchem-buurt/plaats-een-zitbank-aan-jouw-gevel', label: 'Berchem buurt detail' },
    { url: 'https://www.antwerpen.be/nl/overzicht/district-berchem-1/sport', label: 'Sport' },
    { url: 'https://www.antwerpen.be/nl/overzicht/district-berchem-1/sport/leer-reanimeren-met-berchem-redt', label: 'Sport detail' },
    { url: 'https://www.antwerpen.be/nl/overzicht/district-berchem-1/cultuur', label: 'Cultuur' },
    { url: 'https://www.antwerpen.be/nl/overzicht/district-berchem-1/cultuur/academie-berchem-muziek-woord-en-beeld', label: 'Cultuur detail' },
    { url: 'https://www.antwerpen.be/nl/overzicht/district-berchem-1/jeugd', label: 'Jeugd' },
    { url: 'https://www.antwerpen.be/nl/overzicht/district-berchem-1/jeugd/kinder-en-jeugdactiviteiten-jeugddienst-berchem', label: 'Jeugd detail' },
    { url: 'https://www.antwerpen.be/nl/overzicht/district-berchem-1/senioren', label: 'Senioren' },
    { url: 'https://www.antwerpen.be/nl/overzicht/district-berchem-1/senioren/tussenkomst-voor-huur-en-werkingskosten-van-lokalen', label: 'Senioren detail' },
    { url: 'https://www.antwerpen.be/nl/overzicht/district-berchem-1/bestuur', label: 'Bestuur' },
    { url: 'https://www.antwerpen.be/nl/overzicht/district-berchem-1/bestuur/samenstelling-districtscollege-berchem', label: 'Bestuur detail' },
    { url: 'https://www.antwerpen.be/nl/overzicht/district-berchem-1/groen', label: 'Groen' },
    { url: 'https://www.antwerpen.be/nl/overzicht/district-berchem-1/nuttige-adressen', label: 'Nuttige adressen' },
    { url: 'https://www.antwerpen.be/nl/overzicht/district-berchem-1/nuttige-adressen/een-vraag-melding-of-klacht-voor-het-district-berchem', label: 'Nuttige adressen detail' },
    { url: 'https://www.antwerpen.be/nl/overzicht/district-berchem-1/ondersteuning', label: 'Ondersteuning' },
    { url: 'https://www.antwerpen.be/nl/overzicht/district-berchem-1/ondersteuning/werkingtoelage-voor-berchemse-seniorenverenigingen', label: 'Ondersteuning' },
    { url: 'https://www.antwerpen.be/nl/overzicht/district-berchem-1/bibliotheek', label: 'Bibliotheek' },
    { url: 'https://www.antwerpen.be/nl/overzicht/district-berchem-1/bibliotheek/programma-bib-berchem', label: 'Bibliotheek detail' },
];

(async () => {
    const date = new Date().toISOString().split('T')[0];
    const resultsByPage = {};
    const issuesBySC = {};

    // Run Pa11y and collect issues
    for (const { url, label } of urls) {
        console.log(`Running test for ${label} (${url})...`);
        const result = await pa11y(url, {
            standard: 'WCAG2AA',
            runners: ['axe', 'htmlcs'],
            includeNotices: true,
            includeWarnings: true,
            rules: [
                'Principle1.Guideline1_1.1_1_1', // Non-text Content (images, logos)
            ]
        });

        resultsByPage[label] = [];

        result.issues.forEach(issue => {
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
                
                sc = axeToWcag[issue.code] || null;
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