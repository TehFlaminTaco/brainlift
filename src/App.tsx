import "./styles.css";
import { MetaInterpreter, Transpile } from "./brainmeta";
import React, { useState, ChangeEvent, MouseEventHandler } from "react";
import { Interpreter } from "./bf";
import { MAIN_LOOP, ASMInterpreter, ASMTranspile } from "./brainasm";
import AceEditor from "react-ace";
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
  var activeMemory = "baMemory";
  async function handleChange(value: string, event: ChangeEvent) {
    console.clear();
    try {
      compiler.compile(
        value.replace(/\\\s*?\n/g, "\\\\n").replace(/\\\s*?$/g, ""),
        (err: any, result: string) => {
          if (err) return;
          result = Scope.ObliterateRedundancies(Parse(result).Assembly).join(
            "\n"
          );
          var compiledResult = ASMTranspile(result);
          if (bfInterp === undefined && bmInterp === undefined) {
            bsInterp = new ASMInterpreter(result);
            document.getElementById("codeText")!.innerHTML = result;
            bsInterp.RenderMemory(activeMemory);
          } else if (bfInterp !== undefined) {
            var bfCode = Transpile(compiledResult);
            bmInterp = undefined;
            bfInterp = new Interpreter(bfCode);
            document.getElementById(
              "codeText"
            )!.innerHTML = bfInterp.CodeWithPointerHighlight();
            bfInterp.RenderMemory(activeMemory);
          } else if (bmInterp !== undefined) {
            bmInterp = new MetaInterpreter(compiledResult);
            bfInterp = undefined;
            document.getElementById(
              "codeText"
            )!.innerHTML = bmInterp.CodeWithPointerHighlight();
            bmInterp.RenderMemory(activeMemory);
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
      document.getElementById(
        "codeText"
      )!.innerHTML = bfInterp.CodeWithPointerHighlight();
      bfInterp.RenderMemory(activeMemory);
      document.getElementById("output")!.innerText = bfInterp.Output;
    } else if (bmInterp !== undefined) {
      bfInterp = bmInterp.ToBF();
      document.getElementById(
        "codeText"
      )!.innerHTML = bfInterp.CodeWithPointerHighlight();
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
      document.getElementById(
        "codeText"
      )!.innerHTML = bmInterp.CodeWithPointerHighlight();
      bmInterp.RenderMemory(activeMemory);
      bfInterp = undefined;
    } else if (bmInterp !== undefined) {
      bmInterp.Step();
      document.getElementById(
        "codeText"
      )!.innerHTML = bmInterp.CodeWithPointerHighlight();
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
      document.getElementById(
        "codeText"
      )!.innerHTML = bmInterp.CodeWithPointerHighlight();
      bmInterp.RenderMemory(activeMemory);
      bfInterp = undefined;
    } else if (bmInterp !== undefined) {
      for (var i = 0; i < 10; i++) {
        bmInterp.Step();
      }
      document.getElementById(
        "codeText"
      )!.innerHTML = bmInterp.CodeWithPointerHighlight();
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
        document.getElementById("asmRun").innerText = "ASM Run";
      }
      event.target.innerText = "Meta Running";
      runTimer = setInterval(() => {
        if (bsInterp !== undefined) {
          bmInterp = bsInterp.ToMeta();
          bsInterp = undefined;
        }
        if (bfInterp !== undefined) {
          bmInterp = MetaInterpreter.FromBF(bfInterp);
          document.getElementById(
            "codeText"
          )!.innerHTML = bmInterp.CodeWithPointerHighlight();
          bmInterp.RenderMemory(activeMemory);
          bfInterp = undefined;
        } else if (bmInterp !== undefined) {
          for (var i = 0; i < 1000; i++) {
            bmInterp.Step();
          }
          document.getElementById(
            "codeText"
          )!.innerHTML = bmInterp.CodeWithPointerHighlight();
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
      bsInterp.RenderMemory(activeMemory);
      document.getElementById("output")!.innerText = bsInterp.Output;
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
        document.getElementById("metaRun").innerText = "Meta Run";
      }
      event.target.innerText = "ASM Running";
      asmRunTimer = setInterval(() => {
        if (bsInterp !== undefined) {
          for (var i = 0; i < 1000; i++) {
            bsInterp.Step();
            if (!bsInterp.running) break;
          }
          bsInterp.RenderMemory(activeMemory);
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
