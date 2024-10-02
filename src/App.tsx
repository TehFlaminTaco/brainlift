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
import { TokenError } from "./BrainChild/token";
import { GenerateReadOnlys } from "./ReadOnlys";
import { Terminal, Event } from "./Terminal";

var bsInterp: ASMInterpreter | undefined = undefined;
var scope: Scope | null = null;
let editors: { [path: string]: Ace.Editor } = {};
let term: Terminal;

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
  document.getElementById("output")!.innerHTML = term.Render();
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
    e.setValue(`include term.bc;
include extmacros.bc;
include int.bc;
int seed = 1;

function rand() -> int {
    seed ~= (seed * 128);
    seed ~= (seed / 512);
    seed ~= (seed * 256);
    return seed;
}

void discard;

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

@int DirectionVectors = "ABCD"+1;
*(DirectionVectors+0) = 0xFFFF0000;
*(DirectionVectors+1) = 0x00000001;
*(DirectionVectors+2) = 0x00010000;
*(DirectionVectors+3) = 0x0000FFFF;
@int DirectionHeads = "^>v<"+1;

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
        Term.WriteChar('#');
    }
    
    new (pVec2 pos){
        this.LastPos = pos;
        this.Pos = pos;
    }
}

class Head : Body {
    int Direction;
    new (pVec2 pos){
        this.Direction = 1;
        this.Pos = pos;
        this.LastPos = pos;
    }
    function Draw(){
        if(this.Tail)this.Tail.Draw();
        Term.Cursor.X = this.Pos.X;
        Term.Cursor.Y = this.Pos.Y;
        Term.WriteChar(DirectionHeads + this.Direction);
    }
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

Head snake = new Head(pVec2.Make(32, 16));
snake.Grow();
snake.Grow();
snake.Grow();

int frame = 0;
int counter = 0;
int grace = 3;
Term.PollEvents();
Term.Frame.Push(()=>{
    seed += counter;
    rand();
    if(apple.X > 63){
        var a = (rand() -> pVec2);
        apple = pVec2.Make(a.X%64, 1 + (a.Y%31));
    }
    if(frame++ >= 2 + (2*!(snake.Direction%2))){
        snake.MoveBy((*(DirectionVectors + snake.Direction) -> pVec2));
        frame = 0;
    }
    if(snake.Pos == apple){
        score++;
        snake.Grow();
        var a = (rand() -> pVec2);
        apple = pVec2.Make(a.X%64, 1 + (a.Y%31));
    }
    if(grace)grace--
    else{
        var b = snake.Tail;
        while(b){
            if(snake.Pos == b.Pos){
                GameOver();
            }
            b = b.Tail;
        }
    }
    if(snake.Pos.X > 63){GameOver();}
    if(snake.Pos.Y > 31){GameOver();}
    if(snake.Pos.Y < 1){GameOver();}
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
    Term.WriteChar('a');
    snake.Draw();
});

Term.KeyDown.Push(function(int h, int l){
    if(h=='w')if(1 == snake.Direction%2)return snake.Direction = 0;
    if(h=='d')if(0 == snake.Direction%2)return snake.Direction = 1;
    if(h=='s')if(1 == snake.Direction%2)return snake.Direction = 2;
    if(h=='a')if(0 == snake.Direction%2)return snake.Direction = 3;
})

while(1){counter++;Term.PollEvents();}`);
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
  constructor() {
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
        document.getElementById("output")!.innerHTML = term.Render();
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
      codeText.scrollTo(0, span.scrollTop);
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
                document.getElementById("output")!.innerHTML = term.Render();
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
              codeText.scrollTo(0, span.scrollTop);
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
            document.getElementById("output")!.innerHTML = term.Render();
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
            codeText.scrollTo(0, span.scrollTop);
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
      codeText.scrollTo(0, span.scrollTop);
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
      document.getElementById("output")!.innerHTML = term.Render();
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
