export class Interpreter {
  Code: string;
  CodePointer: number = 0;

  Tape: number[] = [0];
  TapePointer: number = 0;

  Input: string = "";
  InputPointer: number = 0;

  Output: string = "";

  constructor(code: string) {
    this.Code = code;
  }

  LoopStack: number[] = [];

  CodeWithPointerHighlight(): string {
    var left = this.Code.substr(0, this.CodePointer);
    var right = this.Code.substr(this.CodePointer + 1);
    left = left.replace(">", "&gt;").replace("<", "&lt;");
    right = right.replace(">", "&gt;").replace("<", "&lt;");
    return (
      left +
      "<span class='pointer'>" +
      this.Code.charAt(this.CodePointer) +
      "</span>" +
      right
    );
  }

  Step(): void {
    if (this.Code.length <= this.CodePointer) {
      return;
    }
    var action = this.Code[this.CodePointer++];
    switch (action) {
      case ",":
        this.Tape[this.TapePointer] =
          this.Input.length > this.InputPointer
            ? this.Input.charCodeAt(this.InputPointer++)
            : 0x00;
        break;
      case ".":
        this.Output += String.fromCharCode(this.Tape[this.TapePointer]);
        break;
      case "-":
        if (--this.Tape[this.TapePointer] < 0)
          this.Tape[this.TapePointer] = 255;
        break;
      case "+":
        if (++this.Tape[this.TapePointer] > 255)
          this.Tape[this.TapePointer] = 0;
        break;
      case ">":
        this.TapePointer++;
        break;
      case "<":
        this.TapePointer--;
        break;
      case "[":
        if (this.Tape[this.TapePointer] === 0) {
          var depth = 1;
          while (depth > 0 && this.Code.length > this.CodePointer) {
            action = this.Code[this.CodePointer++];
            if (action === "[") depth++;
            else if (action === "]") depth--;
          }
        } else {
          this.LoopStack.push(this.CodePointer);
        }
        break;
      case "]":
        if (this.Tape[this.TapePointer] === 0) this.LoopStack.pop();
        else
          this.CodePointer =
            this.LoopStack[this.LoopStack.length - 1] ?? this.CodePointer;
        break;
      case ":":
        break;
      default:
        this.Step();
    }
    if (this.Tape[this.TapePointer] === undefined)
      this.Tape[this.TapePointer] = 0;
  }

  private UnderstandChunk(chunk: string): any {
    let localPointer: number = 0;
    let localTape: any = {};
    let readWrites: any = [];
    for (var i = 0; i < chunk.length; i++) {
      switch (chunk[i]) {
        case "+":
          if (localTape[localPointer] === undefined)
            localTape[localPointer] = 0;
          localTape[localPointer]++;
          break;
        case "-":
          if (localTape[localPointer] === undefined)
            localTape[localPointer] = 0;
          localTape[localPointer]--;
          break;
        case ">":
          localPointer++;
          break;
        case "<":
          localPointer--;
          break;
        case ",":
          readWrites.push({ action: "read", pointer: localPointer });
          localTape[localPointer] = 0;
          break;
        case ".":
          if (localTape[localPointer] === undefined)
            localTape[localPointer] = 0;
          readWrites.push({
            action: "write",
            pointer: localPointer,
            value: localTape[localPointer]
          });
          break;
      }
    }
    return {
      actions: readWrites,
      tape: localTape,
      pointer: localPointer
    };
  }

  private PLUSMINUS(name: string | number) {
    if (+name === 0) return "";
    if (+name < 0) return "-" + Math.abs(+name);
    return "+" + Math.abs(+name);
  }

  private TAB(depth: number) {
    var s = "";
    for (var i = 0; i < depth; i++) s += "\t";
    return s;
  }

  Compile(): string {
    var newCode = this.Code;
    var d = 1;
    newCode =
      'i => {\n\tlet m={};\n\tlet p=0;\n\tlet o="";\n\tlet ip=0;\n\tlet touch=p=>{if(m[p]===undefined)m[p]=0;if(m[p]<0)m[p]=255;if(m[p]>255)m[p]=0;return m[p]};\n' +
      newCode
        .replace(/[[\]]|[^[\]]+/g, (s) => {
          if (s === "[") {
            d++;
            return this.TAB(d - 1) + s + "\n";
          }
          if (s === "]") d--;
          return this.TAB(d) + s + "\n";
        })
        .replace(/\[/g, "«")
        .replace(/\]/g, "»")
        .replace(/[<>,.+-]+/g, (c) => {
          var chunk = this.UnderstandChunk(c);
          var s = "";
          for (var i = 0; i < chunk.actions.length; i++) {
            var action = chunk.actions[i];
            if (action.action === "read") {
              s += `touch(p${this.PLUSMINUS(
                action.pointer
              )});m[p${this.PLUSMINUS(action.pointer)}]=i.charCodeAt(ip++);`;
            } else {
              s += `touch(p${this.PLUSMINUS(
                action.pointer
              )});o+=String.fromCharCode(m[p${this.PLUSMINUS(
                action.pointer
              )}]${this.PLUSMINUS(action.value)});`;
            }
          }
          for (var v in chunk.tape) {
            if (chunk.tape[v] === 1)
              s += `touch(p${this.PLUSMINUS(v)});m[p${this.PLUSMINUS(v)}]++;`;
            else if (chunk.tape[v] === -1)
              s += `touch(p${this.PLUSMINUS(v)});m[p${this.PLUSMINUS(v)}]--;`;
            else if (chunk.tape[v] !== 0) {
              s += `touch(p${this.PLUSMINUS(v)});m[p${this.PLUSMINUS(v)}]${
                chunk.tape[v] > 0 ? "+" : "-"
              }=${Math.abs(chunk.tape[v])};`;
            }
          }
          if (chunk.pointer === 1) s += "p++;";
          else if (chunk.pointer === -1) s += "p--;";
          else if (chunk.pointer > 0) s += `p+=${chunk.pointer};`;
          else if (chunk.pointer < 0) s += `p-=${-chunk.pointer};`;
          return s + " /* " + c + " */";
        })
        .replace(/«/g, "while(touch(p)){")
        .replace(/»/g, "}") +
      "\treturn o;\n}";
    return newCode;
  }

  RenderBFMemory() {
    var body = "<div class='tape'>";
    for (var i = 0; i < this.Tape.length; i++) {
      body += `<span class='memorycell${
        i === this.TapePointer ? " selected" : ""
      }'><span class='character'>${
        this.Tape[i] >= 33 && this.Tape[i] <= 126
          ? String.fromCharCode(this.Tape[i])
          : ""
      }</span><span class='number'>${this.Tape[i]}</span></span>`;
    }

    document.querySelector('div.tab[data-target="bfMemory"]')!.innerHTML = body;
  }

  RenderBFBMMemory() {
    var body = "";
    var stacks: string[] = [];
    for (var i = 0; i < 6; i++) {
      // 6 stacks
      stacks[i] = "<span class='tape'>";
      for (var j = i * 2 + 11; j < this.Tape.length; j += 12) {
        if (this.Tape[j] === 0 && this.Tape[j + 1] === 0) continue;
        stacks[i] += `<span class='memorycell${
          j + 1 === this.TapePointer ? " selected" : ""
        }${this.Tape[j] === 0 ? " error" : ""}'><span class='character'>${
          this.Tape[j + 1] >= 33 && this.Tape[j + 1] <= 126
            ? String.fromCharCode(this.Tape[j + 1])
            : ""
        }</span><span class='number'>${this.Tape[j + 1]}</span></span>`;
      }
      stacks[i] += "</span>";
    }
    body =
      stacks[0] + stacks[1] + stacks[2] + stacks[3] + stacks[4] + stacks[5];
    document.querySelector(
      'div.tab[data-target="bfbmMemory"]'
    )!.innerHTML = body;
  }

  RenderBSMemory() {}

  RenderMemory(style: string) {
    switch (style) {
      case "bfMemory":
        this.RenderBFMemory();
        break;
      case "bfbmMemory":
        this.RenderBFBMMemory();
        break;
      case "bsMemory":
        this.RenderBSMemory();
        break;
    }
  }
}
