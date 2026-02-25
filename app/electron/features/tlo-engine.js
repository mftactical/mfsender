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

function toNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseMPosZ(controller) {
  const rawMPos = controller?.lastStatus?.MPos;
  if (!rawMPos) {
    return null;
  }

  if (typeof rawMPos === 'string') {
    const parts = rawMPos.split(',');
    return toNumber(parts[2], null);
  }

  if (typeof rawMPos === 'object') {
    return toNumber(rawMPos.z, null);
  }

  return null;
}

let currentTLOEngine = null;

export function initTLOEngine({ controller, settingsStore, eventBus, log }) {
  const logger = typeof log === 'function' ? log : () => {};
  const bus = eventBus && typeof eventBus === 'object' ? eventBus : {};

  const tloState = {
    previousToolMposZ: null,
    active: false,
    running: false
  };

  const publishState = () => {
    if (typeof bus.onStateChange === 'function') {
      bus.onStateChange({ ...tloState });
    }
  };

  const refreshTLOActiveFromDollarG = (gcLineTokens = []) => {
    const tokens = Array.isArray(gcLineTokens) ? gcLineTokens : [];
    tloState.active = tokens.some((token) => String(token).toUpperCase() === 'G43.1');
    publishState();
    return tloState.active;
  };

  const setBaselineFromCurrentMposZ = () => {
    const z = parseMPosZ(controller);
    if (z === null) {
      return false;
    }
    tloState.previousToolMposZ = z;
    publishState();
    return true;
  };

  const runTLO = async () => {
    logger('[TLO] runTLO called before full engine wiring');
    throw new Error('TLO engine is not fully initialized');
  };

  const readSetting = (key, fallback = undefined) => {
    if (!settingsStore || typeof settingsStore.getSetting !== 'function') {
      return fallback;
    }
    const value = settingsStore.getSetting(key);
    return value === undefined ? fallback : value;
  };

  const api = {
    tloState,
    refreshTLOActiveFromDollarG,
    setBaselineFromCurrentMposZ,
    runTLO,
    readSetting
  };

  currentTLOEngine = api;
  return api;
}

export function getTLOEngine() {
  return currentTLOEngine;
}
