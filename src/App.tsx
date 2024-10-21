import "./styles.css";
import { useState } from "react";
import { ASMInterpreter } from "./brainasm";
import AceEditor from "react-ace";
import { Ace, Range, edit } from "ace-builds";
import "ace-builds/src-noconflict/theme-github";
import "ace-builds/src-noconflict/mode-lua";
import "./mode-brainchild";
import "./BrainChild/Types";
import "./BrainChild/vartype";
import { Parse } from "./BrainChild/brainchild";
import { Scope } from "./BrainChild/Scope";
import "./BrainChild/const";
import "./BrainChild/block";
import "./BrainChild/include";
import "./BrainChild/functiondefinition";
import "./BrainChild/class";
import "./BrainChild/new";
import "./BrainChild/if";
import "./BrainChild/while";
import "./BrainChild/return";
import "./BrainChild/assignment";
import "./BrainChild/numberconstant";
import "./BrainChild/charconstant";
import "./BrainChild/stringconstant";
import "./BrainChild/variabledefinition";
import "./BrainChild/asm";
import "./BrainChild/reference";
import "./BrainChild/dereference";
import "./BrainChild/call";
import "./BrainChild/expressionstatement";
import "./BrainChild/math";
import "./BrainChild/parenthetical";
import "./BrainChild/cumulate";
import "./BrainChild/macrodef";
import "./BrainChild/sizeof";
import "./BrainChild/reserve";
import { TokenError } from "./BrainChild/token";
import { GenerateReadOnlys } from "./ReadOnlys";
import { Terminal, Event } from "./Terminal";
const pako = require("pako");

export const AllReadOnlys: {[name: string]: string} = {};

var bsInterp: ASMInterpreter | undefined = undefined;
var scope: Scope | null = null;
let editors: { [path: string]: Ace.Editor } = {};
let term: Terminal;

var base64abc = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "/"];
  
/*
// This constant can also be computed with the following algorithm:
const l = 256, base64codes = new Uint8Array(l);
for (let i = 0; i < l; ++i) {
  base64codes[i] = 255; // invalid character
}
base64abc.forEach((char, index) => {
  base64codes[char.charCodeAt(0)] = index;
});
base64codes["=".charCodeAt(0)] = 0; // ignored anyway, so we just need to prevent an error
*/
var base64codes = [255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 62, 255, 255, 255, 63, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 255, 255, 255, 0, 255, 255, 255, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 255, 255, 255, 255, 255, 255, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51];
function getBase64Code(charCode: number) {
  if (charCode >= base64codes.length) {
    throw new Error("Unable to parse base64 string.");
  }
  var code = base64codes[charCode];
  if (code === 255) {
    throw new Error("Unable to parse base64 string.");
  }
  return code;
}
function bytesToBase64(bytes: Uint8Array) {
  var result = "",
    i,
    l = bytes.length;
  for (i = 2; i < l; i += 3) {
    result += base64abc[bytes[i - 2] >> 2];
    result += base64abc[(bytes[i - 2] & 0x03) << 4 | bytes[i - 1] >> 4];
    result += base64abc[(bytes[i - 1] & 0x0f) << 2 | bytes[i] >> 6];
    result += base64abc[bytes[i] & 0x3f];
  }
  if (i === l + 1) {
    // 1 octet yet to write
    result += base64abc[bytes[i - 2] >> 2];
    result += base64abc[(bytes[i - 2] & 0x03) << 4];
    result += "==";
  }
  if (i === l) {
    // 2 octets yet to write
    result += base64abc[bytes[i - 2] >> 2];
    result += base64abc[(bytes[i - 2] & 0x03) << 4 | bytes[i - 1] >> 4];
    result += base64abc[(bytes[i - 1] & 0x0f) << 2];
    result += "=";
  }
  return result;
}
function base64ToBytes(str: string) {
  if (str.length % 4 !== 0) {
    throw new Error("Unable to parse base64 string.");
  }
  var index = str.indexOf("=");
  if (index !== -1 && index < str.length - 2) {
    throw new Error("Unable to parse base64 string.");
  }
  var missingOctets = str.endsWith("==") ? 2 : str.endsWith("=") ? 1 : 0,
    n = str.length,
    result = new Uint8Array(3 * (n / 4)),
    buffer;
  for (var i = 0, j = 0; i < n; i += 4, j += 3) {
    buffer = getBase64Code(str.charCodeAt(i)) << 18 | getBase64Code(str.charCodeAt(i + 1)) << 12 | getBase64Code(str.charCodeAt(i + 2)) << 6 | getBase64Code(str.charCodeAt(i + 3));
    result[j] = buffer >> 16;
    result[j + 1] = buffer >> 8 & 0xff;
    result[j + 2] = buffer & 0xff;
  }
  return result.subarray(0, result.length - missingOctets);
}
function base64encode(str: Uint8Array) {
  return bytesToBase64(str);
}
function base64decode(str: string) {
  return base64ToBytes(str);
}
function compress(str: string) {
  return base64encode(pako.deflate(str, {
    level: 3
  }));
}
function decompress(str: string) {
  return pako.inflate(base64decode(str));
}

async function parseEditor(): Promise<Scope> {
  var files: { [name: string]: string } = {};
  var annotations: { [file: string]: Ace.Annotation[] } = {};
  annotations[""] = [];
  for (let id in editors) {
    files[id] = editors[id].getValue();
    editors[id].getSession().setAnnotations([]);
    annotations[id] = [];
  }
  term = new Terminal();
  let rendered = term.Render();
  window.requestAnimationFrame(() => {
    document.getElementById("output")!.innerHTML = rendered;
  });
  var scope = await Parse(files);
  scope.TypeInformation.forEach((i) => {
    let t = i[0];

    annotations[t.Claimer.File].push({
      row: t.GetLineNo(),
      column: t.GetColumn(),
      text: i[1] + "",
      type: "type",
    });
  });
  for (let id in editors) {
    editors[id].getSession().setAnnotations(annotations[id]);
  }
  return scope;
}

function selectETab(event: any) {
  var target = (event.target as HTMLButtonElement).dataset.target!;
  document
    .querySelectorAll("#editorButtons button")
    .forEach((c) => c.classList.remove("active"));
  document
    .querySelector('#editorButtons button[data-target="' + target + '"]')
    ?.classList.add("active");
  document
    .querySelectorAll("div.etab")
    .forEach((c) => c.classList.remove("active"));
  document
    .querySelector('div.etab[data-target="' + target + '"]')
    ?.classList.add("active");
}

function PushEvent(
  event: Event,
  argumentLow: number = 0,
  argumentHigh: number = 0
) {
  if (!bsInterp) return;
  bsInterp.Input += String.fromCharCode(event);
  bsInterp.Input += String.fromCharCode(argumentLow);
  bsInterp.Input += String.fromCharCode(argumentHigh);
  while (bsInterp.Input.length > 64 * 3) {
    bsInterp.Input = bsInterp.Input.substr(3);
  }
}

let waitTimeout: NodeJS.Timer | undefined = undefined;
function handleChange() {
  console.clear();
  if (waitTimeout) {
    clearTimeout(waitTimeout);
    waitTimeout = undefined;
  }
  waitTimeout = setTimeout(async () => {
    waitTimeout = undefined;
    try {
      if('history'in window){
        let userFiles: {[key:string]:string} = {};
        for(let file in editors){
          if (file in AllReadOnlys) continue;
          userFiles[file] = editors[file].getValue();
        }
        let codeParam = compress(JSON.stringify(userFiles));
        let url = new URL(window.location as any as string);
        url.searchParams.set("code", codeParam);
        window.history.pushState(null, "", url);
      }
      console.log("compiling...");
      var t = Date.now();
      try {
        let scope = await parseEditor();
        var parsed = scope.Assembly;
        console.log(`parsed in ${Date.now() - t}ms`);
        t = Date.now();
        parsed = Scope.ObliterateRedundancies(parsed);
        console.log(`optimized in ${Date.now() - t}ms`);
        t = Date.now();
        bsInterp = new ASMInterpreter(parsed);
        console.log(`compiled in ${Date.now() - t}ms`);
        document.getElementById("codeText")!.innerHTML = parsed.join("\n");
        scope.RenderBSMemory(bsInterp);
      } catch (e: any) {
        if (e instanceof TokenError) {
          // Add errors up the tree
          var errors: { [file: string]: Ace.Annotation[] } = {};
          for (let id in editors) {
            errors[id] = [];
          }
          errors[""] = [];
          e.CallStack.forEach((t) => {
            errors[t.Claimer.File].push({
              row: t.GetLineNo(),
              column: t.GetColumn(),
              text: e.message,
              type: "error",
            });
          });
          for (let id in editors) {
            editors[id].getSession().setAnnotations(errors[id]);
          }
          console.error(e);
        } else {
          document.getElementById(
            "codeText"
          )!.innerHTML = `<span class='error'>${e.stack}</span>`;
        }
      }
    } catch (e) {
      console.log(e);
      return;
    }
  }, 300);
}

function addGutter(file: string) {
  return function (e: Ace.Editor) {
    GenerateReadOnlys();
    let search = new URL(window.location as any as string).searchParams;
    if (search.has("code")) {
      var decompressed = new TextDecoder().decode(decompress(search.get("code")!));
      console.log(decompressed);
      var unrolled = JSON.parse(decompressed);
      e.setValue(unrolled["main.bc"]);
      for (let file in unrolled) {
        if (file === "main.bc") continue;
        new CustomTab(file, unrolled[file]);
      }
    } else {
      e.setValue("include term.bc;\ninclude extmacros.bc;\ninclude int.bc;\nint seed = 1;\n\nfunction rand() -> int {\n    seed ~= (seed * 128);\n    seed ~= (seed / 512);\n    seed ~= (seed * 256);\n    return seed;\n}\n\nmetamethod get_X(pVec2 this) -> int { (this -> int)%0x10000 }\nmetamethod get_Y(pVec2 this) -> int { (this -> int)/0x10000 }\nmetamethod add(pVec2 a, pVec2 b) -> pVec2 { ( ((((a->int)%0x10000)+((b->int)%0x10000))%0x10000) + ((((a->int)/0x10000)*0x10000)+(((b->int)/0x10000)*0x10000)) -> pVec2) }\nmetamethod sub(pVec2 a, pVec2 b) -> pVec2 { ( ((((a->int)%0x10000)-((b->int)%0x10000))%0x10000) + ((((a->int)/0x10000)*0x10000)-(((b->int)/0x10000)*0x10000)) -> pVec2) }\nmetamethod eq(pVec2 a, pVec2 b) -> int { (a->int)==(b->int) }\nabstract class pVec2 {\n    static function Make(int x, int y) -> pVec2 { ((x%0x10000) + (y*0x10000) -> pVec2) }\n    static function WithX(pVec2 this, int x) -> pVec2 { ((x%0x10000) + (((this->int)/0x10000)*0x10000) -> pVec2) }\n    static function WithY(pVec2 this, int y) -> pVec2 { (((this->int)%0x10000)+ (y*0x10000) -> pVec2) }\n}\n\npVec2 apple = pVec2.Make(0xFF,0xFF);\n\n@int DirectionVectors = new pVec2[] {\n    (0xFFFF0000 -> pVec2),\n    (0x00000001 -> pVec2),\n    (0x00010000 -> pVec2),\n    (0x0000FFFF -> pVec2)\n};\n@int DirectionHeads = new int[]{'^','>','v','<'}\n\nmetamethod truthy(Body this)->int{\n    return (this -> int);\n}\nclass Body {\n    pVec2 Pos;\n    pVec2 LastPos;\n    Body Tail;\n    \n    function Move(pVec2 pos){\n        this.LastPos = this.Pos;\n        if(this.Tail)this.Tail.Move(this.Pos);\n        this.Pos = pos;\n    }\n    \n    function MoveBy(pVec2 amount){\n        this.Move(this.Pos + amount);\n    }\n    \n    function Grow(){\n        if(this.Tail)return this.Tail.Grow();\n        this.Tail = new Body(this.LastPos);\n    }\n    \n    function Draw(){\n        if(this.Tail)this.Tail.Draw();\n        Term.Cursor.X = this.Pos.X;\n        Term.Cursor.Y = this.Pos.Y;\n        putchar('#');\n    }\n    \n    new (pVec2 pos){\n        this.LastPos = pos;\n        this.Pos = pos;\n    }\n}\n\nclass Head : Body {\n    int Direction;\n    new (pVec2 pos){\n        this.Direction = 1;\n        this.Pos = pos;\n        this.LastPos = pos;\n    }\n    function Draw(){\n        if(this.Tail)this.Tail.Draw();\n        Term.Cursor.X = this.Pos.X;\n        Term.Cursor.Y = this.Pos.Y;\n        putchar(DirectionHeads + this.Direction);\n    }\n}\n\nint score = 0;\nfunction GameOver(){\n    Term.Clear();\n    Term.Style.Fore = Red;\n    Term.Style.Bold = 1;\n    Term.Cursor.X = 27;\n    Term.Cursor.Y = 15;\n    Term.Write(\"GAME  OVER\");\n    Term.Cursor.X = 28;\n    Term.Cursor.Y = 16;\n    Term.Write(\"SCORE: \");\n    Term.WriteNum(score);\n    asm {halt}\n}\n\nHead snake = new Head(pVec2.Make(32, 16));\nsnake.Grow();\nsnake.Grow();\nsnake.Grow();\n\nint frame = 0;\nint counter = 0;\nint grace = 3;\nTerm.PollEvents();\nTerm.Frame.Push(()=>{\n    seed += counter;\n    rand();\n    if(apple.X > 63){\n        var a = (rand() -> pVec2);\n        apple = pVec2.Make(a.X%64, 1 + (a.Y%31));\n    }\n    if(frame++ >= 2 + (2*!(snake.Direction%2))){\n        snake.MoveBy((*(DirectionVectors + snake.Direction) -> pVec2));\n        frame = 0;\n    }\n    if(snake.Pos == apple){\n        score++;\n        snake.Grow();\n        var a = (rand() -> pVec2);\n        apple = pVec2.Make(a.X%64, 1 + (a.Y%31));\n    }\n    if(grace)grace--\n    else{\n        var b = snake.Tail;\n        while(b){\n            if(snake.Pos == b.Pos){\n                GameOver();\n            }\n            b = b.Tail;\n        }\n    }\n    if(snake.Pos.X > 63){GameOver();}\n    if(snake.Pos.Y > 31){GameOver();}\n    if(snake.Pos.Y < 1){GameOver();}\n    Term.Clear();\n    Term.Cursor.Reset();\n    Term.Style.Back = White;\n    Term.Style.Fore = Black;\n    Term.Write(\"                                                                \");\n    Term.Cursor.Reset();\n    Term.Write(\"SCORE: \");\n    Term.WriteNum(score);\n    Term.Style.Back = Black;\n    Term.Style.Fore = White;\n    Term.Cursor.X = apple.X;\n    Term.Cursor.Y = apple.Y;\n    putchar('a');\n    snake.Draw();\n});\n\nTerm.KeyDown.Push(function(int h, int l){\n    if(h=='w')if(1 == snake.Direction%2)return snake.Direction = 0;\n    if(h=='d')if(0 == snake.Direction%2)return snake.Direction = 1;\n    if(h=='s')if(1 == snake.Direction%2)return snake.Direction = 2;\n    if(h=='a')if(0 == snake.Direction%2)return snake.Direction = 3;\n})\n\nwhile(1){counter++;Term.PollEvents();}");
    }

    editors[file] = e;
    let editor = e;
    (editor.on as any)("guttermousedown", function (e: any) {
      var target = e.domEvent.target;

      if (target.className.indexOf("ace_gutter-cell") === -1) {
        return;
      }

      if (!editor.isFocused()) {
        return;
      }

      if (e.clientX > 25 + target.getBoundingClientRect().left) {
        return;
      }

      var row = e.getDocumentPosition().row;
      var breakpoints = e.editor.session.getBreakpoints(row, 0);

      // If there's a breakpoint already defined, it should be removed, offering the toggle feature
      if (typeof breakpoints[row] === typeof undefined) {
        e.editor.session.setBreakpoint(row);
      } else {
        e.editor.session.clearBreakpoint(row);
      }

      e.stop();
    });
  };
}

class CustomTab {
  Button: HTMLButtonElement;
  Input?: HTMLInputElement;
  EditorDiv: HTMLDivElement;
  Editor: Ace.Editor;
  File: string = "";
  constructor(name: string|null = null, code: string|null = null) {
    let newTabButton = document.createElement("button") as HTMLButtonElement;
    newTabButton.onclick = selectETab;
    let inp = document.createElement("input") as HTMLInputElement;
    inp.size = 1;
    inp.type = "text";
    inp.oninput = () => (inp.size = Math.max(1, inp.value.length));
    newTabButton.append(inp);
    document.getElementById("editorButtons")!.append(newTabButton);
    var etab = document.createElement("div") as HTMLDivElement;
    etab.className = "etab";
    var textarea = document.createElement("textarea") as HTMLTextAreaElement;
    etab.append(textarea);
    document.getElementById("editorTabs")!.appendChild(etab);
    var a = edit(textarea);
    this.Editor = a;

    a.getSession().on("change", handleChange);
    a.setTheme("ace/theme/github");
    a.getSession().setMode("ace/mode/brainchild");
    (a.getSession().on as any)("guttermousedown", function (e: any) {
      var target = e.domEvent.target;
      if (target.className.indexOf("ace_gutter-cell") === -1) {
        return;
      }

      if (!a.isFocused()) {
        return;
      }

      if (e.clientX > 25 + target.getBoundingClientRect().left) {
        return;
      }

      var row = e.getDocumentPosition().row;
      var breakpoints = e.editor.session.getBreakpoints(row, 0);

      // If there's a breakpoint already defined, it should be removed, offering the toggle feature
      if (typeof breakpoints[row] === typeof undefined) {
        e.editor.session.setBreakpoint(row);
      } else {
        e.editor.session.clearBreakpoint(row);
      }

      e.stop();
    });
    this.Button = newTabButton;
    this.Input = inp;
    inp.onblur = () => this.InputDone();
    inp.onkeydown = (ev) => {
      if (ev.key === "Enter") {
        inp.blur();
      }
    };
    inp.focus();
    this.EditorDiv = etab;
    if(name !== null){
      inp.value = name;
      this.InputDone();
    }
    if (code !== null){
      this.Editor.setValue(code);
    }
  }

  Destroy() {
    if (editors[this.File]) delete editors[this.File];
    this.Button.remove();
    this.Input?.remove();
    this.EditorDiv.remove();
    (
      (document.getElementById("editorButtons") as HTMLDivElement)
        .children[0] as HTMLButtonElement
    ).click();
  }

  InputDone() {
    if (!this.Input) return;
    if (this.Input.value.match(/^\s*$/)) {
      this.Destroy();
      return;
    }
    if (editors[this.File]) delete editors[this.File];
    this.File = this.Input.value;
    this.Button.setAttribute("data-target", this.File);
    this.EditorDiv.setAttribute("data-target", this.File);
    editors[this.File] = this.Editor;
    this.Input.remove();
    this.Button.innerText = this.File;
    var editButton = document.createElement("a");
    editButton.innerText = "✎";
    editButton.onclick = () => this.Edit();
    var deleteButton = document.createElement("a");
    deleteButton.innerText = "X";
    deleteButton.onclick = () => {
      if (
        window.confirm(
          `Are you sure you want to delete ${this.File}? No way to undo!`
        )
      ) {
        this.Destroy();
      }
    };
    this.Button.append(editButton);
    this.Button.append(deleteButton);
    this.Input = undefined;
    this.Button.click();
  }

  Edit() {
    if (this.Input) return;
    this.Button.innerHTML = "";
    let inp = document.createElement("input") as HTMLInputElement;
    inp.size = 1;
    inp.type = "text";
    inp.oninput = () => (inp.size = Math.max(1, inp.value.length));
    inp.onblur = () => this.InputDone();
    inp.onkeydown = (ev) => {
      if (ev.key === "Enter") {
        inp.blur();
      }
    };
    inp.focus();
    this.Input = inp;
    this.Button.append(inp);
  }
}

export function GenerateReadOnly(name: string, code: string) {
  AllReadOnlys[name] = code;
  let newTabButton = document.createElement("button") as HTMLButtonElement;
  newTabButton.onclick = selectETab;
  newTabButton.innerText = name;
  newTabButton.setAttribute("style", "order:1;");
  newTabButton.setAttribute("data-target", name);
  newTabButton.className = "readonly";
  document.getElementById("editorButtons")!.append(newTabButton);
  var etab = document.createElement("div") as HTMLDivElement;
  etab.className = "etab";
  etab.setAttribute("data-target", name);
  var textarea = document.createElement("textarea") as HTMLTextAreaElement;
  etab.append(textarea);
  document.getElementById("editorTabs")!.appendChild(etab);
  var a = edit(textarea, { readOnly: true });
  editors[name] = a;
  a.setStyle("readonly");
  a.getSession().setValue(code);

  a.getSession().on("change", handleChange);
  a.setTheme("ace/theme/github");
  a.getSession().setMode("ace/mode/brainchild");
  (a.getSession().on as any)("guttermousedown", function (e: any) {
    var target = e.domEvent.target;
    if (target.className.indexOf("ace_gutter-cell") === -1) {
      return;
    }

    if (!a.isFocused()) {
      return;
    }

    if (e.clientX > 25 + target.getBoundingClientRect().left) {
      return;
    }

    var row = e.getDocumentPosition().row;
    var breakpoints = e.editor.session.getBreakpoints(row, 0);

    // If there's a breakpoint already defined, it should be removed, offering the toggle feature
    if (typeof breakpoints[row] === typeof undefined) {
      e.editor.session.setBreakpoint(row);
    } else {
      e.editor.session.clearBreakpoint(row);
    }

    e.stop();
  });
}

export default function App() {
  var [v] = useState(``);

  var asmRunning: boolean = false;
  var asmRunTimer: NodeJS.Timer | undefined = undefined;

  function ASMStep() {
    if (bsInterp !== undefined) {
      for (var id in editors) {
        let editor = editors[id];
        let prevMarkers = editor.session.getMarkers();
        if (prevMarkers) {
          let prevMarkersArr = Object.keys(prevMarkers);
          for (let item of prevMarkersArr) {
            if (prevMarkers[+item].clazz === "codePointer")
              editor.session.removeMarker(prevMarkers[+item].id);
          }
        }
      }
      bsInterp.Step();
      if (scope !== null) scope.RenderBSMemory(bsInterp);
      if (bsInterp.Output.length > 0) {
        let hadFocus =
          document.getElementById("output")! === document.activeElement;
        term.WriteAll(bsInterp.Output);
        bsInterp.Output = "";
        let rendered = term.Render();
        window.requestAnimationFrame(() => {
          document.getElementById("output")!.innerHTML = rendered;
        });
        if (hadFocus) document.getElementById("output")!.focus();
      }
      var codeText = document.getElementById("codeText")!;
      codeText.innerHTML = bsInterp.CodeWithPointerHighlight();
      if (bsInterp.InputPointer > 0) {
        bsInterp.Input = bsInterp.Input.substr(bsInterp.InputPointer);
        bsInterp.InputPointer = 0;
      }

      //codeText.querySelector("span")!.scrollIntoView();
      let span = codeText.querySelector("span")!;
      codeText.scrollTo(0, span.offsetTop - 600);
      Scope.CURRENT!.RenderBSMemory(bsInterp);
      editors[bsInterp.GetFile()].session.addMarker(
        new Range(bsInterp.GetLine(), 0, bsInterp.GetLine(), 1),
        "codePointer",
        "fullLine"
      );
    } else {
      bsInterp = new ASMInterpreter(
        (document.getElementById("codeBody") as HTMLTextAreaElement).value
      );
    }
  }

  function ASMRun(event: any) {
    asmRunning = !asmRunning;
    let breaks: [file: string, line: number][] = [];
    for (let file in editors) {
      let breakPoints = editors[file].session.getBreakpoints();
      for (let line in breakPoints) {
        breaks.push([file, +line]);
      }
    }
    let breakIPs = new Set<number>();
    for (let i = 0; i < bsInterp!.Heap.length; i++) {
      if (breaks.length === 0) break;
      let f = bsInterp!.GetFileFroM(i);
      if (breaks.findIndex((c) => c[0] === f) === -1) {
        while (i < bsInterp!.Heap.length && bsInterp!.GetFileFroM(i) === f) {
          i++;
        }
        i--;
        continue;
      }
      let l = bsInterp!.GetLineFrom(i);
      if (breaks.findIndex((c) => c[1] === l) === -1) {
        while (i < bsInterp!.Heap.length && bsInterp!.GetLineFrom(i) === l) {
          i++;
        }
        i--;
        continue;
      }
      for (let j = 0; j < breaks.length; j++) {
        let b = breaks[j];
        if (b[0] === f && b[1] === l) {
          breaks.splice(j, 1);
          breakIPs.add(i);
          break;
        }
      }
    }
    if (asmRunning) {
      event.target.innerHTML = "⏸";
      document.getElementById("bf")!.classList.add("running");
      asmRunTimer = setInterval(() => {
        PushEvent(Event.Frame);
        if (bsInterp !== undefined) {
          for (var id in editors) {
            let editor = editors[id];
            let prevMarkers = editor.session.getMarkers();
            if (prevMarkers) {
              let prevMarkersArr = Object.keys(prevMarkers);
              for (let item of prevMarkersArr) {
                if (prevMarkers[+item].clazz === "codePointer")
                  editor.session.removeMarker(prevMarkers[+item].id);
              }
            }
          }
          document.getElementById("bf")!.classList.remove("running");
          let t = Date.now();
          while (Date.now() < t + 1000 / 60) {
            bsInterp.Step();
            if (breakIPs.has(bsInterp.IP)) {
              event.target.innerHTML = "⏵";
              document.getElementById("bf")!.classList.remove("running");
              Scope.CURRENT!.RenderBSMemory(bsInterp);
              if (bsInterp.Output.length > 0) {
                let hadFocus =
                  document.getElementById("output")! === document.activeElement;
                term.WriteAll(bsInterp.Output);
                bsInterp.Output = "";
                let rendered = term.Render();
                window.requestAnimationFrame(() => {
                  document.getElementById("output")!.innerHTML = rendered;
                });
                if (hadFocus) document.getElementById("output")!.focus();
              }
              if (bsInterp.InputPointer > 0) {
                bsInterp.Input = bsInterp.Input.substr(bsInterp.InputPointer);
                bsInterp.InputPointer = 0;
              }
              let codeText = document.getElementById("codeText")!;
              codeText.innerHTML = bsInterp.CodeWithPointerHighlight();
              //codeText.querySelector("span")!.scrollIntoView();
              let span = codeText.querySelector("span")!;
              codeText.scrollTo(0, span.offsetTop - 600);
              asmRunning = false;
              clearInterval(asmRunTimer);
              break;
            }
            if (!bsInterp.running) break;
          }
          if (bsInterp.Output.length > 0) {
            let hadFocus =
              document.getElementById("output")! === document.activeElement;
            term.WriteAll(bsInterp.Output);
            bsInterp.Output = "";
            let rendered = term.Render();
            window.requestAnimationFrame(() => {
              document.getElementById("output")!.innerHTML = rendered;
            });
            if (hadFocus) document.getElementById("output")!.focus();
          }
          if (bsInterp.InputPointer > 0) {
            bsInterp.Input = bsInterp.Input.substr(bsInterp.InputPointer);
            bsInterp.InputPointer = 0;
          }
          if (!bsInterp.running) {
            document.getElementById("bf")!.classList.remove("running");
            Scope.CURRENT!.RenderBSMemory(bsInterp);
            editors[bsInterp.GetFile()].session.addMarker(
              new Range(bsInterp.GetLine(), 0, bsInterp.GetLine(), 1),
              "codePointer",
              "fullLine"
            );
            let codeText = document.getElementById("codeText")!;
            codeText.innerHTML = bsInterp.CodeWithPointerHighlight();
            let span = codeText.querySelector("span")!;
            codeText.scrollTo(0, span.offsetTop - 600);
          }
        } else {
          bsInterp = new ASMInterpreter(
            (document.getElementById("codeBody") as HTMLTextAreaElement).value
          );
        }
      }, 0);
    } else {
      event.target.innerHTML = "⏵";
      document.getElementById("bf")!.classList.remove("running");
      clearInterval(asmRunTimer);
      if (!bsInterp) return;
      Scope.CURRENT!.RenderBSMemory(bsInterp);
      editors[bsInterp.GetFile()].session.addMarker(
        new Range(bsInterp.GetLine(), 0, bsInterp.GetLine(), 1),
        "codePointer",
        "fullLine"
      );
      let codeText = document.getElementById("codeText")!;
      codeText.innerHTML = bsInterp.CodeWithPointerHighlight();
      //codeText.querySelector("span")!.scrollIntoView();
      let span = codeText.querySelector("span")!;
      codeText.scrollTo(0, span.offsetTop - 600);
    }
  }

  async function ASMReload() {
    let t = Date.now();
    let scope = await parseEditor();
    let parsed = scope.Assembly;
    console.log(`parsed in ${Date.now() - t}ms`);
    t = Date.now();
    parsed = Scope.ObliterateRedundancies(parsed);
    console.log(`optimized in ${Date.now() - t}ms`);
    t = Date.now();
    bsInterp = new ASMInterpreter(parsed);
    console.log(`compiled in ${Date.now() - t}ms`);
    document.getElementById("codeText")!.innerHTML = parsed.join("\n");
    scope.RenderBSMemory(bsInterp);
  }

  function ASMStepLine() {
    if (!bsInterp) return;
    for (var id in editors) {
      let editor = editors[id];
      let prevMarkers = editor.session.getMarkers();
      if (prevMarkers) {
        let prevMarkersArr = Object.keys(prevMarkers);
        for (let item of prevMarkersArr) {
          if (prevMarkers[+item].clazz === "codePointer")
            editor.session.removeMarker(prevMarkers[+item].id);
        }
      }
    }
    let line = bsInterp.GetLine();
    while (bsInterp.GetLine() === line && bsInterp.running) {
      bsInterp.Step();
    }
    Scope.CURRENT!.RenderBSMemory(bsInterp);
    editors[bsInterp.GetFile()].session.addMarker(
      new Range(bsInterp.GetLine(), 0, bsInterp.GetLine(), 1),
      "codePointer",
      "fullLine"
    );
    if (bsInterp.Output.length > 0) {
      let hadFocus =
        document.getElementById("output")! === document.activeElement;
      term.WriteAll(bsInterp.Output);
      bsInterp.Output = "";
      let rendered = term.Render();
      window.requestAnimationFrame(() => {
        document.getElementById("output")!.innerHTML = rendered;
      });
      if (hadFocus) document.getElementById("output")!.focus();
    }
    if (bsInterp.InputPointer > 0) {
      bsInterp.Input = bsInterp.Input.substr(bsInterp.InputPointer);
      bsInterp.InputPointer = 0;
    }
  }

  function newFile() {
    /*var newTabButton = (
      <button onClick={selectETab} data-target="" className="active">
        <input type="text"></input>
      </button>
    );*/
    new CustomTab();
  }

  function terminalClick(ev: any) {
    if (!term || !bsInterp) return;
    let col = ((ev.nativeEvent.offsetX / 457.438) * term.Width) | 0;
    let line = ((ev.nativeEvent.offsetY / 457.72) * term.Height) | 0;
    PushEvent(Event.Click, col, line);
  }

  function terminalKeyDown(ev: any) {
    if (!term || !bsInterp) return;
    PushEvent(
      Event.KeyDown,
      ev.key.length === 1 ? ev.key.charCodeAt(0) : 0,
      ev.keyCode
    );
  }
  function terminalKeyUp(ev: any) {
    if (!term || !bsInterp) return;
    PushEvent(
      Event.KeyUp,
      ev.key.length === 1 ? ev.key.charCodeAt(0) : 0,
      ev.keyCode
    );
  }

  return (
    <div className="App">
      <h1>BrainChild</h1>
      <div id="top">
        <div id="editors">
          <div id="editorButtons">
            <button
              onClick={selectETab}
              data-target="main.bc"
              className="active"
            >
              main.bc
            </button>
            <button onClick={newFile} style={{ order: 2 }}>
              +
            </button>
          </div>
          <div id="editorTabs">
            <div data-target="main.bc" className="etab active">
              <AceEditor
                onChange={handleChange}
                onLoad={addGutter("main.bc")}
                width="100%"
                height="457.44px"
                theme="github"
                mode="brainchild"
              ></AceEditor>
            </div>
          </div>
        </div>
        <div id="outputSide">
          <div id="actions">
            <button title="Start/Stop Execution" onClick={ASMRun} id="asmRun">
              ⏵
            </button>
            <button title="Step Assembly" onClick={ASMStep}>
              →
            </button>
            <button title="Step BrainChild" onClick={ASMStepLine}>
              ⏭
            </button>
            <button title="Restart Interpreter" onClick={ASMReload}>
              ↺
            </button>
          </div>
          <pre
            id="output"
            onClick={terminalClick}
            onKeyDown={terminalKeyDown}
            onKeyUp={terminalKeyUp}
            tabIndex={0}
          ></pre>
        </div>
      </div>
      <div id="bf">
        <div id="memory">
          <div id="tabBodies">
            <div data-target="baMemory" className="active tab"></div>
          </div>
        </div>
        <div id="code">
          <pre id="codeText">{v}</pre>
        </div>
      </div>
    </div>
  );
}
