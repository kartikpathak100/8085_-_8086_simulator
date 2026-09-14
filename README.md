# MPU Workstation — 8085 / 8086

![MIT License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
![React 18](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)
![Vite 5](https://img.shields.io/badge/Vite-5-646cff?style=flat-square&logo=vite)
![PWA](https://img.shields.io/badge/PWA-offline--ready-5a0fc8?style=flat-square&logo=pwa)
![Docker](https://img.shields.io/badge/Docker-ready-0db7ed?style=flat-square&logo=docker)

An interactive microprocessor workstation you run in a browser. Write assembly, assemble it,
step through it one instruction at a time — forwards **and** backwards — and open the registers,
memory and hardware panels whenever you want to see what changed.

Everything runs locally. No account, no network calls, no telemetry. Once loaded it also works
offline, and it can sit on your desktop like a normal app.

---

## Run it

The first run downloads a base image or npm packages and takes a couple of minutes. After that
it starts in about a second.

### 1. One command (recommended)

```bash
./start.sh          # macOS, Linux, WSL, Git Bash   (chmod +x start.sh if needed)
```
```bat
start.bat           :: Windows — double-clicking works too
```

The script uses Docker if it is installed and running, and quietly falls back to a local Node
build if it is not. Either way it opens <http://localhost:8085>.

### 2. Docker directly

```bash
docker compose up -d --build     # then open http://localhost:8085
docker compose down              # stop it
```

Or without compose:

```bash
docker build -t mpu-workstation:1.0.0 .
docker run -d --name mpu-workstation -p 8085:80 mpu-workstation:1.0.0
```

Change the port with `PORT=9000 ./start.sh`, or edit the `ports:` line in `docker-compose.yml`.

### 3. No Docker — Node 18 or newer

```bash
npm install
npm run dev          # live-reloading dev server on http://localhost:5173
npm run build        # static bundle in dist/
npm run preview      # serve that bundle on http://localhost:4173
npm test             # run the processor engine against the built-in programs
```

`dist/` is completely static with relative paths, so it also works from a subfolder, a USB
stick, GitHub Pages or any plain file server.

---

## Put it on your desktop

Two ways, pick either.

**Install it as an app.** Open the workstation in Chrome or Edge and use the install icon in the
address bar — or choose **View ▸ Add to desktop** inside the app. Safari on macOS offers
**Add to Dock** in the Share menu. Installed this way it gets its own window, its own icon, and
keeps working when you are offline.

**Or make a plain shortcut.**

```bash
./scripts/make-shortcut.sh                    # macOS: an app in ~/Applications + a Desktop link
                                              # Linux: a .desktop entry in your menu and Desktop
./scripts/make-shortcut.sh http://host:9000   # point it somewhere else
```
```bat
scripts\make-shortcut.bat                     :: Windows: "MPU Workstation.lnk" on your Desktop
```

The shortcut launches Chrome or Edge in app mode so there is no browser chrome around it, and
falls back to your default browser if neither is installed. On some Linux desktops you may need
to right-click the new Desktop icon once and choose *Allow launching*.

---

## Using it

The editor fills the window. Everything else is a panel you switch on when you need it, and off
when you don't — the **Registers**, **Memory** and **Devices** buttons on the right of the
toolbar open them in a dock down the right-hand side, and the **View** menu adds the machine
code, bus signals, stack and assembler messages. Each panel has its own tab with a close button,
and when nothing is open the dock disappears so the code has the whole window.

Every divider drags. Double-click one (or focus it and press Enter) to snap it back.

### Controls

- **Assemble** turns your source into machine code and loads it into memory.
- **Run / Pause** executes continuously; the speed dropdown sets how fast.
- **Step** runs one instruction. **Back** undoes one — the last 4,000 states are kept, memory
  writes included, so you can rewind as far as you like.
- **Reset** rebuilds and starts over.
- The folder and disk icons open and save `.asm` files.
- Click any line number to set a breakpoint.

The strip under the editor says in plain English what the next instruction does, and lists what
the last step changed — `A 00 → 38`, `Z 0 → 1`.

### Panels

**Registers** — every register and flag, with the ones that just changed highlighted. For the
8086 there is a segment × 16 + offset calculator and a live view of where each pointer lands.

**Memory** — a memory editor rather than a viewer. Set a start and end address, switch between
the grid and a plain address/value list, hide locations that are still untouched, tint bytes by
whether they were read, written or executed — and click any value to type a new one straight
into memory.

**Devices** — a seven-segment display on output port `01H`, an eight-lamp LED bar on output port
`02H`, a switch bank on input port `00H`, and a log of every `IN` and `OUT` the program ran.

**Machine code**, **Signals**, **Stack**, **Messages** — the disassembly with T-state costs, the
bus waveform analyser, the live stack, and everything the assembler and monitor reported.

### Appearance

The sun/moon button switches between the dark and light themes, and **S / M / L / XL** scales
all the text. Your theme, text size, open panels, panel sizes and your code are remembered in
the browser.

### Keyboard

| Key | Action |
| --- | --- |
| `F5` | Run / pause |
| `F10` | Step forward |
| `F8` | Step backward |
| `Ctrl` / `⌘` + `Enter` | Assemble |
| `Ctrl` / `⌘` + `O` | Open an `.asm` file |
| `Ctrl` / `⌘` + `S` | Save your program |
| `?` | Show the shortcut list |

---

## What the processors support

**8085** — `MOV MVI LXI LDA STA LHLD SHLD LDAX STAX ADD ADC SUB SBB ANA XRA ORA CMP` and their
immediate forms, `INR DCR INX DCX DAD PUSH POP XCHG XTHL SPHL PCHL IN OUT RST EI DI`, all
jump/call/return conditions, the rotate and carry instructions, `DAA`, `NOP`, `HLT`.
Flags: S, Z, AC, P, CY.

**8086** — `MOV ADD ADC SUB SBB CMP AND OR XOR NOT NEG INC DEC XCHG PUSH POP PUSHF POPF IN OUT
INT IRET CALL RET JMP LOOP LOOPE LOOPNE NOP HLT CLC STC CLD STD CBW` plus the full
conditional-jump set. Registers include the AH/AL splits, all four segment registers and the
index/pointer registers; physical addresses resolve as `(segment × 16) + offset`.
Flags: O, D, I, T, S, Z, A, P, C.

Directives: `ORG`, `DB`, `DW`, `EQU`. Numbers accept `2000H`, `0x2000`, `1010B`, `65`, `'A'`,
and simple `LABEL+4` arithmetic.

Software interrupts read the real vector table at `4n`. If no vector is installed, an on-board
monitor services the call and returns; `INT 20H` ends the program.

### Built-in programs

8085: bubble sort, Fibonacci series, seven-segment counter.
8086: string reversal, 16-bit block transfer, interrupt handling.

---

## Project layout

```
public/            manifest, icons and the offline service worker
scripts/
  verify.mjs       engine self-check (npm test)
  make-shortcut.*  desktop shortcut creators
src/
  core/            no React in here — the engine is plain, testable JavaScript
    utils.js       number formatting, literal parsing, line lexing
    isa8085.js     8085 encodings + per-statement assembler
    isa8086.js     8086 encodings, ModRM builder + per-statement assembler
    assembler.js   two-pass assembler shared by both
    machine.js     bus model, both execution engines, reversible stepping
    explain.js     turns instructions into plain English
    samples.js     the built-in programs
  ui/              presentation only; every colour comes from a CSS variable,
                   which is how the light and dark themes share one codebase
  useMachine.js    the hook that owns processor state and the run loop
  App.jsx          layout, the panel dock, resizing, keyboard shortcuts
```

The engine never re-decodes its own output — the assembler emits real machine code for the
disassembly and memory views, while execution runs from the decoded statement looked up by
address. Reverse execution stores a small register snapshot plus an undo log of memory writes
per instruction rather than copying the whole address space.

`npm test` assembles and runs every built-in program headlessly, checks the results, then
rewinds one of them to prove reverse execution restores registers, clock and memory exactly.

---

## Troubleshooting

**Port 8085 is already in use** — `PORT=9000 ./start.sh`, or change `ports:` in
`docker-compose.yml` to `"9000:80"`.

**`docker: permission denied`** on Linux — either use `sudo ./start.sh` or add yourself to the
docker group: `sudo usermod -aG docker $USER`, then log out and back in.

**Apple Silicon / ARM** — the base images are multi-architecture, so `docker build` works
unchanged. To build for a different machine use
`docker buildx build --platform linux/amd64,linux/arm64 -t mpu-workstation:1.0.0 .`.

**Nothing happens when I press Run** — check the editor's header. If it says "problems to fix",
the Messages panel opens automatically with the line the assembler objected to.

**The install option never appears** — browsers only offer it over `http://localhost` or HTTPS.
Use the shortcut scripts instead if you are serving it from another machine over plain HTTP.

**I want a sample back** — pick it again from the dropdown. Your edits live in the browser's
local storage; clearing site data resets everything.

---

MIT licensed. Built with React, Vite and Tailwind CSS; served by nginx.
