'use strict';

// A Pa11y runner for axe-core with the WCAG 2.2 A and AA rules.
//
// Pa11y's own axe runner stops at the wcag21aa tag, so axe's WCAG 2.2 rules
// (target-size, 2.5.8) never run, and it takes the issue type from axe's
// impact alone: moderate and minor violations become warnings and notices,
// which this report does not count, while "needs review" results are errors
// unless levelCapWhenNeedsReview says otherwise. Here a violation of a rule
// that names a WCAG criterion is an error whatever its impact; a "needs review"
// result, and a best-practice rule that names no criterion, is a warning.
//
// axe-core is the copy Pa11y resolves, so the runner and Pa11y agree on it.

const path = require('path');
const axeCore = require.resolve('axe-core/axe.min.js', { paths: [path.dirname(require.resolve('pa11y'))] });

// Runs in the page: nothing from require() is in scope here.
const run = async options => {
    const tags = ['wcag2a', 'wcag21a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'];
    const known = window.axe.getRules().map(({ ruleId }) => ruleId.toLowerCase());
    const rules = {};
    (options.ignore || []).filter(id => known.includes(id)).forEach(id => { rules[id] = { enabled: false }; });
    (options.rules || []).filter(id => known.includes(id)).forEach(id => { rules[id] = { enabled: true }; });

    const { violations = [], incomplete = [] } = await window.axe.run(options.rootElement || window.document, {
        runOnly: { type: 'tags', values: tags },
        rules,
    });

    const find = target => {
        try {
            return target ? window.document.querySelector(target.join(' ')) : null;
        } catch (e) {
            return null;
        }
    };
    const toIssues = (result, needsFurtherReview) => {
        const wcag = (result.tags || []).some(tag => /^wcag\d/.test(tag));
        const type = needsFurtherReview || !wcag ? 'warning' : 'error';
        return (result.nodes.length ? result.nodes : [{ target: null }]).map(({ target }) => ({
            element: find(target),
            code: result.id,
            type,
            message: `${result.help} (${result.helpUrl})`,
            runnerExtras: {
                description: result.description,
                impact: result.impact,
                needsFurtherReview,
                help: result.help,
                helpUrl: result.helpUrl,
            },
        }));
    };

    return [
        ...violations.flatMap(result => toIssues(result, false)),
        ...incomplete.flatMap(result => toIssues(result, true)),
    ];
};

module.exports = {
    run,
    scripts: [axeCore],
    supports: '^10.0.0',
};
