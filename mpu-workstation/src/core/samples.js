/* Ready-to-run academic programs. */

/* ========================== 4. SAMPLE PROGRAMS ============================ */

export const SAMPLES = {
  "8085": [
    {
      id: "bubble",
      name: "8-bit array bubble sort",
      code: `; ---------------------------------------------------------------
; Ascending bubble sort of an 8-bit array
; 3000H holds the element count, elements follow from 3001H
; ---------------------------------------------------------------
        ORG 2000H
START:  LXI  H, 3000H      ; point at the count byte
        MOV  C, M          ; C = number of elements
        DCR  C             ; C = number of passes
OUTER:  MOV  D, C          ; D = comparisons left in this pass
        LXI  H, 3001H      ; rewind to the first element
INNER:  MOV  A, M          ; A = a[i]
        INX  H
        CMP  M             ; compare with a[i+1]
        JC   NOSWAP        ; already ordered
        JZ   NOSWAP        ; equal, leave it alone
        MOV  B, M          ; swap the pair
        MOV  M, A
        DCX  H
        MOV  M, B
        INX  H
NOSWAP: DCR  D
        JNZ  INNER
        DCR  C
        JNZ  OUTER
        HLT

        ORG 3000H
        DB  06H
        DB  38H, 12H, 9AH, 04H, 77H, 21H`,
    },
    {
      id: "fib",
      name: "Fibonacci series generator",
      code: `; ---------------------------------------------------------------
; Writes the first 10 Fibonacci terms to 3050H onwards
; ---------------------------------------------------------------
        ORG 2000H
        LXI  H, 3050H
        MVI  B, 00H        ; term n-2
        MVI  C, 01H        ; term n-1
        MVI  D, 0AH        ; 10 terms
        MOV  M, B
        INX  H
        MOV  M, C
        INX  H
        DCR  D
        DCR  D
LOOP:   MOV  A, B
        ADD  C             ; next term
        MOV  M, A
        INX  H
        MOV  B, C
        MOV  C, A
        DCR  D
        JNZ  LOOP
        HLT`,
    },
    {
      id: "seg",
      name: "7-segment counter (port 01H)",
      code: `; ---------------------------------------------------------------
; Reads the DIP switches on port 00H, then counts 0..F on the
; 7-segment display wired to output port 01H
; ---------------------------------------------------------------
        ORG 2000H
        IN   00H           ; sample the DIP switch bank
        MOV  B, A          ; keep the switch value in B
        MVI  A, 00H
LOOP:   OUT  01H           ; drive the display
        MVI  C, 08H        ; short software delay
DELAY:  DCR  C
        JNZ  DELAY
        INR  A
        CPI  10H
        JNZ  LOOP
        MOV  A, B          ; finish by showing the switch value
        OUT  01H
        HLT`,
    },
  ],
  "8086": [
    {
      id: "revstr",
      name: "String character reversal",
      code: `; ---------------------------------------------------------------
; Reverses an 8-character string from 2000H into 2010H
; ---------------------------------------------------------------
        ORG 100H
        MOV  SI, 2000H     ; source start
        MOV  DI, 2010H     ; destination start
        MOV  CX, 0008H     ; length
        ADD  SI, 0007H     ; walk the source backwards
REV:    MOV  AL, [SI]
        MOV  [DI], AL
        DEC  SI
        INC  DI
        LOOP REV
        INT  20H

        ORG 2000H
        DB  'MICROPRO'`,
    },
    {
      id: "block",
      name: "16-bit block memory transfer",
      code: `; ---------------------------------------------------------------
; Moves a block of eight 16-bit words from 3000H to 4000H
; ---------------------------------------------------------------
        ORG 100H
        MOV  AX, 0000H
        MOV  DS, AX        ; flat data segment
        MOV  SI, 3000H     ; source pointer
        MOV  DI, 4000H     ; destination pointer
        MOV  CX, 0008H     ; word count
XFER:   MOV  AX, [SI]
        MOV  [DI], AX
        ADD  SI, 0002H
        ADD  DI, 0002H
        LOOP XFER
        INT  20H

        ORG 3000H
        DW  1111H, 2222H, 3333H, 4444H
        DW  5555H, 6666H, 7777H, 8888H`,
    },
    {
      id: "intr",
      name: "Interrupt handling and port I/O",
      code: `; ---------------------------------------------------------------
; Installs a vector for INT 08H, raises it, then echoes the DIP
; switches to the 7-segment display
; ---------------------------------------------------------------
        ORG 100H
        MOV  AX, 0000H
        MOV  DS, AX
        MOV  AX, 0200H     ; handler offset
        MOV  [0020H], AX   ; vector 08H offset  (08H * 4 = 20H)
        MOV  AX, 0000H
        MOV  [0022H], AX   ; vector 08H segment
        MOV  BX, 1234H
        INT  08H           ; raise the software interrupt
        IN   AL, 00H       ; read the DIP switch bank
        OUT  01H, AL       ; echo it to the display
        CMP  AL, 00H
        JNE  DONE
        MOV  CX, 0001H
DONE:   INT  20H

; --- interrupt service routine -------------------------------
        ORG 200H
ISR:    INC  BX
        MOV  DX, 00AAH
        IRET`,
    },
  ],
};

