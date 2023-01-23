import "./styles.css";
import React, { useState, ChangeEvent, MouseEventHandler } from "react";
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
  var scope: Scope | null = null;
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
            document.getElementById("codeText")!.innerHTML = parsed.join("\n");
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
          <pre id="codeText">{v}</pre>
        </div>
      </div>
    </div>
  );
}
