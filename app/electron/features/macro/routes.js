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

import { Router } from 'express';
import {
  readMacros,
  getMacro,
  createMacro,
  updateMacro,
  deleteMacro,
  isValidMacroId,
  normalizeMacroId
} from './m98-storage.js';
import { createLogger } from '../../core/logger.js';

const { log, error: logError } = createLogger('Macro');

export function createMacroRoutes(cncController, commandProcessor) {
  const router = Router();
  const bases = ['/macros', '/m98-macros'];

  const handleList = (req, res) => {
    try {
      const macros = readMacros();
      res.json(macros);
    } catch (error) {
      log('Error reading macros:', error);
      res.status(500).json({ error: 'Failed to read macros' });
    }
  };

  const handleGet = (req, res) => {
    try {
      const macroId = normalizeMacroId(req.params.id);
      if (!macroId || !isValidMacroId(macroId)) {
        return res.status(400).json({ error: 'Macro ID must be between 9001 and 9999' });
      }

      const macro = getMacro(macroId);
      if (!macro) {
        return res.status(404).json({ error: 'Macro not found' });
      }
      res.json(macro);
    } catch (error) {
      log('Error reading macro:', error);
      res.status(500).json({ error: 'Failed to read macro' });
    }
  };

  const handleCreate = (req, res) => {
    try {
      const { name, description, commands } = req.body;

      if (!name || !commands) {
        return res.status(400).json({ error: 'Name and commands are required' });
      }

      const newMacro = createMacro({ name, description, commands });
      res.status(201).json(newMacro);
    } catch (error) {
      log('Error creating macro:', error);
      res.status(500).json({ error: 'Failed to create macro' });
    }
  };

  const handleUpdate = (req, res) => {
    try {
      const { name, description, commands } = req.body;
      const updates = {};

      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (commands !== undefined) updates.commands = commands;

      const macroId = normalizeMacroId(req.params.id);
      if (!macroId || !isValidMacroId(macroId)) {
        return res.status(400).json({ error: 'Macro ID must be between 9001 and 9999' });
      }

      const updatedMacro = updateMacro(macroId, updates);
      res.json(updatedMacro);
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      log('Error updating macro:', error);
      res.status(500).json({ error: 'Failed to update macro' });
    }
  };

  const handleDelete = (req, res) => {
    try {
      const macroId = normalizeMacroId(req.params.id);
      if (!macroId || !isValidMacroId(macroId)) {
        return res.status(400).json({ error: 'Macro ID must be between 9001 and 9999' });
      }

      const result = deleteMacro(macroId);
      res.json(result);
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      log('Error deleting macro:', error);
      res.status(500).json({ error: 'Failed to delete macro' });
    }
  };

  const handleExecute = async (req, res) => {
    try {
      if (!cncController || !cncController.isConnected) {
        return res.status(503).json({ error: 'CNC controller is not connected' });
      }

      const macroId = normalizeMacroId(req.params.id);
      if (!macroId || !isValidMacroId(macroId)) {
        return res.status(400).json({ error: 'Macro ID must be between 9001 and 9999' });
      }

      const macro = getMacro(macroId);
      if (!macro) {
        return res.status(404).json({ error: 'Macro not found' });
      }

      const m98Command = `M98 P${macroId}`;
      log(`Executing macro via M98: ${m98Command} (${macro.name})`);

      const pluginContext = {
        sourceId: 'macro',
        commandId: `macro-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        meta: { sourceId: 'macro', macroId: macroId, macroName: macro.name },
        machineState: cncController.lastStatus
      };

      const result = await commandProcessor.instance.process(m98Command, pluginContext);
      if (!result.shouldContinue) {
        return res.status(400).json({ error: 'Failed to execute macro', message: result.result?.message || 'Execution failed' });
      }

      for (const cmd of result.commands) {
        const cmdDisplayCommand = cmd.displayCommand || cmd.command;
        const cmdMeta = {
          sourceId: 'macro',
          macroId: macroId,
          macroName: macro.name,
          ...(cmd.meta || {})
        };

        const uniqueCommandId = cmd.commandId || `${pluginContext.commandId}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

        await cncController.sendCommand(cmd.command, {
          commandId: uniqueCommandId,
          displayCommand: cmdDisplayCommand,
          meta: Object.keys(cmdMeta).length > 0 ? cmdMeta : null
        });
      }

      res.json({
        success: true,
        message: `Macro "${macro.name}" executed via ${m98Command}`
      });
    } catch (error) {
      log('Error executing macro:', error);
      res.status(500).json({ error: 'Failed to execute macro', message: error.message });
    }
  };

  bases.forEach((base) => {
    router.get(base, handleList);
    router.get(`${base}/:id`, handleGet);
    router.post(base, handleCreate);
    router.put(`${base}/:id`, handleUpdate);
    router.delete(`${base}/:id`, handleDelete);
    router.post(`${base}/:id/execute`, handleExecute);
  });

  return router;
}
