// Convierte coverage/lcov.info (Bun) en el reporte HTML de Istanbul.
// Uso, desde frontend/ o backend/: bun ../scripts/coverage-html.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

// Las dependencias viven en el paquete que invoca el script, no en scripts/.
const cwd = process.cwd();
const require = createRequire(resolve(cwd, 'package.json'));
const libCoverage = require('istanbul-lib-coverage');
const libReport = require('istanbul-lib-report');
const reports = require('istanbul-reports');
const parse = require('lcov-parse');
const loc = (line) => ({
  start: { line, column: 0 },
  end: { line, column: 0 },
});

function toIstanbul(record) {
  const cov = {
    path: resolve(cwd, record.file),
    statementMap: {},
    s: {},
    fnMap: {},
    f: {},
    branchMap: {},
    b: {},
  };
  record.lines.details.forEach(({ line, hit }, i) => {
    cov.statementMap[i] = loc(line);
    cov.s[i] = hit;
  });
  record.functions.details.forEach(({ name, line, hit }, i) => {
    cov.fnMap[i] = { name, decl: loc(line), loc: loc(line), line };
    cov.f[i] = hit;
  });
  const groups = new Map();
  for (const { line, block, branch, taken } of record.branches.details) {
    const key = `${line}:${block}`;
    if (!groups.has(key)) groups.set(key, { line, hits: [] });
    groups.get(key).hits[branch] = taken === '-' ? 0 : taken;
  }
  [...groups.values()].forEach(({ line, hits }, i) => {
    cov.branchMap[i] = {
      type: 'branch',
      line,
      loc: loc(line),
      locations: hits.map(() => loc(line)),
    };
    cov.b[i] = hits;
  });
  return cov;
}

parse(
  readFileSync(resolve(cwd, 'coverage/lcov.info'), 'utf8'),
  (err, records) => {
    if (err) throw err;
    const map = libCoverage.createCoverageMap({});
    for (const record of records) {
      const cov = toIstanbul(record);
      map.addFileCoverage(cov);
    }
    const context = libReport.createContext({
      dir: resolve(cwd, 'coverage/html'),
      coverageMap: map,
    });
    reports.create('html').execute(context);
  }
);
