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

import { api } from '../../lib/api.js';
import type { ProbeType, ProbingAxis, ProbeCorner, ProbeSide } from './visualizers/types';

export interface ProbeOptions {
  probeType: ProbeType;
  probingAxis: ProbingAxis;
  selectedCorner?: ProbeCorner | null;
  selectedSide?: ProbeSide | null;
  probeBallPointDiameter: number;
  probeZPlunge: number;
  probeZOffset: number;
  probeRapidMovement: number;
  probeXDimension?: number;
  probeYDimension?: number;
  probeZFirst?: boolean;
  selectedBitDiameter?: string;
  zThickness?: number;
  xyThickness?: number;
  zProbeDistance?: number;
  standardBlockBitDiameter?: string;
}

/**
 * Start a probing operation
 */
export async function startProbe(options: ProbeOptions) {
  const payload = {
    probeType: options.probeType,
    probingAxis: options.probingAxis,
    selectedCorner: options.selectedCorner ?? undefined,
    selectedSide: options.selectedSide ?? undefined,
    toolDiameter: options.probeBallPointDiameter,
    zPlunge: options.probeZPlunge,
    zOffset: options.probeZOffset,
    rapidMovement: options.probeRapidMovement,
    xDimension: options.probeXDimension,
    yDimension: options.probeYDimension,
    probeZFirst: options.probeZFirst,
    selectedBitDiameter: options.selectedBitDiameter,
    zThickness: options.zThickness,
    xyThickness: options.xyThickness,
    zProbeDistance: options.zProbeDistance,
    standardBlockBitDiameter: options.standardBlockBitDiameter
  };

  const response = await fetch(`${api.baseUrl}/api/probe/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to start probing operation');
  }

  return response.json();
}

/**
 * Stop/abort probing operation
 */
export async function stopProbe() {
  const response = await fetch(`${api.baseUrl}/api/probe/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to stop probing operation');
  }

  return response.json();
}

// Re-export the main API singleton for convenience
export { api };
