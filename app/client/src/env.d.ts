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

interface mfsenderAPI {
  theme: {
    shouldUseDark: () => boolean;
  };
  getApiBaseUrl?: (portOverride?: number) => string;
}

declare global {
  interface Window {
    mfsender?: mfsenderAPI;
  }
}

interface UpdateAvailablePayload {
  version: string | null;
  releaseName?: string | null;
  releaseDate?: string | null;
  releaseNotes?: string | null;
  channel?: string;
  canInstall?: boolean;
  currentVersion?: string;
  downloadPath?: string;
}

interface UpdateProgressPayload {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond?: number;
  channel?: string;
}

interface mfsenderUpdatesAPI {
  checkForUpdates: () => Promise<any>;
  downloadUpdate: (options?: { install?: boolean }) => Promise<any>;
  installUpdate: () => Promise<any>;
  onChecking: (callback: (payload: any) => void) => () => void;
  onAvailable: (callback: (payload: UpdateAvailablePayload) => void) => () => void;
  onNotAvailable: (callback: (payload: any) => void) => () => void;
  onError: (callback: (payload: { message: string; channel?: string }) => void) => () => void;
  onDownloadStarted: (callback: (payload: any) => void) => () => void;
  onDownloadProgress: (callback: (payload: UpdateProgressPayload) => void) => () => void;
  onDownloaded: (callback: (payload: UpdateAvailablePayload & { downloadedAt?: string }) => void) => () => void;
}

interface mfsenderAPI {
  theme: {
    shouldUseDark: () => boolean;
  };
  updates?: mfsenderUpdatesAPI;
}

export {};
