# AUDIT TLO/TLS Button (FluidNC path)

Date: 2026-02-25

## 1) Ubicacion del boton TLO/TLS en frontend y accion disparada

- Main button (tool legend, long-press):
  - `app/client/src/features/toolpath/GCodeVisualizer.vue:225`
  - Render condicional: `v-if="showTlsTool"`
  - Estado disabled actual: `isToolActionsDisabled || currentTool === 0` en `:class` y handlers (`:229`, `:235-:240`)
  - Trigger por long-press:
    - `startToolPress()` detecta `toolNumber === 'tls'` y llama `sendTLSCommand()` (`:3181-:3184`)
    - `sendTLSCommand()` llama `api.triggerTLS()` (`:3256-:3259`)

- Trigger secundario desde warning dialog:
  - `app/client/src/features/toolpath/GCodeVisualizer.vue:2397` (`handleTlsFromWarning`)
  - `app/client/src/features/status/StatusPanel.vue:597` (`handleTlsFromWarning`)

- API client command:
  - `app/client/src/lib/api.js:911-:916`
  - Envia websocket command `MFSENDER_TLS` con `meta.sourceId='tls'`

## 2) Manejo backend actual del comando TLS/TLO

- Intercept de comando:
  - `app/electron/core/command-processor.js:135-:136`
  - Si comando es `MFSENDER_TLS`, ejecuta `runToolLengthSetterFluidNC(...)`

- Logica actual TLS:
  - `app/electron/core/command-processor.js:470-:531`
  - Valida:
    - conexion activa
    - `homed === true`
    - settings existentes (`toolSetterX`, `toolSetterY`, `clearanceHeight`, `probeDepth`, `probeFeed`, `offsetZ`)
  - Genera secuencia fija:
    - `G21`
    - `G90`
    - `G53 G0 Z0`
    - `G53 G0 X...`
    - `G53 G0 Y...`
    - `G53 G0 Z{clearanceHeight}`
    - `G38.2 ...` (marcado con `meta.tlsProbe`)
    - `G10 L20 P1 Z{offsetZ}`
    - `G53 G0 Z0`

- Envio real de comandos:
  - HTTP path: `app/electron/features/cnc/routes.js:196-:231`
  - WebSocket path: `app/electron/server/websocket.js:399-:430`
  - Ambos capturan `cmdMeta.tlsProbe === true` y envuelven error como `"TLS probe failed: ..."` (`routes.js:220-:223`, `websocket.js:423-:427`)

## 3) Parsing de status "<...>" y almacenamiento de machine state

- Parser principal status stream:
  - `app/electron/features/cnc/controller.js:369-:520` (`parseStatusReport`)
  - Campos relevantes:
    - `status` (Idle/Run/Alarm/Jog/Home/etc) (`:390-:394`)
    - `MPos` (`:451`)
    - `homed` desde campo `H:` (`:408-:410`)
    - workaround adicional Home->Idle fuerza `homed=true` (`:458-:464`) [comportamiento heredado]
    - `Pn`, `activeProbe`, `tool`, `workspace`, overrides, etc.
  - Emite `status-report` con diff de cambios (`:520`)

- Estado servidor consolidado:
  - `app/electron/server/cnc-events.js:210-:214` copia status report a `serverState.machineState`
  - Broadcast: `server-state-updated` cuando hay cambios (`:261-:270`)

- Computo de sender state global (idle/running/alarm/jogging/homing...):
  - `app/electron/server/context.js:39-:133` (`computeSenderStatus`)
  - Usa `machineState.status`, `machineState.homed`, `jobLoaded.status`, `isToolChanging`, `isProbing`

- Frontend store:
  - `app/client/src/composables/use-app-store.ts`
    - `status.homed` (`:110`)
    - `isHomed` computed (`:210`)
    - aplica `report.MPos` a `status.machineCoords` (`:248-:255`)
    - aplica `report.homed` (`:311-:313`)
    - aplica `report.toolLengthSet` (`:281-:283`)

## 4) Donde se manda $G y donde se parsea [GC:...]

- Envio `$G`:
  - `app/electron/features/cnc/controller.js:118-:122`
  - Se manda tras recibir primer status en conexion verificada (`handleIncomingData`)

- Parsing `[GC:...]`:
  - `app/electron/features/cnc/controller.js:159-:163` detecta frame `[GC:...]`
  - `parseGCodeModes(data)` en `:524-:545`
  - Actualmente solo extrae `Tn` (tool activo)
  - No persiste tokens modales completos y no detecta `G43.1` hoy

## 5) Gating actual del boton (para contraste)

- `isToolActionsDisabled` en `GCodeVisualizer.vue:638`:
  - `isToolChanging || isJobRunning || isConnecting || isAlarm || isHoming || homingCycle===0 || !isHomed`
- TLS button agrega condicion `currentTool === 0` (`:229`, `:235-:240`)
- No hay gating actual por:
  - presencia de `G43.1` en `$G`
  - baseline interno previo

## 6) Persistencia/settings existentes relacionadas a TLS

- Defaults actuales:
  - `app/electron/core/settings-manager.js:102-:107`
  - `toolSetterX`, `toolSetterY`, `clearanceHeight`, `probeDepth`, `probeFeed`, `offsetZ`

- UI Settings principal:
  - `app/client/src/App.vue` (modal Settings)
  - Tab Tools renderiza `ToolsTab` (`:410-:425`)
  - Toggles de visibilidad TLS/Manual/Probe via props/events y watchers:
    - `App.vue:1380-:1382`, `:2412-:2436`, `:2453-:2465`

## 7) Eventos y flujo extremo a extremo del boton actual

1. Usuario mantiene presionado boton TLS en `GCodeVisualizer`.
2. `sendTLSCommand()` llama `api.triggerTLS()`.
3. `api.triggerTLS()` envia websocket `cnc:command` con `MFSENDER_TLS`.
4. Backend WebSocket (`server/websocket.js`) pasa comando a `CommandProcessor.process(...)`.
5. `CommandProcessor` transforma a array de G-code TLS.
6. WebSocket envia cada comando via `cncController.sendCommand(...)`.
7. `cncController` parsea respuestas/status y `cnc-events` difunde `server-state-updated` + `cnc-data`.

## 8) Hallazgos clave para implementacion solicitada

- Existe boton y trigger reutilizable (no hace falta crear UI nueva de accion).
- Existe pipeline de comando custom (`MFSENDER_TLS`) apto para redirigir a nuevo motor TLO.
- `$G` ya se solicita al conectar, pero parse actual no detecta `G43.1`; debe ampliarse.
- `isHomed` ya existe en backend y frontend, pero incluye un fallback Home->Idle heredado que no viene de status `H:` directamente.
- No existe estado baseline interno para delta tool-to-tool; debe agregarse en backend (engine).
