/*
Brain meta consists of four stacks:
A, B, C, D, E, F


It has the following commands.
MOV source, destin // Move the top of source to destin
CPY source, destin // Copy the top of source to destin
PUT stack, value   // Put a number on top of a stack
POP stack          // Pop a value off a stack
WHL stack          // While the top of stack is non-zero {
END                // }
INC stack, amount  // Increment the top of stack
DEC stack, amount  // Decrement the top of stack
ADD source, destin // Add the value at the top of source to the top of destin
SUB source, destin // Subtract the value at the top of source from the top of destin
MUL a, b           // Multiply a by b. Pops b.
DIV a, b           // Divide a by b. Store the qoutant on a, and the remainder on b.
ZER stack          // Set the top of stack to zero
INP stack          // Read the next char of STDIN to the top of stack
OUT stack          // Write the top of stack to STDOUT
*/

import { Interpreter } from "./bf";
import { INSTRUCTIONS } from "./brainasm";

let CURRENTSTACK = "A";

function SelectStack(stack: string) {
  if (!stack) return "";
  if (!stack.length) return "";
  let diff = stack.charCodeAt(0) - CURRENTSTACK.charCodeAt(0);
  CURRENTSTACK = stack;
  if (diff === 0) return "";
  diff += 6; // This'll ensure we're on valid memory.
  return (
    "<" + // Grip the rail
    "[«]" + // Slide to the start of the railing.
    ">".repeat(diff * 2) + // Select the new rail
    "[»]" + // Slide to the end of the current rail
    "<<<<<<<<<<<" // And select the actually added element.
  );
}

function GenerateMOV(source: string, destin: string) {
  if (source === destin) return SelectStack(source);
  return (
    SelectStack(destin) + // Select the destination stack
    ">>>>>>>>>>>+>" + // Add a new value
    SelectStack(source) + // Select the source stack
    "[" + // While this stack is >0
    "-" + // Decrement
    SelectStack(destin) +
    "+" + // Increment the other stack
    SelectStack(source) +
    "]" + // Go back and repeat
    "<[[-]«[«]]»[»]<<<<<<<<<<<" // And pop this value
  );
}
function GenerateCPY(source: string, destin: string) {
  if (source === destin) {
    return SelectStack(source) + "[-»+»+««]»»[-««+»»]«<+>";
  }
  return (
    SelectStack(destin) + // Select the destination stack
    ">>>>>>>>>>>+»+>" + // Add two new values
    SelectStack(source) + // Select the source stack
    "[" + // While this stack is >0
    "-" + // Decrement
    SelectStack(destin) + // Select the destination stack
    "+«+" + // Increment both this and the value under
    SelectStack(source) +
    "]" + // Go back and repeat
    SelectStack(destin) + // Go back to the destination
    "[-" + // Essentially an inverse mov from here on
    SelectStack(source) +
    "+" +
    SelectStack(destin) +
    "]" +
    "<[[-]«[«]]»[»]<<<<<<<<<<<"
  );
}
function GeneratePUT(stack: string, value: number) {
  return (
    SelectStack(stack) + // Select the target stack
    ">>>>>>>>>>>+>" + // Enable the next value up
    "+".repeat(value) // Add plus's for flavour
  );
}
function GeneratePOP(stack: string) {
  return (
    SelectStack(stack) + "[-]<[[-]«[«]]»[»]<<<<<<<<<<<" // Select the target stack // Clear the value and the rail
  );
}
let whileStack: string[] = [];
function GenerateWHL(stack: string) {
  whileStack.push(stack);
  return SelectStack(stack) + "[";
}
function GenerateEND() {
  return SelectStack(whileStack.pop()!) + "]";
}
function GenerateINC(stack: string, amount: number) {
  return SelectStack(stack) + "+".repeat(amount ?? 1);
}
function GenerateDEC(stack: string, amount: number) {
  return SelectStack(stack) + "-".repeat(amount ?? 1);
}
function GenerateADD(source: string, destin: string) {
  // Identical to MOV without pushing a new value
  return (
    SelectStack(source) + // Select the source stack
    "[" + // While this stack is >0
    "-" + // Decrement
    SelectStack(destin) +
    "+" + // Increment the other stack
    SelectStack(source) +
    "]" + // Go back and repeat
    "<[[-]«[«]]»[»]<<<<<<<<<<<" // And pop this value
  );
}
function GenerateSUB(source: string, destin: string) {
  // Identical to ADD but decrements destin instead of increments
  return (
    SelectStack(source) + // Select the source stack
    "[" + // While this stack is >0
    "-" + // Decrement
    SelectStack(destin) +
    "-" + // Decrement the other stack
    SelectStack(source) +
    "]" + // Go back and repeat
    "<[[-]«[«]]»[»]<<<<<<<<<<<" // And pop this value
  );
}
function GenerateMUL(a: string, b: string) {
  return (
    SelectStack(a) + // Select the first stack
    ">>>>>>>>>>>+>" + // Add a value to store b onto
    SelectStack(b) +
    "[-" +
    SelectStack(a) +
    "+" +
    SelectStack(b) +
    "]" + // Move the top of b unto a
    "<[[-]«[«]]»[»]<<<<<<<<<<<" + // Pop b
    SelectStack(a) + // Move back unto a, which is now [...a,b,t0,t1]
    "«[»»»+«««-]" +
    "»»»[" +
    "««[«+»»+«-]»[«+»-]" +
    "»-]««[-]<-<<<<<<<<<<<"
  );
}
function GenerateDIV(a: string, b: string) {
  return (
    SelectStack(a) + // Select the first stack
    ">>>>>>>>>>>+>" + // Add a value to store b onto
    SelectStack(b) +
    "[-" +
    SelectStack(a) +
    "+" +
    SelectStack(b) +
    "]" + // Move the top of b unto a
    SelectStack(a) + // Move back unto a
    "[-»+«]«" + // "[>n,0,d]"
    "[-»+»-[»+»»]»[+[-«+»]»+»»]««««««]" + // [>0,n,d-n%d,n%d,n/d]
    "»[-]»[-]»»[-««««+»»»»]«[-««+»»]««[-" +
    SelectStack(b) +
    "+" +
    SelectStack(a) +
    "]" +
    "<-<<<<<<<<<<<"
  );
}
function GenerateZER(stack: string) {
  return SelectStack(stack) + "[-]"; // Not rocket science
}
function GenerateINP(stack: string) {
  return SelectStack(stack) + ">>>>>>>>>>>+>,";
}
function GenerateOUT(stack: string) {
  return SelectStack(stack) + ".";
}

const ParseInstruction: any = {
  MOV: GenerateMOV,
  CPY: GenerateCPY,
  PUT: GeneratePUT,
  POP: GeneratePOP,
  WHL: GenerateWHL,
  END: GenerateEND,
  INC: GenerateINC,
  DEC: GenerateDEC,
  ADD: GenerateADD,
  SUB: GenerateSUB,
  MUL: GenerateMUL,
  DIV: GenerateDIV,
  ZER: GenerateZER,
  INP: GenerateINP,
  OUT: GenerateOUT,
  CDE: () => "",
};

export function Transpile(code: string): string {
  let out = "";
  CURRENTSTACK = "A";
  for (let s of code.matchAll(
    /(?<instruction>MOV|CPY|PUT|POP|WHL|END|INC|DEC|ADD|SUB|MUL|DIV|ZER|INP|OUT|CDE)(?<arguments>(?:,?[ \t]*(?:[A-F]|\d+|'.'))*)/g
  )) {
    let instruction = s[1];
    let args = Array.from(s[2].matchAll(/(?:,?\s*([A-F]|\d+|'.'))/g))
      .map((c) => c[1])
      .map((c) => (c[0] === "'" ? c.charCodeAt(1) : c.match(/\d/) ? +c : c));
    out += `:("${s[0]}"\t${ParseInstruction[instruction](...args)
      .replace(/«/g, "<<<<<<<<<<<<")
      .replace(/»/g, ">>>>>>>>>>>>")} )\n`;
  }
  return out;
}

export function GetStackIndex(s: string | number) {
  return Math.max("ABCDEF".indexOf("" + s), 0);
}

export class MetaInterpreter {
  Stacks: number[][] = [];
  Code: string[][];
  CodePointer: number = 0;
  LastStack: number = 0;
  WhileStack: [number, number][] = [];
  Input: string = "";
  InputPointer: number = 0;
  Output: string = "";

  constructor(code: string) {
    this.Code = Array.from(
      code.matchAll(
        /(?<instruction>MOV|CPY|PUT|POP|WHL|END|INC|DEC|ADD|SUB|MUL|DIV|ZER|INP|OUT|CDE)(?<arguments>(?:,?[ \t]*(?:[A-F]|\d+|'.'))*)/g
      )
    ).map((c) => [c[1], c[2]]);
    for (let i = 0; i < 6; i++) this.Stacks[i] = [];
  }

  CodeWithPointerHighlight(): string {
    let s = "";
    for (let i = 0; i < this.Code.length; i++) {
      if (this.CodePointer === i) {
        s += "<span class='pointer'>";
      }
      s += `${this.Code[i][0]} ${this.Code[i][1]}`;
      if (this.CodePointer === i) {
        s += "</span>";
      }
      s += "\n";
    }
    return s;
  }

  ToBF(): Interpreter {
    // Stringify our code.
    let code = Transpile(this.Code.map((c) => `${c[0]} ${c[1]}`).join("\n"));
    let bf = new Interpreter(code);

    // Move onto the Code Pointer
    let codeLengths = code.split("\n").map((c) => c.length + 1);
    bf.CodePointer = codeLengths
      .slice(0, this.CodePointer)
      .reduce((a, b) => a + b, 0);

    // Rebuild the while stack
    for (let i = 0; i < this.WhileStack.length; i++) {
      bf.LoopStack.push(
        codeLengths.slice(0, this.WhileStack[i][0]).reduce((a, b) => a + b, 0)
      );
    }

    bf.Input = this.Input;
    bf.InputPointer = this.InputPointer;
    bf.Output = this.Output;

    // Rebuild memory
    let maxStack = Math.max(...this.Stacks.map((c) => c.length));
    for (let j = 0; j < 12; j++) {
      bf.Tape[j] = 0;
    }
    for (let i = 0; i < maxStack; i++) {
      for (let j = 0; j < 6; j++) {
        bf.Tape[11 + i * 12 + j * 2] = i < this.Stacks[j].length ? 1 : 0;
        bf.Tape[12 + i * 12 + j * 2] = this.Stacks[j][i] ?? 0;
      }
    }

    bf.TapePointer =
      12 * maxStack * this.Stacks[this.LastStack].length + this.LastStack * 2;

    return bf;
  }

  static FromBF(bf: Interpreter): MetaInterpreter {
    let interp = new MetaInterpreter(bf.Code);
    // Step the BF interpreter until we're SURE we're on a meta line.
    while (
      bf.CodePointer < bf.Code.length &&
      bf.Code.charAt(bf.CodePointer - 1) !== ":"
    ) {
      bf.Step();
    }
    // Find out what Codel line we're on
    let line = bf.Code.substr(0, bf.CodePointer).replace(/[^\n]/g, "").length;
    interp.CodePointer = line;

    interp.Input = bf.Input;
    interp.InputPointer = bf.InputPointer;
    interp.Output = bf.Output;

    // Parse the memory
    for (let i = 0; i < 6; i++) {
      // 6 stacks
      for (let j = i * 2 + 11; j < bf.Tape.length; j += 12) {
        if (bf.Tape[j] === 0) continue;
        interp.Stacks[i].push(bf.Tape[j + 1]);
      }
    }

    // Rebuild the WhileStack
    for (let i = 0; i < interp.CodePointer; i++) {
      let codel = interp.Code[i];
      if (codel[0] === "WHL") {
        let args = Array.from(codel[1].matchAll(/(?:,?\s*([A-F]|\d+|'.'))/g))
          .map((c) => c[1])
          .map((c) =>
            c[0] === "'" ? c.charCodeAt(1) : c.match(/\d/) ? +c : c
          );
        let a: number = GetStackIndex(args[0]);
        interp.WhileStack.push([i, a]);
      } else if (codel[0] === "END") {
        interp.WhileStack.pop();
      }
    }

    interp.LastStack = Math.floor((bf.TapePointer % 12) / 2);
    return interp;
  }

  Step(): boolean {
    let codel = this.Code[this.CodePointer++];
    if (codel === undefined) return true;
    let instruction = codel[0];
    let args = Array.from(codel[1].matchAll(/(?:,?\s*([A-F]|\d+|'.'))/g))
      .map((c) => c[1])
      .map((c) => (c[0] === "'" ? c.charCodeAt(1) : c.match(/\d/) ? +c : c));
    let a: number = GetStackIndex(args[0]);
    let b: number = GetStackIndex(args[1]);
    for (let i = 0; i < 6; i++) {
      if (this.Stacks[i].length === 0) this.Stacks[i].push(0);
    }
    switch (instruction) {
      case "MOV": {
        this.Stacks[b].push(this.Stacks[a].pop() ?? 0);
        this.LastStack = a;
        break;
      }
      case "CPY": {
        this.Stacks[b].push(this.Stacks[a][this.Stacks[a].length - 1] ?? 0);
        this.LastStack = b;
        break;
      }
      case "PUT": {
        this.Stacks[a].push(+args[1] & 255);
        this.LastStack = a;
        break;
      }
      case "POP": {
        this.Stacks[a].pop();
        this.LastStack = a;
        break;
      }
      case "WHL": {
        let val = this.Stacks[a][this.Stacks[a].length - 1] ?? 0;
        if (val === 0) {
          let depth = 1;
          while (this.CodePointer < this.Code.length) {
            let p = this.Code[this.CodePointer++];
            if (p[0] === "WHL") depth++;
            if (p[0] === "END") {
              depth--;
              if (depth === 0) {
                break;
              }
            }
          }
        } else {
          this.WhileStack.push([this.CodePointer, a]);
        }
        break;
      }
      case "END": {
        this.LastStack = this.WhileStack[this.WhileStack.length - 1][1];
        let val =
          this.Stacks[this.LastStack][this.Stacks[this.LastStack].length - 1] ??
          0;
        if (val === 0) this.WhileStack.pop();
        else this.CodePointer = this.WhileStack[this.WhileStack.length - 1][0];
        break;
      }
      case "INC": {
        let val = +args[1];
        if (typeof args[1] !== "number") val = 1;
        this.Stacks[a][this.Stacks[a].length - 1] += val;
        this.Stacks[a][this.Stacks[a].length - 1] =
          this.Stacks[a][this.Stacks[a].length - 1] & 255;
        this.LastStack = a;
        break;
      }
      case "DEC": {
        let val = +(args[1] ?? 1);
        if (typeof args[1] === "string") val = 1;
        this.Stacks[a][this.Stacks[a].length - 1] -= val;
        this.Stacks[a][this.Stacks[a].length - 1] =
          this.Stacks[a][this.Stacks[a].length - 1] & 255;
        this.LastStack = a;
        break;
      }
      case "ADD": {
        this.Stacks[b][this.Stacks[b].length - 1] += this.Stacks[a].pop() ?? 0;
        this.Stacks[b][this.Stacks[b].length - 1] =
          this.Stacks[b][this.Stacks[b].length - 1] & 255;
        this.LastStack = a;
        break;
      }
      case "SUB": {
        this.Stacks[b][this.Stacks[b].length - 1] -= this.Stacks[a].pop() ?? 0;
        this.Stacks[b][this.Stacks[b].length - 1] =
          this.Stacks[b][this.Stacks[b].length - 1] & 255;
        this.LastStack = a;
        break;
      }
      case "MUL": {
        this.Stacks[a][this.Stacks[a].length - 1] *= this.Stacks[b].pop() ?? 0;
        break;
      }
      case "DIV": {
        let aVal = this.Stacks[a].pop() ?? 0;
        let bVal = this.Stacks[b].pop() ?? 0;
        this.Stacks[a].push(Math.floor(aVal / bVal));
        this.Stacks[b].push(Math.floor(aVal % bVal));
        break;
      }
      case "ZER": {
        this.Stacks[a].pop();
        this.Stacks[a].push(0);
        break;
      }
      case "INP": {
        this.Stacks[a].push(this.Input.charCodeAt(this.InputPointer++));
        this.LastStack = a;
        break;
      }
      case "OUT": {
        this.Output += String.fromCharCode(
          this.Stacks[a][this.Stacks[a].length - 1] ?? 0
        );
        this.LastStack = a;
        break;
      }
      case "CDE": {
        return false;
      }
    }
    return true;
  }

  RenderBFMemory() {
    // Falsify BF memory
    let tape = [];
    let maxStack = Math.max(...this.Stacks.map((c) => c.length));
    for (let j = 0; j < 12; j++) {
      tape[j] = 0;
    }
    for (let i = 0; i < maxStack; i++) {
      for (let j = 0; j < 6; j++) {
        tape[11 + i * 12 + j * 2] = i < this.Stacks[j].length ? 1 : 0;
        tape[12 + i * 12 + j * 2] = this.Stacks[j][i] ?? 0;
      }
    }

    let ptr =
      12 +
      maxStack * (this.Stacks[this.LastStack].length - 1) +
      this.LastStack * 2;

    let body = "<div class='tape'>";
    for (let i = 0; i < tape.length; i++) {
      body += `<span class='memorycell${
        i === ptr ? " selected" : ""
      }'><span class='character'>${
        tape[i] >= 33 && tape[i] <= 126 ? String.fromCharCode(tape[i]) : ""
      }</span><span class='number'>${tape[i]}</span></span>`;
    }

    document.querySelector('div.tab[data-target="bfMemory"]')!.innerHTML = body;
  }

  RenderBFBMMemory() {
    let body = "";
    let stacks: string[] = [];
    for (let i = 0; i < 6; i++) {
      // 6 stacks
      stacks[i] = `${i} <span class='tape${
        i === this.LastStack ? " selected" : ""
      }'>`;
      for (let j = 0; j < this.Stacks[i].length; j++) {
        let character = `<span class='character'>${
          this.Stacks[i][j] >= 33 && this.Stacks[i][j] <= 126
            ? String.fromCharCode(this.Stacks[i][j])
            : ""
        }</span>`;
        let number = `<span class='number'>${this.Stacks[i][j]}</span>`;
        stacks[i] += `<span class='memorycell'>${character}${number}</span>`;
      }
      stacks[i] += "</span>";
    }
    body =
      stacks[0] + stacks[1] + stacks[2] + stacks[3] + stacks[4] + stacks[5];
    document.querySelector('div.tab[data-target="bfbmMemory"]')!.innerHTML =
      body;
  }

  RenderBSMemory() {
    let regTape = this.Stacks[0].concat(this.Stacks[1].concat().reverse());
    let heapTape = this.Stacks[2].concat(this.Stacks[3].concat().reverse());
    let stack1 = this.Stacks[4];
    let stack2 = this.Stacks[5];

    let heapShorts = [];
    for (let i = 0; i < heapTape.length; i += 2) {
      heapShorts[i / 2] = heapTape[i] + (heapTape[i + 1] << 8);
    }

    let heapPtr = (regTape[0] ?? 0) + ((regTape[1] ?? 0) << 8);
    let heapTargetPtr = (regTape[2] ?? 0) + ((regTape[3] ?? 0) << 8);
    let instructionPtr = (regTape[4] ?? 0) + ((regTape[5] ?? 0) << 8);
    let nextInstruction =
      INSTRUCTIONS[heapShorts[instructionPtr]]?.[0] ??
      heapShorts[instructionPtr] ??
      "NOP";
    let loadedInstruction =
      INSTRUCTIONS[regTape[6] ?? 0]?.[0] ?? regTape[6] ?? 0;
    let instructionArgument = (regTape[8] ?? 0) + ((regTape[9] ?? 0) << 8);
    let regA = (regTape[10] ?? 0) + ((regTape[11] ?? 0) << 8);
    let regB = (regTape[12] ?? 0) + ((regTape[13] ?? 0) << 8);

    let body = `Heap PTR: ${heapPtr}<br>
Heap Target PTR: ${heapTargetPtr}<br>
Instruction PTR: ${instructionPtr}<br>
Next Instruction: ${nextInstruction}<br>
Loaded Instruction: ${loadedInstruction}<br>
Instruction Argument: ${instructionArgument}<br>
Register A: ${regA}<br>
Register B: ${regB}<br><br>
Heap: ${heapShorts}<br><br>
Stack1: ${stack1}<br>
Stack2: ${stack2}`;
    document.querySelector('div.tab[data-target="baMemory"]')!.innerHTML = body;
  }

  RenderMemory(style: string) {
    switch (style) {
      case "bfMemory":
        this.RenderBFMemory();
        break;
      case "bfbmMemory":
        this.RenderBFBMMemory();
        break;
      case "baMemory":
        this.RenderBSMemory();
        break;
    }
  }
}
