#!/usr/bin/env node

/**
 * Version Bump Script
 * Usage: node scripts/version-bump.js [patch|minor|major]
 * Default: patch
 */

const fs = require('fs');
const path = require('path');

const LEVEL = process.argv[2] || 'patch';
const VALID_LEVELS = ['patch', 'minor', 'major'];

if (!VALID_LEVELS.includes(LEVEL)) {
  console.error(`Invalid level: ${LEVEL}`);
  console.error(`Valid levels: ${VALID_LEVELS.join(', ')}`);
  process.exit(1);
}

const TAURI_CONFIG = 'src-tauri/tauri.conf.json';
const PACKAGE_JSON = 'package.json';

function readJson(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function incrementVersion(version, level) {
  const [major, minor, patch] = version.split('.').map(Number);

  switch (level) {
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'major':
      return `${major + 1}.0.0`;
  }
}

console.log('\n============================================');
console.log('   Version Bump Script');
console.log('============================================\n');

const pkg = readJson(PACKAGE_JSON);
const currentVersion = pkg.version;
const newVersion = incrementVersion(currentVersion, LEVEL);

console.log(`Current version: ${currentVersion}`);
console.log(`Bump level:      ${LEVEL}`);
console.log(`New version:     ${newVersion}`);

// Update files
console.log('\nUpdating files...');

const tauri = readJson(TAURI_CONFIG);
tauri.version = newVersion;
writeJson(TAURI_CONFIG, tauri);
console.log(`OK ${TAURI_CONFIG} -> ${newVersion}`);

pkg.version = newVersion;
writeJson(PACKAGE_JSON, pkg);
console.log(`OK ${PACKAGE_JSON} -> ${newVersion}`);

console.log('\nVersion updated successfully!\n');
