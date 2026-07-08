#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const connectionModulePath = path.join(packageRoot, 'data', 'remote', 'staging', 'connection', 'index.ts');

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

function resolvePath(inputPath) {
  return path.resolve(repoRoot, inputPath);
}

function parseArgs(argv) {
  const args = {
    json: false,
    strict: false,
    help: false,
    evidence: path.join('artifacts', 'mobile', 'docs', 'staging', 'staging-connection-evidence.json'),
    manifest: path.join('artifacts', 'mobile', 'docs', 'contracts', 'staging-backend-contract-manifest.json'),
  };

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
    if (value === '--evidence') {
      const next = argv[index + 1];
      if (!next || next.startsWith('--')) throw new Error('--evidence requires a path');
      args.evidence = next;
      index += 1;
      continue;
    }
    if (value === '--manifest') {
      const next = argv[index + 1];
      if (!next || next.startsWith('--')) throw new Error('--manifest requires a path');
      args.manifest = next;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }

  return args;
}

function validateJsonFile(filePath, label) {
  const resolvedPath = resolvePath(filePath);
  const content = fs.readFileSync(resolvedPath, 'utf8');
  try {
    return { resolvedPath, value: JSON.parse(content) };
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${resolvedPath}`);
  }
}

function printHelp() {
  const lines = [
    'Usage: pnpm run check:staging-connection [--json] [--strict] [--evidence <path>] [--manifest <path>] [--help]',
    '',
    'Runs the staging backend connection checklist for savedLocations and profile.',
    'The command is safe by default and never contacts the backend.',
    '',
    'Flags:',
    '  --json       Print JSON to stdout instead of the formatted report.',
    '  --strict     Exit non-zero when the checklist is blocked or evidence/manifest are invalid.',
    '  --evidence   Path to the machine-readable staging connection evidence JSON.',
    '  --manifest   Path to the mobile contract expectation JSON.',
    '  --help       Show this help.',
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

async function main() {
  installTypeScriptRequireHook();
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return 0;
  }

  const connection = require(connectionModulePath);

  let evidenceValue;
  let manifestValue;
  try {
    evidenceValue = validateJsonFile(args.evidence, 'Staging connection evidence');
    manifestValue = validateJsonFile(args.manifest, 'Staging backend contract manifest');
  } catch (error) {
    if (args.strict) {
      throw error;
    }
  }

  const report = await connection.getStagingConnectionReport({
    evidencePath: evidenceValue?.resolvedPath,
    manifestPath: manifestValue?.resolvedPath,
  });

  if (args.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${connection.formatStagingConnectionReport(report)}\n`);
  }

  if (!args.strict) {
    return 0;
  }

  if (report.overallStatus === 'blocked') {
    return 1;
  }

  if (report.strictViolations.length > 0) {
    return 1;
  }

  if (report.overallStatus === 'ready_for_staging_shadow') {
    const missingCritical = report.checklistCategories
      .flatMap(category => category.items)
      .some(item => item.blocker || item.status === 'failed' || item.status === 'blocked');
    return missingCritical ? 1 : 0;
  }

  return 0;
}

main()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
