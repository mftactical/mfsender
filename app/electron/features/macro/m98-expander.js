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

import { parseM98Command } from '../../utils/gcode-patterns.js';
import { getMacro } from './m98-storage.js';

export class M98Expander {
  expand(command) {
    const parsed = parseM98Command(command);
    if (!parsed?.matched) {
      return null;
    }

    if (!parsed.macroId) {
      const error = new Error('M98 command requires P####');
      error.code = 'M98_MISSING_ID';
      throw error;
    }

    const macro = getMacro(parsed.macroId);
    if (!macro) {
      const error = new Error(`Macro ${parsed.macroId} not found`);
      error.code = 'M98_NOT_FOUND';
      throw error;
    }

    const commands = String(macro.commands || '')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '');

    return {
      macro,
      commands
    };
  }
}
