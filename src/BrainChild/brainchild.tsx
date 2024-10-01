/*
The cumulation of all this effort: BrainChild
C-Like which compiles to BrainASM

Typed. Inbuilt types are:
  void: An intentionally unknown type.
  int: a 16-bit integer
  *: a pointer to a type. Can be another pointer type.
  *?: a nullable type. Of indeterminate value.
  func(type, ...)->type, ...: a pointer to a function with a known signature

Ptr works like c's ptr:
  int* a
  (func(a,b,c)->d)* a
  int**** help

*/

import { Statement } from "./statement";
import { Scope } from "./Scope";
import { Class } from "./class";
import { TokenError } from "./token";
import { FakeToken } from "./faketoken";
import { Include } from "./include";
import { Macro } from "./macrodef";
import { VarType } from "./vartype";

export var Keywords = [
  "abstract",
  "asm",
  "class",
  "else",
  "func",
  "function",
  "if",
  "include",
  "int",
  "label",
  "macro",
  "metamethod",
  "new",
  "return",
  "static",
  "var",
  "void",
  "while",
];

export class Claim {
  Claimer: Claimer;
  Body: RegExpMatchArray | undefined;
  StartIndex: number;
  Success: boolean = false;
  constructor(
    claimer: Claimer,
    body: RegExpMatchArray | undefined,
    startIndex: number
  ) {
    this.Body = body;
    this.StartIndex = startIndex;
    this.Claimer = claimer;
    this.Success = body !== undefined;
  }

  Fail(refresh: boolean = false) {
    if (this.Success) {
      this.Success = refresh;
      this.Claimer.Ptr = Math.min(this.Claimer.Ptr, this.StartIndex);
    }
  }
}

export class Claimer {
  File: string;
  Code: string;
  Ptr: number = 0;
  Best: number = 0;
  Expecting: boolean = true;
  Expected: string = "";
  constructor(code: string, file: string = "") {
    this.Code = code;
    this.File = file;
  }

  Claim(reg: RegExp): Claim {
    this.Skip();
    if (this.Expecting) {
      this.Expected = reg.source;
      this.Expecting = false;
    }
    reg = new RegExp(reg.source, reg.flags + (reg.sticky ? "" : "y"));
    var match = this.Code.substring(this.Ptr).match(reg);
    if (!match) {
      return new Claim(this, undefined, this.Ptr);
    }
    var c = new Claim(this, match, this.Ptr);
    this.Ptr += match[0].length;
    if (this.Ptr > this.Best) {
      this.Best = this.Ptr;
      this.Expecting = true;
      this.Expected = "";
    }
    return c;
  }
  Flag(): Claim {
    var flag = new Claim(this, undefined, this.Ptr);
    flag.Success = true;
    return flag;
  }
  Skip() {
    var ws = this.Code.substring(this.Ptr).match(
      /^(\s|\/\/.*|\/\*(.|\s)*?\*\/)+/
    );
    if (ws) this.Ptr += ws[0].length;
  }
}

let CurrentFiles: { [file: string]: string } = {};
export var KnownCodes: { [file: string]: string } = {};
export function DoParse(f: string) {
  if (KnownCodes[f]) return;
  let code = CurrentFiles[f];
  if (!code) return;
  KnownCodes[f] = code;
  var claimer = new Claimer(code, f);
  let statements = [];
  var s = Statement.ClaimTopLevel(claimer);
  while (s !== null) {
    statements.push(s);
    claimer.Claim(/;/);
    s = Statement.ClaimTopLevel(claimer);
  }
  claimer.Skip();
  Include.Parsed[f] = statements;
  if (claimer.Ptr < code.length) {
    var badf00d = claimer.Flag();
    badf00d.StartIndex = claimer.Best;
    var fakeToken = new FakeToken(claimer, badf00d);
    throw new TokenError(
      [fakeToken],
      claimer.Expected.length === 0
        ? "Unexpected end of code."
        : `Unexpected token (Expected ${claimer.Expected})`
    );
  }
}

let waitTimeout: NodeJS.Timer | undefined = undefined;
export async function Parse(files: { [file: string]: string }): Promise<Scope> {
  CurrentFiles = files;
  return new Promise<Scope>((resolve, reject) => {
    if (waitTimeout) {
      clearInterval(waitTimeout);
      waitTimeout = undefined;
    }
    for (let l in KnownCodes) {
      if (files[l] !== KnownCodes[l]) {
        delete Include.Parsed[l];
        delete Include.Includes[l];
        delete KnownCodes[l];
        if (Macro.Macros[l]) {
          KnownCodes = {};
          Include.Parsed = {};
          Include.Includes = {};
          Macro.Macros = {};
          break;
        }
      }
    }
    VarType.CurrentGenericArgs = {};
    var scope = new Scope();
    Scope.CURRENT = scope;
    scope.Assembly.push(`file main.bc`);
    scope.Assembly.push(`jmp postdata`);
    scope.RequireAllocator();
    if (!files["main.bc"]) throw new Error("Expected entry file (main.bc)");
    for (var f in files) {
      if (KnownCodes[f]) continue;
      DoParse(f);
    }
    let typeDefs: Class[] = Include.Parsed["main.bc"].filter(
      (c) => c instanceof Class
    ) as Class[];
    let included: string[] = [];
    let scannables = ["main.bc"];
    while (scannables.length > 0) {
      let newScannables = new Set<string>();
      let t = typeDefs;
      scannables.forEach((s) => {
        included.push(s);
        if (!Include.Parsed[s])
          throw new Error(`Cannot find included file ${s}`);
        t.push(
          ...(Include.Parsed[s].filter((c) => c instanceof Class) as Class[])
        );
        var vincluded = Include.Parsed[s]
          .filter((c) => c instanceof Include)
          .map((c) => (c as Include).Path!);
        vincluded.forEach((j) => newScannables.add(j));
      });
      scannables = [...newScannables].filter((c) => !included.includes(c));
    }

    var curLength = 0;
    while (typeDefs.length > 0 && typeDefs.length !== curLength) {
      curLength = typeDefs.length;
      console.log(typeDefs);
      typeDefs = typeDefs.filter((c) => !c.TrySetup(scope));
    }
    if (typeDefs.length > 0) {
      console.log(typeDefs);
      throw new Error(
        `Failed to resolve types: ${typeDefs.map((c) => c.Name).join(", ")}`
      );
    }
    waitTimeout = setTimeout(() => {
      try {
        var o: string[] = [];
        for (var i = 0; i < Include.Parsed["main.bc"].length; i++) {
          o.push(...Include.Parsed["main.bc"][i].TryEvaluate(scope));
        }
        scope.Assembly.push("postdata:", ...o);
        scope.Assembly.push(`halt`);
        if (scope.UsingAllocator()) scope.Assembly.push(`aftercode: db 1, 0`);
        console.dir(Include.Parsed["main.bc"]);
        console.dir(scope);

        resolve(scope);
      } catch (e) {
        reject(e);
      }
    }, 300);
  });
}
