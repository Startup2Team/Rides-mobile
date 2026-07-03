#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..', '..');
const defaultCurrentPath = path.join(projectRoot, 'staging-health-report.json');
const defaultBaselinePath = path.join(projectRoot, 'docs', 'baselines', 'staging-health-baseline.json');

const statusOrder = {
  idle: 0,
  healthy: 1,
  degraded: 2,
  failing: 3,
  blocked: 4,
};

const recommendationOrder = {
  collect_data: 0,
  continue_shadow: 1,
  ready_for_hybrid_candidate: 2,
  investigate: 3,
  blocked: 4,
};

function parseArgs(argv) {
  const args = {
    current: defaultCurrentPath,
    baseline: defaultBaselinePath,
    strict: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--') continue;
    if (value === '--strict') {
      args.strict = true;
      continue;
    }
    if (value === '--help' || value === '-h') {
      args.help = true;
      continue;
    }
    if (value === '--current') {
      const next = argv[index + 1];
      if (!next || next.startsWith('--')) throw new Error('--current requires a path');
      args.current = next;
      index += 1;
      continue;
    }
    if (value === '--baseline') {
      const next = argv[index + 1];
      if (!next || next.startsWith('--')) throw new Error('--baseline requires a path');
      args.baseline = next;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }

  return args;
}

function printHelp() {
  const lines = [
    'Usage: pnpm run compare:staging-health [--current <path>] [--baseline <path>] [--strict] [--help]',
    '',
    'Compares a current staging health snapshot against the committed sanitized baseline.',
    'The command is JSON-only and does not contact the backend.',
    '',
    'Flags:',
    '  --current   Path to the current JSON snapshot.',
    '  --baseline  Path to the committed baseline JSON.',
    '  --strict    Exit non-zero on regression.',
    '  --help      Show this help.',
    '',
    `Defaults:`,
    `  current: ${defaultCurrentPath}`,
    `  baseline: ${defaultBaselinePath}`,
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

function readJsonFile(filePath) {
  const resolvedPath = path.resolve(projectRoot, filePath);
  const content = fs.readFileSync(resolvedPath, 'utf8');
  return { resolvedPath, value: JSON.parse(content) };
}

function asDomainMap(snapshot) {
  return new Map((snapshot.domains ?? []).map(domain => [domain.domain, domain]));
}

function compareRank(currentValue, baselineValue, orderMap) {
  const currentRank = orderMap[currentValue];
  const baselineRank = orderMap[baselineValue];
  if (typeof currentRank !== 'number' || typeof baselineRank !== 'number') {
    return { changed: currentValue !== baselineValue, regression: false };
  }
  return {
    changed: currentRank !== baselineRank,
    regression: currentRank > baselineRank,
  };
}

function recommendationRegression(currentValue, baselineValue) {
  if (baselineValue === 'ready_for_hybrid_candidate') {
    return ['continue_shadow', 'investigate', 'blocked'].includes(currentValue);
  }
  if (baselineValue === 'investigate') {
    return currentValue === 'blocked';
  }
  if (baselineValue === 'continue_shadow') {
    return currentValue === 'investigate' || currentValue === 'blocked';
  }
  if (baselineValue === 'collect_data') {
    return currentValue === 'blocked';
  }
  return currentValue === 'blocked';
}

function compareSnapshots(current, baseline, options = {}) {
  const scoreDropThreshold = Number.isFinite(Number(options.scoreDropThreshold))
    ? Number(options.scoreDropThreshold)
    : 10;

  const warnings = [];
  const regressions = [];
  const currentDomains = asDomainMap(current);
  const baselineDomains = asDomainMap(baseline);
  const allDomains = new Set([...baselineDomains.keys(), ...currentDomains.keys()]);

  const compareField = (label, currentValue, baselineValue, { regression = false } = {}) => {
    if (currentValue === baselineValue) return;
    warnings.push(`${label}: ${baselineValue} -> ${currentValue}`);
    if (regression) {
      regressions.push(`${label}: ${baselineValue} -> ${currentValue}`);
    }
  };

  compareField('overallStatus', current.overallStatus, baseline.overallStatus, compareRank(current.overallStatus, baseline.overallStatus, statusOrder));
  compareField('overallRecommendation', current.overallRecommendation, baseline.overallRecommendation, {
    regression: recommendationRegression(current.overallRecommendation, baseline.overallRecommendation),
  });

  for (const domainName of allDomains) {
    const currentDomain = currentDomains.get(domainName);
    const baselineDomain = baselineDomains.get(domainName);
    if (!currentDomain) {
      warnings.push(`domain missing in current snapshot: ${domainName}`);
      continue;
    }
    if (!baselineDomain) {
      warnings.push(`new domain in current snapshot: ${domainName}`);
      continue;
    }

    const statusCheck = compareRank(currentDomain.status, baselineDomain.status, statusOrder);
    compareField(`domain:${domainName}:status`, currentDomain.status, baselineDomain.status, {
      regression:
        statusCheck.regression ||
        (baselineDomain.status === 'idle' && currentDomain.status === 'failing') ||
        (baselineDomain.status === 'idle' && currentDomain.status === 'blocked') ||
        (baselineDomain.status === 'healthy' && ['degraded', 'failing', 'blocked'].includes(currentDomain.status)) ||
        (baselineDomain.status === 'degraded' && ['failing', 'blocked'].includes(currentDomain.status)),
    });

    compareField(`domain:${domainName}:recommendation`, currentDomain.recommendation, baselineDomain.recommendation, {
      regression: recommendationRegression(currentDomain.recommendation, baselineDomain.recommendation),
    });

    if (currentDomain.score !== baselineDomain.score) {
      warnings.push(`domain:${domainName}:score: ${baselineDomain.score ?? 'n/a'} -> ${currentDomain.score ?? 'n/a'}`);
      if (typeof baselineDomain.score === 'number' && typeof currentDomain.score === 'number') {
        const scoreDrop = baselineDomain.score - currentDomain.score;
        if (scoreDrop > scoreDropThreshold) {
          regressions.push(`domain:${domainName}:score dropped ${scoreDrop} points (threshold ${scoreDropThreshold})`);
        }
      }
    }
  }

  const currentBlockers = new Set(current.blockers ?? []);
  const baselineBlockers = new Set(baseline.blockers ?? []);
  for (const blocker of currentBlockers) {
    if (!baselineBlockers.has(blocker)) {
      warnings.push(`new blocker: ${blocker}`);
      regressions.push(`new blocker: ${blocker}`);
    }
  }

  if (JSON.stringify(current.warnings ?? []) !== JSON.stringify(baseline.warnings ?? [])) {
    warnings.push('warnings changed');
  }

  if (JSON.stringify(current.metricsSummary ?? {}) !== JSON.stringify(baseline.metricsSummary ?? {})) {
    warnings.push('metrics summary changed');
  }

  return {
    warnings,
    regressions,
    hasRegression: regressions.length > 0,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return 0;
  }

  const current = readJsonFile(args.current);
  const baseline = readJsonFile(args.baseline);
  const comparison = compareSnapshots(current.value, baseline.value, {
    scoreDropThreshold: process.env.STAGING_HEALTH_SCORE_DROP_THRESHOLD,
  });

  process.stdout.write(`Comparing staging health snapshots\n`);
  process.stdout.write(`Current: ${current.resolvedPath}\n`);
  process.stdout.write(`Baseline: ${baseline.resolvedPath}\n`);

  if (comparison.warnings.length === 0) {
    process.stdout.write('No differences detected.\n');
    return 0;
  }

  process.stdout.write('Differences:\n');
  for (const warning of comparison.warnings) {
    process.stdout.write(`- ${warning}\n`);
  }

  if (args.strict && comparison.hasRegression) {
    process.stdout.write('Strict mode: regression detected.\n');
    return 1;
  }

  if (!args.strict && comparison.hasRegression) {
    process.stdout.write('Non-strict mode: regression detected but exiting 0.\n');
  } else if (!args.strict) {
    process.stdout.write('Non-strict mode: differences detected but exiting 0.\n');
  }

  return 0;
}

if (require.main === module) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  parseArgs,
  compareSnapshots,
  defaultCurrentPath,
  defaultBaselinePath,
};
