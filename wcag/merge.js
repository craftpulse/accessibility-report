const fs = require('fs');

// Load your file and the WAI quickref file
const localFile = JSON.parse(fs.readFileSync('wcag-21-aa.json', 'utf8'));
const waiFile = JSON.parse(fs.readFileSync('wai-wcag-quickref-21.json', 'utf8'));

// The real SC data is under waiFile.successcriteria
const scDescriptionMap = {};
waiFile.principles.forEach(item => {
    item.guidelines.forEach(guideline => {
        scDescriptionMap[guideline.num] = guideline.title;

        guideline.successcriteria.forEach(criteria => {
            scDescriptionMap[criteria.num] = criteria.title;
        })
    });
})

// Add description to each SC in your local structure
localFile.forEach(principle => {
    // principle.guidelines.forEach(guideline => {
        principle.description = scDescriptionMap[principle.sc] ?? '';
    // });
});

// Write the updated file back
fs.writeFileSync('wcag-21-aa-expanded.json', JSON.stringify(localFile, null, 2));
console.log('✅ wcag-21-aa-expanded.json updated with descriptions!');
