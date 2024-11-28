/*
REG = A..B
HEAP = C..D
STACK1 = E
STACK2 = F

HEAPPOINTER = REG[0], REG[1]
HEAPTARGET = REG[2], REG[3]

INSTRUCTIONPOINTER = REG[4], REG[5]
INSTRUCTION = REG[6], .., REG[8], REG[9]

UNUSED = REG[7], REG[15]

ACC_A = REG[10], REG[11]
ACC_B = REG[12], REG[13]

HALTLOOP = REG[14],...

TEMPA = REG[16],REG[17]
TEMPB = REG[18],REG[19]

; REG should ALWAYS return to 0 after an action performed on it

NOP:
Do nothing

HALT:
Stop execution

SETA:
Set Register A to the argument

SETB:
Set Register B to the argument

CPYAB:
Copy the value of Register A to Register B

CPYBA:
Copy the value of Register B to Register A

PTRA:
Derefence the value of Register A and set it to the value stored at the address

PTRB:
Deference the value of Register B and set it to the value stored at the address

PUTBPTRA:
Load the value of Register B into the address stored in Register A

PUTAPTRB:
Load the value of Register A into the address stored in Register B

JMP:
Jump to the argument

JMPA:
Jump to the address stored in Register A

JMPB:
Jump to the address stored in Register B

JNZA:
If Register A is not zero, jump to the argument

JNZB:
If Register B is not zero, jump to the argument

JBNZA:
If Register A is not zero, jump to the address stored in Register B

JANZB:
If Register B is not zero, jump to the address stored in Register A

CALL:
Jump to the argument whilst pushing the current instruction pointer onto the Y stack

CALLA:
Jump to the address stored in Register A whilst pushing the current instruction pointer onto the Y stack

CALLB:
Jump to the address stored in Register B whilst pushing the current instruction pointer onto the Y stack

RET:
Pop the top of the Y stack and jump to it

INCA:
Increment Register A by 1

INCB:
Increment Register B by 1

DECA:
Decrement Register A by 1

DECB:
Decrement Register B by 1

ADDA:
Add the argument to Register A

ADDB:
Add the argument to Register B

ADDAB:
Add the value of Register A to Register B into Register B. Sets Register A to 0

ADDBA:
Add the value of Register B to Register A into Register A. Sets Register B to 0

SUBA:
Subtract the argument from Register A

SUBB:
Subtract the argument from Register B

SUBAB:
Subtract the value of Register A from Register B into Register B. Sets Register A to 0
B=B-A
A=0

SUBBA:
Subtract the value of Register B from Register A into Register A. Sets Register B to 0
A=A-B
B=0

MULAB:
Multiply the value of Register A by Register B into Regsiter B. Sets Register A to 0

MULBA:
Multiply the value of Register B by Register A into Register A. Sets Register B to 0

DIVAB:
Divide the value of Register A by Register B. Sets the remainder to Register B and the quotient to Register A

DIVBA:
Divide the value of Register B by Register A. Sets the remainder to Register A and the quotient to Register B

READA:
Read a value from the input stream and store it in Register A

READB:
Read a value from the input stream and store it in Register B

WRITEA:
Write the value of Register A to the output stream

WRITEB:
Write the value of Register B to the output stream

CMP:
Decrement both Registers untill either is Zero.
  A>B: Set Register A to non-zero, Register B to 0
  A<B: Set Register A to 0, Register B to non-zero
  A=B: Set both Registers to 0

XPUSH:
Push the argument onto the X stack

YPUSH:
Push the argument onto the Y stack

XPUSHA:
Push the value of Register A onto the X stack

XPUSHB:
Push the value of Register B onto the X stack

YPUSHA:
Push the value of Register A onto the Y stack

YPUSHB:
Push the value of Register B onto the Y stack

XPOP:
Pop the top of the X stack

YPOP:
Pop the top of the Y stack

XPOPA:
Pop the top of the X stack and store it in Register A

XPOPB:
Pop the top of the X stack and store it in Register B

YPOPA:
Pop the top of the Y stack and store it in Register A

YPOPB:
Pop the top of the Y stack and store it in Register B


*/

var acceptsArgument = {
  SETA: true,
  SETB: true,
  JMP: true,
  JNZA: true,
  JNZB: true,
  CALL: true,
  ADDA: true,
  ADDB: true,
  SUBA: true,
  SUBB: true,
  XPUSH: true,
  YPUSH: true
};

export let INSTRUCTIONS: [string, string, Function][] = [
  ["NOP", "", (interp: ASMInterpreter, arg: number) => {}],
  [
    "HALT",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.running = false;
    },
  ],
  [
    "SETA",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA = arg;
    },
  ],
  [
    "SETB",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB = arg;
    },
  ],
  [
    "CPYAB",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB = interp.RegA;
    },
  ],
  [
    "CPYBA",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA = interp.RegB;
    },
  ],
  [
    "PTRA",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA = (((interp.Heap[interp.RegA * 4 + 0] ?? 0) << 24)
                  + ((interp.Heap[interp.RegA * 4 + 1] ?? 0) << 16)
                  + ((interp.Heap[interp.RegA * 4 + 2] ?? 0) <<  8)
                  + ((interp.Heap[interp.RegA * 4 + 3] ?? 0) <<  0))>>>0;
    },
  ],
  [
    "PTRB",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB = (((interp.Heap[interp.RegB * 4 + 0] ?? 0) << 24)
                  + ((interp.Heap[interp.RegB * 4 + 1] ?? 0) << 16)
                  + ((interp.Heap[interp.RegB * 4 + 2] ?? 0) <<  8)
                  + ((interp.Heap[interp.RegB * 4 + 3] ?? 0) <<  0))>>>0;
    },
  ],
  [
    "PUTBPTRA",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.Heap[interp.RegA * 4 + 0] = (interp.RegB >>> 24) & 0xff;
      interp.Heap[interp.RegA * 4 + 1] = (interp.RegB >>> 16) & 0xff;
      interp.Heap[interp.RegA * 4 + 2] = (interp.RegB >>> 8) & 0xff;
      interp.Heap[interp.RegA * 4 + 3] = (interp.RegB >>> 0) & 0xff;
    },
  ],
  [
    "PUTAPTRB",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.Heap[interp.RegB * 4 + 0] = (interp.RegA >>> 24) & 0xff;
      interp.Heap[interp.RegB * 4 + 1] = (interp.RegA >>> 16) & 0xff;
      interp.Heap[interp.RegB * 4 + 2] = (interp.RegA >>> 8) & 0xff;
      interp.Heap[interp.RegB * 4 + 3] = (interp.RegA >>> 0) & 0xff;
    },
  ],
  [
    "JMP",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.IP = arg * 4;
    },
  ],
  [
    "JMPA",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.IP = interp.RegA * 4;
    },
  ],
  [
    "JMPB",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.IP = interp.RegB * 4;
    },
  ],
  [
    "JNZA",
    '',
    (interp: ASMInterpreter, arg: number) => {
      if (interp.RegA) interp.IP = arg * 4;
    },
  ],
  [
    "JNZB",
    '',
    (interp: ASMInterpreter, arg: number) => {
      if (interp.RegB) interp.IP = arg * 4;
    },
  ],
  [
    "JBNZA",
    '',
    (interp: ASMInterpreter, arg: number) => {
      if (interp.RegA) interp.IP = interp.RegB * 4;
    },
  ],
  [
    "JANZB",
    '',
    (interp: ASMInterpreter, arg: number) => {
      if (interp.RegB) interp.IP = interp.RegA * 4;
    },
  ],
  [
    "CALL",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.StackY.push(interp.IP);
      interp.StackY.push(interp.RegB);
      interp.StackY.push(interp.RegA);
      interp.IP = arg * 4;
    },
  ],
  [
    "CALLA",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.StackY.push(interp.IP);
      interp.StackY.push(interp.RegB);
      interp.StackY.push(interp.RegA);
      interp.IP = interp.RegA * 4;
    },
  ],
  [
    "CALLB",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.StackY.push(interp.IP);
      interp.StackY.push(interp.RegB);
      interp.StackY.push(interp.RegA);
      interp.IP = interp.RegB * 4;
    },
  ],
  [
    "RET",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA = interp.StackY.pop() ?? 0;
      interp.RegB = interp.StackY.pop() ?? 0;
      interp.IP = interp.StackY.pop() ?? 0;
    },
  ],
  [
    "INCA",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA++;
      if (interp.RegA > 0xffffffff) interp.RegA = 0;
    },
  ],
  [
    "INCB",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB++;
      if (interp.RegB > 0xffffffff) interp.RegB = 0;
    },
  ],
  [
    "DECA",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA--;
      if (interp.RegA < 0) interp.RegA = 0xffffffff;
    },
  ],
  [
    "DECB",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB--;
      if (interp.RegB < 0) interp.RegB = 0xffffffff;
    },
  ],
  [
    "ADDA",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA += arg;
      interp.RegA &= 0xffffffff;
      interp.RegA >>>= 0;
    },
  ],
  [
    "ADDB",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB += arg;
      interp.RegB &= 0xffffffff;
      interp.RegB >>>= 0;
    },
  ],
  [
    "ADDAB",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB += interp.RegA;
      interp.RegB &= 0xffffffff;
      interp.RegB >>>= 0;
      interp.RegA = 0;
    },
  ],
  [
    "ADDBA",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA += interp.RegB;
      interp.RegA &= 0xffffffff;
      interp.RegA >>>= 0;
      interp.RegB = 0;
    },
  ],
  [
    "SUBA",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA -= arg;
      interp.RegA &= 0xffffffff;
      interp.RegA >>>= 0;
    },
  ],
  [
    "SUBB",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB -= arg;
      interp.RegB &= 0xffffffff;
      interp.RegB >>>= 0;
    },
  ],
  [
    "SUBAB",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB -= interp.RegA;
      interp.RegB &= 0xffffffff;
      interp.RegB >>>= 0;
      interp.RegA = 0;
    },
  ],
  [
    "SUBBA",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA -= interp.RegB;
      interp.RegA &= 0xffffffff;
      interp.RegA >>>= 0;
      interp.RegB = 0;
    },
  ],
  [
    "MULAB",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB *= interp.RegA;
      interp.RegB &= 0xffffffff;
      interp.RegB >>>= 0;
      interp.RegA = 0;
    },
  ],
  [
    "MULBA",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA *= interp.RegB;
      interp.RegA &= 0xffffffff;
      interp.RegA >>>= 0;
      interp.RegB = 0;
    },
  ],
  [
    "DIVAB",
    '',
    (interp: ASMInterpreter, arg: number) => {
      if (interp.RegB === 0) {
        interp.RegA = 0;
        interp.RegB = 0;
      } else {
        let quotient = Math.floor(interp.RegA / interp.RegB);
        let remainder = interp.RegA % interp.RegB;
        interp.RegB = remainder;
        interp.RegA = quotient;
      }
    },
  ],
  [
    "DIVBA",
    '',
    (interp: ASMInterpreter, arg: number) => {
      if (interp.RegA === 0) {
        interp.RegA = 0;
        interp.RegB = 0;
      } else {
        let quotient = Math.floor(interp.RegB / interp.RegA);
        let remainder = interp.RegB % interp.RegA;
        interp.RegA = remainder;
        interp.RegB = quotient;
      }
    },
  ],
  [
    "NOTA",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA = interp.RegA ? 0 : 1;
    },
  ],
  [
    "NOTB",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB = interp.RegB ? 0 : 1;
    },
  ],
  [
    "READA",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA = interp.Input.charCodeAt(interp.InputPointer++);
      if (interp.InputPointer > interp.Input.length) interp.RegA = 0xffffffff>>>0;
    },
  ],
  [
    "READB",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB = interp.Input.charCodeAt(interp.InputPointer++);
      if (interp.InputPointer > interp.Input.length) interp.RegB = 0xffffffff>>>0;
    },
  ],
  [
    "WRITEA",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.Output += String.fromCharCode(interp.RegA);
    },
  ],
  [
    "WRITEB",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.Output += String.fromCharCode(interp.RegB);
    },
  ],
  [
    "CMP",
    '',
    (interp: ASMInterpreter, arg: number) => {
      if (interp.RegA > interp.RegB) {
        interp.RegA -= interp.RegB;
        interp.RegB = 0;
      } else if (interp.RegA < interp.RegB) {
        interp.RegB -= interp.RegA;
        interp.RegA = 0;
      } else {
        interp.RegA = 0;
        interp.RegB = 0;
      }
    },
  ],
  [
    "XPUSH",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.StackX.push(arg);
    },
  ],
  [
    "YPUSH",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.StackY.push(arg);
    },
  ],
  [
    "XPUSHA",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.StackX.push(interp.RegA);
    },
  ],
  [
    "XPUSHB",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.StackX.push(interp.RegB);
    },
  ],
  [
    "YPUSHA",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.StackY.push(interp.RegA);
    },
  ],
  [
    "YPUSHB",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.StackY.push(interp.RegB);
    },
  ],
  [
    "XPOP",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.StackX.pop();
    },
  ],
  [
    "YPOP",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.StackY.pop();
    },
  ],
  [
    "XPOPA",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA = interp.StackX.pop() ?? 0;
    },
  ],
  [
    "XPOPB",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB = interp.StackX.pop() ?? 0;
    },
  ],
  [
    "YPOPA",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA = interp.StackY.pop() ?? 0;
    },
  ],
  [
    "YPOPB",
    '',
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB = interp.StackY.pop() ?? 0;
    },
  ],
];

function hexPad(value: number, amount: number = 2) {
  return ("0".repeat(amount) + value.toString(16).toUpperCase()).slice(-amount);
}

export class ASMInterpreter {
  Code: string;
  Heap: number[] = [];
  IP: number = 0;
  RegA: number = 0;
  RegB: number = 0;
  StackX: number[] = [];
  StackY: number[] = [];
  running: boolean = true;
  Input: string = "";
  InputPointer: number = 0;
  Output: string = "";
  Labels: { [label: string]: number } = {};
  ASMMap: number[] = [];
  CodeLines: string[] = [];

  constructor(code: string | string[]) {
    if (typeof code === "string") {
      this.Code = code as string
      code = code.split("\n");
    }else{
      this.Code = code.join("\n");
    }
    let t = Date.now();
    let heap: number[] = [];
    let labels: any = {};
    let waitingLabels: any = {};
    let commandTimes: number[] = [];
    let ptr = 0;

    for (let i = 0; i < code.length; i++) {
      if (code[i].match(/^\s*LINE/i)) continue;
      if (code[i].match(/^\s*FILE/i)) continue;
      let codel: RegExpMatchArray|null = code[i].match(
        /^\s*?(?:\n|$)|^\s*(?:([a-z_]\w*):)?\s*(?:(?:db\s*((?:(?:\d+|[a-z_]\w*),?\s*)*))|(?:(REM|NOP|HALT|SETA|SETB|CPYAB|CPYBA|PTRA|PTRB|PUTBPTRA|PUTAPTRB|JMP|JMPA|JMPB|JNZA|JNZB|JBNZA|JANZB|CALL|CALLA|CALLB|RET|INCA|INCB|DECA|DECB|ADDA|ADDB|ADDAB|ADDBA|SUBA|SUBB|SUBAB|SUBBA|MULAB|MULBA|DIVAB|DIVBA|NOTA|NOTB|READA|READB|WRITEA|WRITEB|CMP|XPUSH|XPUSHA|XPUSHB|YPUSH|YPUSHA|YPUSHB|XPOP|YPOP|XPOPA|XPOPB|YPOPA|YPOPB)(?:\s+(?:(\d+)|([a-z_]\w*)))?))?\s*$/im
      );
      if (!codel) {
        console.log(`No match: ${code[i]}`);
        continue;
      }
      let label = codel[1] ?? "";
      let dbArgs = codel[2] ?? "";
      let command: string = codel[3] ?? "";
      let argNumber = codel[4] ?? "";
      let argLabel = codel[5] ?? "";
      if(label) while(ptr%4) heap[ptr++] = 0;
      this.ASMMap[ptr] = i;

      let commandT = Date.now();

      if (label) {
        let l = ptr;
        labels[label] = l / 4;
        if (waitingLabels[label]) {
          waitingLabels[label].forEach((i: number) => {
            heap[i] = (((l / 4) & 0xffffffff) >>> 24) & 0xff;
            heap[i + 1] = (((l / 4) & 0xffffffff) >>> 16) & 0xff;
            heap[i + 2] = (((l / 4) & 0xffffffff) >>> 8) & 0xff;
            heap[i + 3] = (((l / 4) & 0xffffffff) >>> 0) & 0xff;
          });
          delete waitingLabels[label];
        }
      }
      if (dbArgs.length > 0) {
        let argVals = dbArgs.matchAll(/(\d+)|([a-z_]\w*)/gi);
        for (let argVal of argVals) {
          let argNum = argVal[1] ?? "";
          let argLab = argVal[2] ?? "";
          if (argNum.length > 0) {
            let l = +argNum;
            heap[ptr++] = ((l & 0xffffffff) >>> 24) & 0xff;
            heap[ptr++] = ((l & 0xffffffff) >>> 16) & 0xff;
            heap[ptr++] = ((l & 0xffffffff) >>> 8) & 0xff;
            heap[ptr++] = ((l & 0xffffffff) >>> 0) & 0xff;
          } else if (argLab.length > 0) {
            if (labels[argLab] !== undefined) {
              let l = labels[argLab];
              heap[ptr++] = ((l & 0xffffffff) >>> 24) & 0xff;
              heap[ptr++] = ((l & 0xffffffff) >>> 16) & 0xff;
              heap[ptr++] = ((l & 0xffffffff) >>> 8) & 0xff;
              heap[ptr++] = ((l & 0xffffffff) >>> 0) & 0xff;
            } else {
              if (waitingLabels[argLab] === undefined)
                waitingLabels[argLab] = [];
              waitingLabels[argLab].push(ptr);
              ptr+=4;
            }
          }
        }
      } else if (command.length > 0) {
        if(command.toUpperCase() === 'REM') continue;
        let commandIndex = INSTRUCTIONS.findIndex(
          (i) => i[0] === command.toUpperCase()
        );
        if (commandIndex < 0) {
          console.log(`UNKNOWN COMMAND: ${command}`);
        }
        heap[ptr++] = commandIndex;
        if(command.toUpperCase() in acceptsArgument){
          let argV = 0;
          if (argNumber.length > 0) argV = +argNumber;
          else if (argLabel.length > 0) {
            if (argLabel.toUpperCase() === "_IP") labels[argLabel] = ptr / 4;
            if (labels[argLabel] !== undefined) {
              argV = labels[argLabel];
            } else {
              if (waitingLabels[argLabel] === undefined)
                waitingLabels[argLabel] = [];
              waitingLabels[argLabel].push(ptr);
            }
          }
          heap[ptr++] = ((argV & 0xffffffff) >>> 24) & 0xff;
          heap[ptr++] = ((argV & 0xffffffff) >>> 16) & 0xff;
          heap[ptr++] = ((argV & 0xffffffff) >>> 8) & 0xff;
          heap[ptr++] = ((argV & 0xffffffff) >>> 0) & 0xff;
        }
      }
      commandTimes.push(Date.now() - commandT);
    }
    console.log("Command Times: ");
    console.dir(commandTimes);
    console.log(`Total Time: ${Date.now() - t}ms`);
    for (let name in waitingLabels) {
      console.log("MISSING LABEL: " + name);
    }
    this.Heap = heap;
    this.Labels = labels;
    this.CodeLines = this.Code.split("\n");
  }

  CodeWithPointerHighlight(): string {
    var code = this.Code.split(`\n`);
    var currentInstruction = this.ASMMap[this.IP];
    if (currentInstruction)
      code[
        currentInstruction
      ] = `<span class='pointer'>${code[currentInstruction]}</span>`;
    for (let i = 0; i < code.length; i++) {
      var index = this.ASMMap.indexOf(i);
      code[i] = `${hexPad(index, 8)}: ${code[i]}`;
    }
    return code.join(`\n`);
  }

  Step() {
    if (!this.running) return;
    let command = this.Heap[this.IP] ?? 0x01;
    let arg = ((this.Heap[this.IP + 1] << 24)
            + (this.Heap[this.IP + 2] << 16)
            + (this.Heap[this.IP + 3] <<  8)
            + (this.Heap[this.IP + 4] <<  0))>>>0;
    this.IP++;
    var instructionFunction = INSTRUCTIONS[command];
    if (instructionFunction){
      if(instructionFunction[0] in acceptsArgument) this.IP += 4;
      instructionFunction[2](this, arg);
    } else {
      this.running = false;
      throw new Error(`Unknown instruction ${command}`);
    }
  }

  static RenderHeapPlain(Heap: Uint8Array){
    let heap = "           0  1  2  3  4  5  6  7  8  9  A  B  C  D  E  F\n";
    for (let i = 0; i < Heap.length; i += 16) {
      heap += `${hexPad(i, 8)}: `;
      for (let j = 0; j < 16; j++) {
        if (Heap[i + j] !== undefined) {
          heap += `${hexPad(Heap[i + j], 2)}`;
          heap += " ";
        } else heap += `   `;
      }
      heap += `| `;
      for (let j = 0; j < 16; j++) {
        var char: string = " ";
        if (Heap[i + j] !== undefined) {
          let v = Heap[i + j];
          if (v >= 32 && v < 127) {
            char = String.fromCharCode(v);
          } else {
            char = ".";
          }
        }
        heap += char;
      }
      heap += "\n";
    }
    return heap;
  }

  RenderHeap(): string {
    let heap = "           0  1  2  3  4  5  6  7  8  9  A  B  C  D  E  F\n";
    for (let i = 0; i < this.Heap.length; i += 16) {
      heap += `${hexPad(i, 8)}: `;
      for (let j = 0; j < 16; j++) {
        if (this.Heap[i + j] !== undefined) {
          if (this.IP === i + j || (j === 0 && this.IP + 1 === i + j))
            heap += "<span class='pointer'>";
          heap += `${hexPad(this.Heap[i + j], 2)}`;
          if (this.IP + 1 === i + j || (this.IP === i + j && j === 15))
            heap += "</span>";
          heap += " ";
        } else heap += `   `;
      }
      heap += `| `;
      for (let j = 0; j < 16; j++) {
        var char: string = " ";
        if (this.Heap[i + j] !== undefined) {
          let v = this.Heap[i + j];
          if (v >= 32 && v < 127) {
            char = String.fromCharCode(v);
          } else {
            char = ".";
          }
        }
        heap += char;
      }
      heap += "\n";
    }
    return `Heap:<br><div id='heap'>${heap}</div>`;
  }

  RenderBSMemory() {
    let instructionPtr = this.IP;
    let regA = this.RegA;
    let regB = this.RegB;

    let stack1 = "";
    let stack2 = "";
    for (let i = 0; i < this.StackX.length; i++)
      stack1 += hexPad(this.StackX[i], 8) + " ";
    for (let i = 0; i < this.StackY.length; i++)
      stack2 += hexPad(this.StackY[i], 8) + " ";

    let body = `File: <span class='reg'>${this.GetFile()}</span><br>
Line: <span class='reg'>${this.GetLine() + 1}</span><br>
Instruction PTR: <span class='reg'>${hexPad(instructionPtr, 4)}</span><br>
Instruction: <span class='reg'>${hexPad(this.Heap[instructionPtr] ?? 0)} ${
      INSTRUCTIONS[this.Heap[instructionPtr] ?? 0]?.[0] ?? "????"
    } ${hexPad(this.Heap[instructionPtr + 1] ?? 0, 8)}</span><br>
Register A: <span class='reg'>${hexPad(regA, 8)}</span><br>
Register B: <span class='reg'>${hexPad(regB, 8)}</span><br><br>
Stack1: <span class='reg'>${stack1}</span><br>
Stack2: <span class='reg'>${stack2}</span><br>`;
    document.querySelector('div.tab[data-target="baMemory"]')!.innerHTML = body;
  }

  GetLineFrom(IP: number): number {
    var codel = this.ASMMap[IP];
    while (codel >= 0) {
      let m = this.CodeLines[codel].match(/\bline\s*(\d+)/i);
      if (m) {
        return +m[1];
      }
      codel--;
    }
    return 0;
  }
  GetFileFroM(IP: number): string {
    var codel = this.ASMMap[IP];
    while (codel >= 0) {
      let m = this.CodeLines[codel].match(/\bfile\s*(.+)/i);
      if (m) {
        return m[1];
      }
      codel--;
    }
    return "main.bc";
  }
  GetLine(): number {
    return this.GetLineFrom(this.IP);
  }
  GetFile(): string {
    return this.GetFileFroM(this.IP);
  }

  RenderMemory(style: string) {
      this.RenderBSMemory();
  }
}
