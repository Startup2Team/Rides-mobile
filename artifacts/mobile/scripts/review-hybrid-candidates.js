#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const packageRoot = path.resolve(__dirname, '..');
const gateModulePath = path.join(packageRoot, 'data', 'remote', 'readiness', 'hybridCandidateGate.ts');

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
  const args = { json: false, strict: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--') continue;
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
    throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  const lines = [
    'Usage: pnpm run review:hybrid-candidates [--json] [--strict] [--help]',
    '',
    'Reviews whether savedLocations and profile are eligible for HYBRID candidate approval.',
    'The command is safe by default and never contacts the backend.',
    '',
    'Flags:',
    '  --json    Print JSON to stdout instead of the formatted report.',
    '  --strict  Exit non-zero when approval evidence is invalid, expired, or blocked by guards.',
    '  --help    Show this help.',
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

function main() {
  installTypeScriptRequireHook();
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return 0;
  }

  const gate = require(gateModulePath);
  const report = gate.getHybridCandidateReviewReport({
    approvalFilePath: process.env.HYBRID_CANDIDATE_APPROVAL_FILE || undefined,
    baselinePath: process.env.HYBRID_CANDIDATE_BASELINE_FILE || undefined,
  });

  if (args.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${gate.formatHybridCandidateReviewReport(report)}\n`);
  }

  if (!args.strict) {
    return 0;
  }

  if (report.strictViolations.length > 0) {
    return 1;
  }

  return report.overallStatus === 'blocked' ? 1 : 0;
}

try {
  process.exit(main());
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
