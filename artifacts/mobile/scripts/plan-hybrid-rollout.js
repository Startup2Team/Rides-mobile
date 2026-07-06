#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const packageRoot = path.resolve(__dirname, '..');
const evaluatorPath = path.join(packageRoot, 'data', 'remote', 'readiness', 'hybridDryRunEvaluator.ts');

function installTypeScriptRequireHook() {
  require.extensions['.ts'] = (module, filename) => {
    const source = fs.readFileSync(filename, 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2019,
        esModuleInterop: true,
        sourceMap: false,
      },
      fileName: filename,
    });
    module._compile(outputText, filename);
  };
}

function parseArgs(argv) {
  const args = {
    domains: [],
    all: false,
    json: false,
    strict: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--') continue;
    if (value === '--all') {
      args.all = true;
      continue;
    }
    if (value === '--json') {
      args.json = true;
      continue;
    }
    if (value === '--strict') {
      args.strict = true;
      continue;
    }
    if (value === '--help' || value === '-h') {
      args.help = true;
      continue;
    }
    if (value === '--domain') {
      const next = argv[index + 1];
      if (!next || next.startsWith('--')) throw new Error('--domain requires a domain name');
      args.domains.push(next);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }

  return args;
}

function printHelp() {
  const lines = [
    'Usage: pnpm run plan:hybrid-rollout [--domain <name>] [--domain <name>] [--all] [--json] [--strict] [--help]',
    '',
    'Builds a HYBRID rollout dry-run plan for savedLocations and profile.',
    'The command is safe by default and never contacts the backend.',
    '',
    'Flags:',
    '  --domain   Limit the report to a specific domain. Repeatable.',
    '  --all      Include all known HYBRID candidate domains.',
    '  --json     Print JSON to stdout instead of the formatted report.',
    '  --strict   Exit non-zero only when approved evidence is invalid or expired.',
    '  --help     Show this help.',
    '',
    'Environment overrides:',
    '  HYBRID_ROLLOUT_APPROVAL_FILE',
    '  HYBRID_ROLLOUT_BASELINE_FILE',
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

function resolveDomains(args, evaluator) {
  if (args.all || args.domains.length === 0) {
    return evaluator.getHybridCandidateDomains();
  }
  return args.domains;
}

function main() {
  installTypeScriptRequireHook();
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return 0;
  }

  const evaluator = require(evaluatorPath);
  const report = evaluator.getHybridDryRunPlanReport({
    domains: resolveDomains(args, evaluator),
    approvalFilePath: process.env.HYBRID_ROLLOUT_APPROVAL_FILE || undefined,
    baselinePath: process.env.HYBRID_ROLLOUT_BASELINE_FILE || undefined,
  });

  if (args.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${evaluator.formatHybridDryRunPlanReport(report)}\n`);
  }

  if (!args.strict) {
    return 0;
  }

  return report.strictViolations.length > 0 ? 1 : 0;
}

try {
  process.exit(main());
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
