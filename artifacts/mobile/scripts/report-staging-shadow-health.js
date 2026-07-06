#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const healthModulePath = path.join(packageRoot, 'data', 'remote', 'staging', 'health', 'stagingShadowHealthSnapshot.ts');

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
    json: false,
    strict: false,
    output: null,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--') {
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
    if (value === '--output') {
      const next = argv[index + 1];
      if (!next || next.startsWith('--')) {
        throw new Error('--output requires a path');
      }
      args.output = next;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${value}`);
  }

  return args;
}

function printHelp() {
  const lines = [
    'Usage: pnpm run report:staging-health [--json] [--output <path>] [--strict] [--help]',
    '',
    'Generates a staging shadow health snapshot for savedLocations and profile.',
    'The command is safe by default and never contacts the backend.',
    '',
    'Flags:',
    '  --json      Print JSON to stdout instead of the formatted report.',
    '  --output    Write JSON snapshot to the given path.',
    '  --strict    Exit non-zero when the snapshot is failing or blocked.',
    '  --help      Show this help.',
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

function writeOutputFile(outputPath, content) {
  const resolvedPath = path.resolve(repoRoot, outputPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, content, 'utf8');
  return resolvedPath;
}

function main() {
  installTypeScriptRequireHook();
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return 0;
  }

  // Lazy-load after the require hook is installed.
  const snapshotModule = require(healthModulePath);
  const snapshot = snapshotModule.createStagingShadowHealthSnapshot();
  const jsonOutput = snapshotModule.serializeStagingShadowHealthSnapshot(snapshot);
  const formattedOutput = snapshotModule.formatStagingShadowHealthSnapshot(snapshot);
  const evaluation = snapshotModule.evaluateStagingShadowHealthSnapshot(snapshot, args.strict);

  if (args.output) {
    writeOutputFile(args.output, jsonOutput);
  }

  process.stdout.write(args.json ? jsonOutput : `${formattedOutput}\n`);
  return evaluation.exitCode;
}

try {
  const exitCode = main();
  process.exit(exitCode);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
