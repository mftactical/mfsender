/*
 * This file is part of mfsender.
 *
 * mfsender is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * mfsender is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with mfsender. If not, see <https://www.gnu.org/licenses/>.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getUserDataDir } from '../../utils/paths.js';
import { createLogger } from '../../core/logger.js';

const { log } = createLogger('M98Migration');

const ID_MIN = 9001;
const ID_MAX = 9999;
const MACRO_EXT = '.macro';

const USER_DATA_DIR = getUserDataDir();
const MACROS_DIR = path.join(USER_DATA_DIR, 'macros');
const MIGRATED_MARKER = path.join(MACROS_DIR, '.migrated');
const LEGACY_MACROS_PATH = path.join(USER_DATA_DIR, 'macros.json');
const LEGACY_BACKUP_PATH = path.join(USER_DATA_DIR, 'macros.json.backup');
const SETTINGS_PATH = path.join(USER_DATA_DIR, 'settings.json');

function ensureMacrosDir() {
  try {
    fs.mkdirSync(MACROS_DIR, { recursive: true });
  } catch (error) {
    log('Failed to create macros directory:', error);
  }
}

function listMacroFiles() {
  try {
    const entries = fs.readdirSync(MACROS_DIR);
    return entries.filter(entry => entry.toLowerCase().endsWith(MACRO_EXT));
  } catch {
    return [];
  }
}

function writeMigratedMarker() {
  try {
    fs.writeFileSync(MIGRATED_MARKER, new Date().toISOString(), 'utf8');
  } catch (error) {
    log('Failed to write migrated marker:', error);
  }
}

function readLegacyMacros() {
  try {
    const raw = fs.readFileSync(LEGACY_MACROS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    log('Failed to read legacy macros.json:', error);
    return null;
  }
}

function backupLegacyMacros() {
  try {
    if (!fs.existsSync(LEGACY_BACKUP_PATH)) {
      fs.copyFileSync(LEGACY_MACROS_PATH, LEGACY_BACKUP_PATH);
    }
  } catch (error) {
    log('Failed to backup macros.json:', error);
  }
}

function writeMacroFile(macro) {
  const filePath = path.join(MACROS_DIR, `${macro.id}${MACRO_EXT}`);
  fs.writeFileSync(filePath, JSON.stringify(macro, null, 2), 'utf8');
}

function updateKeyboardBindings(idMap) {
  if (!fs.existsSync(SETTINGS_PATH)) {
    return;
  }

  let settings;
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
    settings = raw ? JSON.parse(raw) : null;
  } catch (error) {
    log('Failed to read settings for macro migration:', error);
    return;
  }

  if (!settings || typeof settings !== 'object' || !settings.keyboardBindings) return;

  const updatedBindings = { ...settings.keyboardBindings };
  let changed = false;

  Object.entries(updatedBindings).forEach(([key, value]) => {
    if (typeof value !== 'string') return;
    if (!value.startsWith('Macro:')) return;
    const oldId = value.slice('Macro:'.length);
    const newId = idMap.get(oldId);
    if (!newId) return;
    updatedBindings[key] = `Macro:${newId}`;
    changed = true;
  });

  if (!changed) return;

  const updatedSettings = {
    ...settings,
    keyboardBindings: updatedBindings
  };

  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(updatedSettings, null, 2), 'utf8');
    log('Migrated keyboard bindings for macros');
  } catch (error) {
    log('Failed to write settings for macro migration:', error);
  }
}

export function migrateLegacyMacrosIfNeeded() {
  ensureMacrosDir();

  if (fs.existsSync(MIGRATED_MARKER)) {
    return { migrated: false, reason: 'marker' };
  }

  const existingMacroFiles = listMacroFiles();
  if (existingMacroFiles.length > 0) {
    if (fs.existsSync(LEGACY_MACROS_PATH) && !fs.existsSync(LEGACY_BACKUP_PATH)) {
      backupLegacyMacros();
    }
    writeMigratedMarker();
    return { migrated: false, reason: 'existing' };
  }

  if (!fs.existsSync(LEGACY_MACROS_PATH)) {
    return { migrated: false, reason: 'no-legacy' };
  }

  const legacyMacros = readLegacyMacros();
  if (legacyMacros === null) {
    return { migrated: false, reason: 'read-failed' };
  }

  backupLegacyMacros();

  if (legacyMacros.length > (ID_MAX - ID_MIN + 1)) {
    log('Too many legacy macros to migrate into range 9001-9999');
    return { migrated: false, reason: 'range-exceeded' };
  }

  const idMap = new Map();
  const now = new Date().toISOString();

  legacyMacros.forEach((legacy, index) => {
    const newId = String(ID_MIN + index);
    idMap.set(String(legacy.id), newId);

    const macro = {
      id: newId,
      name: legacy.name || `Macro ${newId}`,
      description: legacy.description || '',
      commands: legacy.commands || '',
      createdAt: legacy.createdAt || now,
      updatedAt: legacy.updatedAt || now
    };

    writeMacroFile(macro);
  });

  updateKeyboardBindings(idMap);
  writeMigratedMarker();

  log(`Migrated ${legacyMacros.length} macro(s) to M98 format`);
  return { migrated: true, count: legacyMacros.length };
}

export { MACROS_DIR, MIGRATED_MARKER, LEGACY_MACROS_PATH };
