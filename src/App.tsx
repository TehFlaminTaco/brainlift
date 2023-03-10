import "./styles.css";
import { MetaInterpreter, Transpile } from "./brainmeta";
import React, { useState, ChangeEvent, MouseEventHandler } from "react";
import { Interpreter } from "./bf";
import { ASMInterpreter, ASMTranspile } from "./brainasm";
import AceEditor from "react-ace";
import { Ace } from "ace-builds";
import "ace-builds/src-noconflict/theme-github";
import "ace-builds/src-noconflict/mode-lua";
import "./mode-brainchild";
import "./BrainChild/Types";
import "./BrainChild/vartype";
import { Parse } from "./BrainChild/brainchild";
import { Scope } from "./BrainChild/Scope";
import "./BrainChild/block";
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

var compiler = require("c-preprocessor");

export default function App() {
  var [v, setV] = useState(``);
  var bfInterp: Interpreter | undefined = undefined;
  var bmInterp: MetaInterpreter | undefined = undefined;
  var bsInterp: ASMInterpreter | undefined = undefined;
  var scope: Scope | null = null;
  var activeMemory = "baMemory";
  let editor: Ace.Editor;
  async function handleChange(value: string, event: ChangeEvent) {
    console.clear();
    try {
      console.log("compiling...");
      var t = Date.now();
      compiler.compile(
        value.replace(/\\\s*?\n/g, "\\\\n").replace(/\\\s*?$/g, ""),
        (err: any, result: string) => {
          if (err) return;
          try {
            console.log(`preprocessed in ${Date.now() - t}ms`);
            t = Date.now();
            scope = Parse(result);
            var parsed = scope.Assembly;
            console.log(`parsed in ${Date.now() - t}ms`);
            t = Date.now();
            parsed = Scope.ObliterateRedundancies(parsed);
            console.log(`optimized in ${Date.now() - t}ms`);
            t = Date.now();
            if (bfInterp === undefined && bmInterp === undefined) {
              bsInterp = new ASMInterpreter(parsed);
              console.log(`compiled in ${Date.now() - t}ms`);
              document.getElementById("codeText")!.innerHTML =
                parsed.join("\n");
              scope.RenderBSMemory(bsInterp);
            } else if (bfInterp !== undefined) {
              let compiledResult = ASMTranspile(parsed.join("\n"));
              var bfCode = Transpile(compiledResult);
              bmInterp = undefined;
              bfInterp = new Interpreter(bfCode);
              document.getElementById("codeText")!.innerHTML =
                bfInterp.CodeWithPointerHighlight();
              bfInterp.RenderMemory(activeMemory);
            } else if (bmInterp !== undefined) {
              let compiledResult = ASMTranspile(parsed.join("\n"));
              bmInterp = new MetaInterpreter(compiledResult);
              bfInterp = undefined;
              document.getElementById("codeText")!.innerHTML =
                bmInterp.CodeWithPointerHighlight();
              bmInterp.RenderMemory(activeMemory);
            }
          } catch (e: any) {
            document.getElementById(
              "codeText"
            )!.innerHTML = `<span class='error'>${e.stack}</span>`;
          }
        }
      );
    } catch (e) {
      console.log(e);
      return;
    }
  }

  function doStep() {
    if (bsInterp !== undefined) {
      bmInterp = bsInterp.ToMeta();
      bsInterp = undefined;
    }
    if (bfInterp !== undefined) {
      bfInterp.Step();
      document.getElementById("codeText")!.innerHTML =
        bfInterp.CodeWithPointerHighlight();
      bfInterp.RenderMemory(activeMemory);
      document.getElementById("output")!.innerText = bfInterp.Output;
    } else if (bmInterp !== undefined) {
      bfInterp = bmInterp.ToBF();
      document.getElementById("codeText")!.innerHTML =
        bfInterp.CodeWithPointerHighlight();
      bfInterp.RenderMemory(activeMemory);
      bmInterp = undefined;
    }
  }

  function metaStep() {
    if (bsInterp !== undefined) {
      bmInterp = bsInterp.ToMeta();
      bsInterp = undefined;
    }
    if (bfInterp !== undefined) {
      bmInterp = MetaInterpreter.FromBF(bfInterp);
      document.getElementById("codeText")!.innerHTML =
        bmInterp.CodeWithPointerHighlight();
      bmInterp.RenderMemory(activeMemory);
      bfInterp = undefined;
    } else if (bmInterp !== undefined) {
      bmInterp.Step();
      document.getElementById("codeText")!.innerHTML =
        bmInterp.CodeWithPointerHighlight();
      document.getElementById("output")!.innerText = bmInterp.Output;
      bmInterp.RenderMemory(activeMemory);
    }
  }

  function metaStep10() {
    if (bsInterp !== undefined) {
      bmInterp = bsInterp.ToMeta();
      bsInterp = undefined;
    }
    if (bfInterp !== undefined) {
      bmInterp = MetaInterpreter.FromBF(bfInterp);
      document.getElementById("codeText")!.innerHTML =
        bmInterp.CodeWithPointerHighlight();
      bmInterp.RenderMemory(activeMemory);
      bfInterp = undefined;
    } else if (bmInterp !== undefined) {
      for (var i = 0; i < 10; i++) {
        bmInterp.Step();
      }
      document.getElementById("codeText")!.innerHTML =
        bmInterp.CodeWithPointerHighlight();
      document.getElementById("output")!.innerText = bmInterp.Output;
      bmInterp.RenderMemory(activeMemory);
    }
  }

  var running: boolean = false;
  var asmRunning: boolean = false;
  var runTimer: NodeJS.Timer | undefined = undefined;
  var asmRunTimer: NodeJS.Timer | undefined = undefined;
  function metaRun(event: any) {
    running = !running;
    if (running) {
      if (asmRunning) {
        clearInterval(asmRunTimer);
        asmRunTimer = undefined;
        asmRunning = false;
        document.getElementById("asmRun")!.innerText = "ASM Run";
      }
      event.target.innerText = "Meta Running";
      runTimer = setInterval(() => {
        if (bsInterp !== undefined) {
          bmInterp = bsInterp.ToMeta();
          bsInterp = undefined;
        }
        if (bfInterp !== undefined) {
          bmInterp = MetaInterpreter.FromBF(bfInterp);
          document.getElementById("codeText")!.innerHTML =
            bmInterp.CodeWithPointerHighlight();
          bmInterp.RenderMemory(activeMemory);
          bfInterp = undefined;
        } else if (bmInterp !== undefined) {
          for (var i = 0; i < 1000; i++) {
            bmInterp.Step();
          }
          document.getElementById("codeText")!.innerHTML =
            bmInterp.CodeWithPointerHighlight();
          document.getElementById("output")!.innerText = bmInterp.Output;
          bmInterp.RenderMemory(activeMemory);
        }
      }, 100);
    } else {
      event.target.innerText = "Meta Run";
      clearInterval(runTimer);
    }
  }

  function ASMStep() {
    if (bsInterp !== undefined) {
      bsInterp.Step();
      if (scope!==null) scope.RenderBSMemory(bsInterp);
      document.getElementById("output")!.innerText = bsInterp.Output;
      document.getElementById("codeText")!.innerHTML =
        bsInterp.CodeWithPointerHighlight();
    } else {
      bfInterp = undefined;
      bmInterp = undefined;
      bsInterp = new ASMInterpreter(
        (document.getElementById("codeBody") as HTMLTextAreaElement).value
      );
    }
  }

  function ASMRun(event: any) {
    asmRunning = !asmRunning;
    if (asmRunning) {
      if (running) {
        clearInterval(runTimer);
        runTimer = undefined;
        running = false;
        document.getElementById("metaRun")!.innerText = "Meta Run";
      }
      event.target.innerText = "ASM Running";
      asmRunTimer = setInterval(() => {
        if (bsInterp !== undefined) {
          for (var i = 0; i < 1000; i++) {
            bsInterp.Step();
            // Check breakpoint
            let line = bsInterp.LineMap[bsInterp.IP];
            var breakPoints = editor.session.getBreakpoints();
            if (breakPoints[line]) {
              event.target.innerText = "ASM Run";
              scope!.RenderBSMemory(bsInterp);
              document.getElementById("output")!.innerText = bsInterp.Output;
              document.getElementById("codeText")!.innerHTML =
                bsInterp.CodeWithPointerHighlight();
              asmRunning = false;
              clearInterval(asmRunTimer);
              break;
            }
            if (!bsInterp.running) break;
          }
          scope!.RenderBSMemory(bsInterp);
          document.getElementById("output")!.innerText = bsInterp.Output;
        } else {
          bfInterp = undefined;
          bmInterp = undefined;
          bsInterp = new ASMInterpreter(
            (document.getElementById("codeBody") as HTMLTextAreaElement).value
          );
        }
      }, 100);
    } else {
      event.target.innerText = "ASM Run";
      clearInterval(asmRunTimer);
    }
  }

  function addGutter(e: Ace.Editor) {
    editor = e;
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
  }

  function selectTab(event: any) {
    var target = (event.target as HTMLButtonElement).dataset.target!;
    document
      .querySelectorAll("#tabButtons button")
      .forEach((c) => c.classList.remove("active"));
    document
      .querySelector('#tabButtons button[data-target="' + target + '"]')
      ?.classList.add("active");
    document
      .querySelectorAll("div.tab")
      .forEach((c) => c.classList.remove("active"));
    document
      .querySelector('div.tab[data-target="' + target + '"]')
      ?.classList.add("active");
    activeMemory = target;
    if (bsInterp !== undefined) {
      bsInterp.RenderMemory(activeMemory);
    } else if (bfInterp !== undefined) {
      bfInterp.RenderMemory(activeMemory);
    } else if (bmInterp !== undefined) {
      bmInterp.RenderMemory(activeMemory);
    }
  }
  return (
    <div className="App">
      <h1>BrainLift</h1>
      <h2>Uplifting BF into a usable language!</h2>
      <AceEditor
        onChange={handleChange}
        onLoad={addGutter}
        width="100%"
        theme="github"
        mode="brainchild"
      ></AceEditor>
      <div id="bf">
        <div id="code">
          <div id="actions">
            <button onClick={doStep}>Step</button>
            <button onClick={metaStep}>Meta Step</button>
            <button onClick={metaStep10}>Meta Step x10</button>
            <button onClick={metaRun} id="metaRun">
              Meta Run
            </button>
            <br />
            <button onClick={ASMStep}>ASM Step</button>
            <button onClick={ASMRun} id="asmRun">
              ASM Run
            </button>
          </div>
          <pre id="codeText">{v}</pre>
        </div>
        <div id="memory">
          <div id="tabButtons">
            <button onClick={selectTab} data-target="bfMemory">
              bf
            </button>
            <button onClick={selectTab} data-target="bfbmMemory">
              brainmeta
            </button>
            <button
              onClick={selectTab}
              className="active"
              data-target="baMemory"
            >
              brainasm
            </button>
          </div>
          <div id="tabBodies">
            <div data-target="bfMemory" className="tab"></div>
            <div data-target="bfbmMemory" className="tab"></div>
            <div data-target="baMemory" className="active tab"></div>
          </div>
        </div>
      </div>
      <pre id="output"></pre>
    </div>
  );
}
