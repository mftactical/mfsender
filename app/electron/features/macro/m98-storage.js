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
import { readSettings, saveSettings } from '../../core/settings-manager.js';
import { createLogger } from '../../core/logger.js';
import { migrateLegacyMacrosIfNeeded, MACROS_DIR, MIGRATED_MARKER, LEGACY_MACROS_PATH } from './migration.js';

const { log } = createLogger('M98Storage');

const MACRO_EXT = '.macro';
const ID_MIN = 9001;
const ID_MAX = 9999;

const DEFAULT_MACRO = {
  id: '9001',
  name: 'Macro Sample',
  description: 'Finds the hole center using probe',
  commands: `G91 G1 X100 F1000
G91 G1 X-100 F1000`,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

function ensureMacrosDir() {
  try {
    fs.mkdirSync(MACROS_DIR, { recursive: true });
  } catch (error) {
    log('Failed to create macros directory:', error);
  }
}

function isMacroFile(name) {
  return name.toLowerCase().endsWith(MACRO_EXT);
}

function getMacroPath(id) {
  return path.join(MACROS_DIR, `${id}${MACRO_EXT}`);
}

function parseMacroFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.id || !isValidMacroId(parsed.id)) return null;
    return parsed;
  } catch (error) {
    log('Failed to read macro file:', filePath, error);
    return null;
  }
}

function writeMacroFile(macro) {
  ensureMacrosDir();
  const filePath = getMacroPath(macro.id);
  fs.writeFileSync(filePath, JSON.stringify(macro, null, 2), 'utf8');
}

function listMacroFiles() {
  ensureMacrosDir();
  try {
    const entries = fs.readdirSync(MACROS_DIR);
    return entries.filter(isMacroFile);
  } catch (error) {
    log('Failed to list macros directory:', error);
    return [];
  }
}

function ensureDefaultMacroIfEmpty() {
  const files = listMacroFiles();
  if (files.length > 0) return;

  // Avoid overwriting migrated installations unless empty
  const hasLegacy = fs.existsSync(LEGACY_MACROS_PATH);
  const hasMigratedMarker = fs.existsSync(MIGRATED_MARKER);
  if (hasLegacy && !hasMigratedMarker) {
    return;
  }

  try {
    writeMacroFile(DEFAULT_MACRO);
    log('Created default M98 macro');
  } catch (error) {
    log('Failed to create default M98 macro:', error);
  }
}

export function isValidMacroId(id) {
  const numeric = Number.parseInt(String(id), 10);
  return Number.isFinite(numeric) && numeric >= ID_MIN && numeric <= ID_MAX;
}

export function normalizeMacroId(id) {
  const numeric = Number.parseInt(String(id), 10);
  if (!Number.isFinite(numeric)) return null;
  return String(numeric);
}

export function readMacros() {
  migrateLegacyMacrosIfNeeded();
  ensureMacrosDir();
  ensureDefaultMacroIfEmpty();

  const files = listMacroFiles();
  const macros = [];
  for (const file of files) {
    const macro = parseMacroFile(path.join(MACROS_DIR, file));
    if (macro) {
      macros.push(macro);
    }
  }

  return macros.sort((a, b) => Number.parseInt(a.id, 10) - Number.parseInt(b.id, 10));
}

export function getMacro(id) {
  const normalized = normalizeMacroId(id);
  if (!normalized || !isValidMacroId(normalized)) return null;
  const filePath = getMacroPath(normalized);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return parseMacroFile(filePath);
}

function getNextMacroId() {
  const macros = readMacros();
  const used = new Set(macros.map(m => Number.parseInt(m.id, 10)));
  for (let id = ID_MIN; id <= ID_MAX; id += 1) {
    if (!used.has(id)) {
      return String(id);
    }
  }
  throw new Error('No available macro IDs in range 9001-9999');
}

export function createMacro(macroData) {
  const id = getNextMacroId();
  const now = new Date().toISOString();

  const newMacro = {
    id,
    name: macroData.name || `Macro ${id}`,
    description: macroData.description || '',
    commands: macroData.commands || '',
    createdAt: now,
    updatedAt: now
  };

  writeMacroFile(newMacro);
  return newMacro;
}

export function updateMacro(id, updates) {
  const existing = getMacro(id);
  if (!existing) {
    throw new Error(`Macro with id ${id} not found`);
  }

  const updated = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString()
  };

  writeMacroFile(updated);
  return updated;
}

export function deleteMacro(id) {
  const existing = getMacro(id);
  if (!existing) {
    throw new Error(`Macro with id ${id} not found`);
  }

  try {
    fs.unlinkSync(getMacroPath(existing.id));
  } catch (error) {
    log('Failed to delete macro file:', error);
    throw error;
  }

  // Also remove any keyboard shortcut assigned to this macro
  try {
    const settings = readSettings();
    if (settings && settings.keyboardBindings) {
      const actionId = `Macro:${existing.id}`;
      if (actionId in settings.keyboardBindings) {
        const updatedBindings = { ...settings.keyboardBindings };
        delete updatedBindings[actionId];
        saveSettings({
          ...settings,
          keyboardBindings: updatedBindings
        });
        log(`Removed keyboard binding for deleted macro: ${actionId}`);
      }
    }
  } catch (error) {
    log('Failed to remove keyboard binding for deleted macro:', error);
  }

  return { success: true, id: existing.id };
}

export { ID_MIN as M98_ID_MIN, ID_MAX as M98_ID_MAX };
