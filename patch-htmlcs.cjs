// HTML_CodeSniffer 2.5.1 looks up "1_3_5_H98.InvalidAutoComplete_*" while its
// translations are keyed "InvalidAutocomplete_*", so any page with an
// autocomplete value in the wrong control group crashes the whole run.
// Runs as the postinstall script; run it by hand after `npm ci --ignore-scripts`.
const fs = require('fs');
let f;
try {
    f = require.resolve('html_codesniffer/build/HTMLCS.js', { paths: [require.resolve('pa11y'), __dirname] });
} catch (e) {
    console.log('html_codesniffer not found, nothing to patch');
    process.exit(0);
}
const s = fs.readFileSync(f, 'utf8');
fs.writeFileSync(f, s.replace(/InvalidAutoComplete_/g, 'InvalidAutocomplete_'));
console.log('patched ' + f);
