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
    running: false,
    dirty: false
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

  const markDirty = () => {
    tloState.dirty = true;
    publishState();
  };

  function canRunTLO() {
    const status = controller?.lastStatus?.status;
    const homed = controller?.lastStatus?.homed;

    if (status !== 'Idle') return false;
    if (homed !== true) return false;
    if (!tloState.active) return false;
    if (tloState.previousToolMposZ == null) return false;

    return true;
  }

  const runTLO = async () => {
    if (tloState.running) {
      throw new Error('TLO already running');
    }

    if (!canRunTLO()) {
      throw new Error('TLO gating conditions not met');
    }

    const requiredSettings = [
      'toolSetterX',
      'toolSetterY',
      'safeZ',
      'approachZ',
      'seekRate',
      'fineRate',
      'retract',
      'seekDistance',
      'fineDistance'
    ];
    const settings = {};
    for (const key of requiredSettings) {
      const value = settingsStore?.getSetting?.(key);
      if (value === null || value === undefined) {
        throw new Error('Missing TLO settings');
      }
      settings[key] = value;
    }

    tloState.running = true;
    try {
      await controller.sendCommand('G90');
      await controller.sendCommand(`G53 G0 Z${settings.safeZ}`);
      await controller.sendCommand(`G53 G0 X${settings.toolSetterX} Y${settings.toolSetterY}`);
      await controller.sendCommand(`G53 G0 Z${settings.approachZ}`);
      await controller.sendCommand('G91');
      await controller.sendCommand(
        `G38.2 Z-${settings.seekDistance} F${settings.seekRate}`,
        { tloProbe: true }
      );
      await controller.sendCommand(`G1 Z${settings.retract}`);
      await controller.sendCommand(
        `G38.2 Z-${settings.fineDistance} F${settings.fineRate}`,
        { tloProbe: true }
      );
      await controller.sendCommand('G90');

      const newToolMposZ = parseMPosZ(controller);
      if (newToolMposZ == null) {
        throw new Error('Unable to read MPos.Z after probe');
      }

      if (tloState.previousToolMposZ == null) {
        throw new Error('TLO baseline not set');
      }

      const delta = newToolMposZ - tloState.previousToolMposZ;

      await controller.sendCommand('G49');
      await controller.sendCommand(`G43.1 Z${delta}`);
      await controller.sendCommand(`G53 G0 Z${settings.safeZ}`);

      tloState.previousToolMposZ = newToolMposZ;
      tloState.dirty = false;
      publishState();
      return { success: true, delta, newToolMposZ };
    } finally {
      tloState.running = false;
    }
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
    markDirty,
    runTLO,
    readSetting
  };

  currentTLOEngine = api;
  return api;
}

export function getTLOEngine() {
  return currentTLOEngine;
}
