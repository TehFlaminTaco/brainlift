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
import { ASMOnly, Parse } from "./BrainChild/brainchild";
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
import "./BrainChild/using";
import "./BrainChild/defer";
import "./BrainChild/cast";
import { TokenError } from "./BrainChild/token";
import { GenerateReadOnlys } from "./ReadOnlys";
import { Terminal, Event } from "./Terminal";
import { Obliterate } from "./obliterate";
const pako = require("pako");

export const AllReadOnlys: {[name: string]: string} = {};

// MAJOR, MINOR, HOTFIX
// MAJOR versions implement large changes that are likely to break most older programs
// MINOR will likely work with older programs with minimal retooling, and include notable changes.
// HOTFIX will work with most previous versions, or may be updating a previous MINOR revision to work with older MINOR revisions.
export const VERSION = "1.0.0";

var bsInterp: ASMInterpreter | undefined = undefined;
var scope: Scope | null = null;
let editors: { [path: string]: Ace.Editor } = {};
let term: Terminal;
let SimpleIO: boolean = false;

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
  };
  (document.getElementById("asmRun") as HTMLButtonElement).innerHTML = "<i class=\"fa-solid fa-play\"></i>";
  term = new Terminal();
  if(!SimpleIO){
    let rendered = term.Render();
    window.requestAnimationFrame(() => {
      document.getElementById("output")!.innerHTML = rendered;
    });
  }
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

function UpdateURL(){
  if('history'in window){
    let userFiles: {[key:string]:string} = {};
    for(let file in editors){
      if (file in AllReadOnlys) continue;
      userFiles[file] = editors[file].getValue();
    }
    let codeParam = compress(JSON.stringify(userFiles));
    let url = new URL(window.location as any as string);
    url.searchParams.set("code", codeParam);
    if(SimpleIO)
      url.searchParams.set("simpleio", (document.getElementById("simpleIOInput") as HTMLTextAreaElement).value)
    else
      url.searchParams.delete("simpleio");
    window.history.pushState(null, "", url);
  }
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

let ASMOnlyBytes: Uint8Array = new Uint8Array();
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
      UpdateURL();
      (document.querySelector("h1") as HTMLElement).textContent = "BrainChild";
      console.log("compiling...");
      var t = Date.now();
      try {
        let scope = await parseEditor();
        var parsed = scope.Assembly;
        console.log(`parsed in ${Date.now() - t}ms`);
        t = Date.now();
        parsed = Obliterate(parsed);//Scope.ObliterateRedundancies(parsed);
        console.log(`optimized in ${Date.now() - t}ms`);
        t = Date.now();
        bsInterp = new ASMInterpreter(parsed);
        if(ASMOnly){
          (document.querySelector("h1") as HTMLElement).textContent = "BrainChild ASM";
          ASMOnlyBytes = new Uint8Array(bsInterp.Heap.length);
          for(let i=0; i < bsInterp.Heap.length; i++)
            ASMOnlyBytes[i] = bsInterp.Heap[i];
        }
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

function toggleSimpleIO(){
  setSimpleIO(!SimpleIO);
  UpdateURL()
}

function setSimpleIO(val: boolean){
  SimpleIO = val;
  if(SimpleIO){
    setupSimpleIO();
    (document.getElementById("simpleIOButton") as HTMLButtonElement).innerHTML = "<i class=\"fa-solid fa-keyboard\"></i>";
  }else{
    (document.getElementById("output") as HTMLDivElement).innerHTML = term?.Render()??"";
    (document.getElementById("simpleIOButton") as HTMLButtonElement).innerHTML = "<i class=\"fa-solid fa-terminal\"></i>";
  }
}

function setupSimpleIO(){
  let simpleIOWrapper = document.createElement("div") as HTMLDivElement;
  simpleIOWrapper.className = "simpleIO";
  let iHeader = document.createElement("H2") as HTMLHeadingElement;
  let inp = document.createElement("textarea") as HTMLTextAreaElement;
  let oHeader = document.createElement("H2") as HTMLHeadingElement;
  let outp = document.createElement("textarea") as HTMLTextAreaElement;
  inp.id = "simpleIOInput";
  iHeader.textContent = "Input";
  outp.id = "simpleIOOutput";
  oHeader.textContent = "Output";
  let outputArea = document.getElementById("output") as HTMLDivElement;
  outputArea.innerHTML = "";

  inp.addEventListener("blur", ()=>{
    if(bsInterp && SimpleIO)
        bsInterp.Input = inp.value;
    UpdateURL()
  })

  simpleIOWrapper.append(iHeader);
  simpleIOWrapper.append(inp);
  simpleIOWrapper.append(oHeader);
  simpleIOWrapper.append(outp);
  outputArea.append(simpleIOWrapper);
}
let gutterLock = false;
function addGutter(file: string) {
  return function (e: Ace.Editor) {
    GenerateReadOnlys();
    let search = new URL(window.location as any as string).searchParams;
    if (search.has("code")) {
      let inp = search.has("simpleio") ? search.get("simpleio")! : false;
      var decompressed = new TextDecoder().decode(decompress(search.get("code")!));
      var unrolled = JSON.parse(decompressed);
      e.setValue(unrolled["main.bc"]);
      if(!gutterLock){
        gutterLock=true;
        for (let file in unrolled) {
          if (file === "main.bc") continue;
          new CustomTab(file, unrolled[file]);
        }
        setTimeout(()=>{
          (document.querySelector("button[data-target='main.bc']") as HTMLButtonElement).click()
          gutterLock=false;
        },60)
        if(file==="main.bc"&& inp !== false){
          setTimeout(()=>{
          setSimpleIO(true);
          (document.getElementById("simpleIOInput") as HTMLTextAreaElement).value = inp as string;
          UpdateURL();
          },0);
        }
      }
    } else {
      e.setValue(`include term.bc;
include extmacros.bc;
include rand.bc;

metamethod get_X(pVec2 this) -> int { (this -> int)%0x10000 }
metamethod get_Y(pVec2 this) -> int { (this -> int)/0x10000 }
metamethod add(pVec2 a, pVec2 b) -> pVec2 { ( ((((a->int)%0x10000)+((b->int)%0x10000))%0x10000) + ((((a->int)/0x10000)*0x10000)+(((b->int)/0x10000)*0x10000)) -> pVec2) }
metamethod sub(pVec2 a, pVec2 b) -> pVec2 { ( ((((a->int)%0x10000)-((b->int)%0x10000))%0x10000) + ((((a->int)/0x10000)*0x10000)-(((b->int)/0x10000)*0x10000)) -> pVec2) }
metamethod eq(pVec2 a, pVec2 b) -> int { (a->int)==(b->int) }
abstract class pVec2 {
    static function Make(int x, int y) -> pVec2 { ((x%0x10000) + (y*0x10000) -> pVec2) }
    static function WithX(pVec2 this, int x) -> pVec2 { ((x%0x10000) + (((this->int)/0x10000)*0x10000) -> pVec2) }
    static function WithY(pVec2 this, int y) -> pVec2 { (((this->int)%0x10000)+ (y*0x10000) -> pVec2) }
}

pVec2 apple = pVec2.Make(0xFF,0xFF);

@pVec2 DirectionVectors = new pVec2[] {
    (0xFFFF0000 -> pVec2),
    (0x00000001 -> pVec2),
    (0x00010000 -> pVec2),
    (0x0000FFFF -> pVec2)
};
@int DirectionHeads = new int[]{'^','>','v','<'}

metamethod truthy(Body this)->int{
    return (this -> int);
}
class Body {
    pVec2 Pos;
    pVec2 LastPos;
    Body Tail;
    
    function Move(pVec2 pos){
        this.LastPos = this.Pos;
        if(this.Tail)this.Tail.Move(this.Pos);
        this.Pos = pos;
    }
    
    function MoveBy(pVec2 amount){
        this.Move(this.Pos + amount);
    }
    
    function Grow(){
        if(this.Tail)return this.Tail.Grow();
        this.Tail = new Body(this.LastPos);
    }
    
    function Draw(){
        if(this.Tail)this.Tail.Draw();
        Term.Cursor.X = this.Pos.X;
        Term.Cursor.Y = this.Pos.Y;
        putchar('#');
    }
    
    new (pVec2 pos){
        this.LastPos = pos;
        this.Pos = pos;
    }
}

class Snake {
    int Direction;
    Body body;
    new (pVec2 pos){
        this.Direction = 1;
        this.body = new Body(pos);
    }
    function Draw(){
        this.body.Draw();
        Term.Cursor.X = this.body.Pos.X;
        Term.Cursor.Y = this.body.Pos.Y;
        putchar(DirectionHeads + this.Direction);
    }
    function Grow()
        this.body.Grow();
    function MoveBy(pVec2 delta)
        this.body.MoveBy(delta);
    
}

int score = 0;
function GameOver(){
    Term.Clear();
    Term.Style.Fore = Red;
    Term.Style.Bold = 1;
    Term.Cursor.X = 27;
    Term.Cursor.Y = 15;
    Term.Write("GAME  OVER");
    Term.Cursor.X = 28;
    Term.Cursor.Y = 16;
    Term.Write("SCORE: ");
    Term.WriteNum(score);
    asm {halt}
}

Snake snake = new Snake(pVec2.Make(32, 16));
snake.Grow();
snake.Grow();
snake.Grow();

int frame = 0;
int counter = 0;
int grace = 3;
Term.PollEvents();
Term.Frame.Push(()=>{
    seed(counter,rand());
    rand();
    if(apple.X > 63){
        var a = (rand() -> pVec2);
        apple = pVec2.Make(a.X%64, 1 + (a.Y%31));
    }
    if(frame++ >= 2 + (2*!(snake.Direction%2))){
        snake.MoveBy((*(DirectionVectors + snake.Direction) -> pVec2));
        frame = 0;
    }
    if(snake.body.Pos == apple){
        score++;
        snake.Grow();
        var a = (rand() -> pVec2);
        apple = pVec2.Make(a.X%64, 1 + (a.Y%31));
    }
    if(grace)grace--
    else{
        var b = snake.body.Tail;
        while(b){
            if(snake.body.Pos == b.Pos){
                GameOver();
            }
            b = b.Tail;
        }
    }
    if(snake.body.Pos.X > 63){GameOver();}
    if(snake.body.Pos.Y > 31){GameOver();}
    if(snake.body.Pos.Y < 1){GameOver();}
    Term.Clear();
    Term.Cursor.Reset();
    Term.Style.Back = White;
    Term.Style.Fore = Black;
    Term.Write("                                                                ");
    Term.Cursor.Reset();
    Term.Write("SCORE: ");
    Term.WriteNum(score);
    Term.Style.Back = Black;
    Term.Style.Fore = White;
    Term.Cursor.X = apple.X;
    Term.Cursor.Y = apple.Y;
    putchar('a');
    snake.Draw();
});

Term.KeyDown.Push((int h, int l) => {
    if(h=='w')if(1 == snake.Direction%2)return snake.Direction = 0;
    if(h=='d')if(0 == snake.Direction%2)return snake.Direction = 1;
    if(h=='s')if(1 == snake.Direction%2)return snake.Direction = 2;
    if(h=='a')if(0 == snake.Direction%2)return snake.Direction = 3;
    return
})

while(1){counter++;Term.PollEvents();}`);
    }

    if(SimpleIO)
      setupSimpleIO();

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
    if (code !== null)
      textarea.value = code;
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
    setTimeout(()=>{
    if(name !== null){
      inp.value = name;
      this.InputDone();
    }},30);
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
    editButton.innerHTML = "<i class=\"fa-solid fa-pencil\"></i>";
    editButton.onclick = () => this.Edit();
    var deleteButton = document.createElement("a");
    deleteButton.innerHTML = "<i class=\"fa-solid fa-delete-left\"></i>";
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
      if (!SimpleIO && bsInterp.Output.length > 0) {
        let hadFocus =
          document.getElementById("output")! === document.activeElement
        term.WriteAll(bsInterp.Output);
        bsInterp.Output = "";
        let rendered = term.Render();
        window.requestAnimationFrame(() => {
          document.getElementById("output")!.innerHTML = rendered;
        });
        if (hadFocus) document.getElementById("output")!.focus();
      }else if(SimpleIO){
        document.getElementById("simpleIOOutput")!.textContent = bsInterp.Output;
      }
      var codeText = document.getElementById("codeText")!;
      codeText.innerHTML = bsInterp.CodeWithPointerHighlight();
      if (!SimpleIO && bsInterp.InputPointer > 0) {
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
    if(bsInterp && !bsInterp.running){
      bsInterp = new ASMInterpreter(bsInterp.Code);
    }
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
      document.getElementById("asmRun")!.innerHTML = "<i class=\"fa-solid fa-stop\"></i>";
      document.getElementById("bf")!.classList.add("running");
      if(bsInterp && SimpleIO)bsInterp.Input = (document.getElementById("simpleIOInput") as HTMLTextAreaElement).value;
      asmRunTimer = setInterval(() => {
        if(!(bsInterp?.running ?? false))
          return;
        if(!SimpleIO)
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
              document.getElementById("asmRun")!.innerHTML = "<i class=\"fa-regular fa-circle-play\"></i>";
              document.getElementById("bf")!.classList.remove("running");
              Scope.CURRENT!.RenderBSMemory(bsInterp);
              if (!SimpleIO && bsInterp.Output.length > 0) {
                let hadFocus =
                  document.getElementById("output")! === document.activeElement;
                term.WriteAll(bsInterp.Output);
                bsInterp.Output = "";
                let rendered = term.Render();
                window.requestAnimationFrame(() => {
                  document.getElementById("output")!.innerHTML = rendered;
                });
                if (hadFocus) document.getElementById("output")!.focus();
              }else if(SimpleIO){
                document.getElementById("simpleIOOutput")!.textContent = bsInterp.Output;
              }
              if (!SimpleIO && bsInterp.InputPointer > 0) {
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
          if (!SimpleIO && bsInterp.Output.length > 0) {
            let hadFocus =
              document.getElementById("output")! === document.activeElement;
            term.WriteAll(bsInterp.Output);
            bsInterp.Output = "";
            let rendered = term.Render();
            window.requestAnimationFrame(() => {
              document.getElementById("output")!.innerHTML = rendered;
            });
            if (hadFocus) document.getElementById("output")!.focus();
          }else if(SimpleIO){
            document.getElementById("simpleIOOutput")!.textContent = bsInterp.Output;
          }
          if (!SimpleIO && bsInterp.InputPointer > 0) {
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
          if(SimpleIO)
            bsInterp.Input = (document.getElementById("simpleIOInput") as HTMLTextAreaElement).value;
        }
      }, 0);
    } else {
      document.getElementById("asmRun")!.innerHTML = "<i class=\"fa-solid fa-play\"></i>";
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
    parsed = Obliterate(parsed);//Scope.ObliterateRedundancies(parsed);
    console.log(`optimized in ${Date.now() - t}ms`);
    t = Date.now();
    bsInterp = new ASMInterpreter(parsed);
    if(SimpleIO)
      bsInterp.Input = (document.getElementById("simpleIOInput") as HTMLTextAreaElement).value;
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
    if (!SimpleIO && bsInterp.Output.length > 0) {
      let hadFocus =
        document.getElementById("output")! === document.activeElement;
      term.WriteAll(bsInterp.Output);
      bsInterp.Output = "";
      let rendered = term.Render();
      window.requestAnimationFrame(() => {
        document.getElementById("output")!.innerHTML = rendered;
      });
      if (hadFocus) document.getElementById("output")!.focus();
    }else if(SimpleIO){
      document.getElementById("simpleIOOutput")!.textContent = bsInterp.Output;
    }
    if (!SimpleIO && bsInterp.InputPointer > 0) {
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
    if (!term || !bsInterp || SimpleIO) return;
    let col = ((ev.nativeEvent.offsetX / 457.438) * term.Width) | 0;
    let line = ((ev.nativeEvent.offsetY / 457.72) * term.Height) | 0;
    PushEvent(Event.Click, col, line);
  }

  function terminalKeyDown(ev: any) {
    if (!term || !bsInterp || SimpleIO) return;
    PushEvent(
      Event.KeyDown,
      ev.key.length === 1 ? ev.key.charCodeAt(0) : 0,
      ev.keyCode
    );
  }
  function terminalKeyUp(ev: any) {
    if (!term || !bsInterp || SimpleIO) return;
    PushEvent(
      Event.KeyUp,
      ev.key.length === 1 ? ev.key.charCodeAt(0) : 0,
      ev.keyCode
    );
  }

  function DownloadBytecode(){
    if(!bsInterp) return;
    let bytecode = bsInterp.Heap;
    let byteArr = new Uint8Array(bytecode);
    let blob = new Blob([byteArr], {type: 'application/octet-stream'});
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = 'bytecode.bc';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    setTimeout(() => {
      document.body.removeChild(a);
    }, 0);
  }

  // Copy a CMC answer in the form `[BrainChild](https://github.com/tehflamintaco/brainlift), ${n} byte${"s"|""}. [`${main.code}`](${permalink})`
  function CopyCMC(){
    let mainCode = editors["main.bc"].getValue()
    let userFiles: {[key:string]:string} = {};
    for(let file in editors){
      if (file in AllReadOnlys) continue;
      userFiles[file] = editors[file].getValue();
    }
    let codeParam = compress(JSON.stringify(userFiles));
    let url = new URL(window.location as any as string);
    url.searchParams.set("code", codeParam);
    if(SimpleIO)
      url.searchParams.set("simpleio", (document.getElementById("simpleIOInput") as HTMLTextAreaElement).value)
    else
      url.searchParams.delete("simpleio");
    if(ASMOnly){
      let code = [...ASMOnlyBytes].map(c=>c.toString(16).toUpperCase().padStart(2,"0")).join(' ');
      let byteCount = ASMOnlyBytes.length;
      let textToCopy = `[BrainChild ASM](https://github.com/tehflamintaco/brainlift), ${byteCount} byte${byteCount === 1 ? '' : 's'}. [\`${code}\`](${url})`;
      navigator.clipboard.writeText(textToCopy);
    }else{
      let encoder = new TextEncoder();
      let byteCount = encoder.encode(mainCode).length;
      let textToCopy = `[BrainChild](https://github.com/tehflamintaco/brainlift), ${byteCount} byte${byteCount === 1 ? '' : 's'}. [\`${mainCode}\`](${url})`;
      navigator.clipboard.writeText(textToCopy);
    }
  }

  /*
    Copy a Code-golf answer in the form of
      # [BrainChild](https://github.com/tehflamintaco/brainlift), ${n} byte${"s"|"n"}
      
        main.code

      [Try It Online!](${permalink})
  */
  function CopyCodegolf(){
    let mainCode = editors["main.bc"].getValue()
    let userFiles: {[key:string]:string} = {};
    for(let file in editors){
      if (file in AllReadOnlys) continue;
      userFiles[file] = editors[file].getValue();
    }
    let codeParam = compress(JSON.stringify(userFiles));
    let url = new URL(window.location as any as string);
    url.searchParams.set("code", codeParam);
    if(SimpleIO)
      url.searchParams.set("simpleio", (document.getElementById("simpleIOInput") as HTMLTextAreaElement).value)
    else
      url.searchParams.delete("simpleio");
    if(ASMOnly){
      let hex = ASMInterpreter.RenderHeapPlain(ASMOnlyBytes).replace(/^/mg,"\t");
      let byteCount = ASMOnlyBytes.length;
      let textToCopy = `# [BrainChild ASM](https://github.com/tehflamintaco/brainlift), ${byteCount} byte${byteCount === 1 ? '' : 's'}\n\n${mainCode.replace(/^/mg, "\t")}\n\n## Hex-dump of bytecode\n\n${hex}\n[Try It Online!](${url})`;
      navigator.clipboard.writeText(textToCopy);
      return;
    }
    let encoder = new TextEncoder();
    let byteCount = encoder.encode(mainCode).length;
    let textToCopy = `# [BrainChild](https://github.com/tehflamintaco/brainlift), ${byteCount} byte${byteCount === 1 ? '' : 's'}\n\n${mainCode.replace(/^/mg, "\t")}\n\n[Try It Online!](${url})`;
    navigator.clipboard.writeText(textToCopy);
  }
  
  fetch("../version.txt", {cache: "no-cache"}).then(c=>c.text().then(txt=>{
    if(txt.match(/^[\d.]+$/) && txt != VERSION){
      (document.getElementById("updateHeader") as any).innerHTML = `v${VERSION} - Latest version is v${txt} - Click <a href="#" onclick="window.location=(''+window.location).replace('${VERSION}','${txt}')">HERE</a> to try it out`
    }else{
      (document.getElementById("updateHeader") as any).innerHTML = `v${VERSION}`
    }
  }))

  return (
    <div className="App">
      <title>BrainChild</title>
      <h1>BrainChild</h1>
      <div id="updateHeader"></div>
      <div id="top">
        <div id="editors">
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
              <i className="fa-solid fa-play"></i>
            </button>
            <button title="Step Assembly" onClick={ASMStep}>
              <i className="fa-solid fa-forward-step"></i>
            </button>
            <button title="Step BrainChild" onClick={ASMStepLine}>
              <i className="fa-solid fa-forward-fast"></i>
            </button>
            <button title="Restart Interpreter" onClick={ASMReload}>
              <i className="fa-solid fa-clock-rotate-left"></i>
            </button>
            <span className='buttonPadding'></span>
            <button title="Terminal/Simple IO" onClick={toggleSimpleIO} id="simpleIOButton">
              <i className="fa-solid fa-terminal"></i>
            </button>
            <button title="Copy Codegolf Answer" onClick={CopyCodegolf}>
              <i className="fa-solid fa-golf-ball-tee"></i>
            </button>
            <button title="Copy CMC Answer" onClick={CopyCMC}>
              <i className="fa-solid fa-clipboard"></i>
            </button>
            <button title="Download Bytecode" onClick={DownloadBytecode}>
              <i className="fa-solid fa-download"></i>
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
        <div id="editorButtons">
          <button
            onClick={selectETab}
            data-target="main.bc"
            className="active"
          >
            main.bc
          </button>
          <button onClick={newFile} style={{ order: 2 }}>
            <i className="fa-solid fa-plus"></i>
          </button>
        </div>
        <div id="memory">
          <div id="tabBodies">
            <div data-target="baMemory" className="tab"></div>
            <div data-target="baHeap" className="tab"></div>
          </div>
        </div>
        <div id="code">
          <pre id="codeText">{v}</pre>
        </div>
      </div>
    </div>
  );
}
