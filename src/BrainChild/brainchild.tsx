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

export var Keywords = [
  "any",
  "asm",
  "class",
  "else",
  "func",
  "function",
  "if",
  "int",
  "label",
  "metamethod",
  "return",
  "void",
  "while"
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

  Fail() {
    if (this.Success) {
      this.Success = false;
      this.Claimer.Ptr = Math.min(this.Claimer.Ptr, this.StartIndex);
    }
  }
}

export class Claimer {
  Code: string;
  Ptr: number = 0;
  constructor(code: string) {
    this.Code = code;
  }

  Claim(reg: RegExp) {
    this.Skip();
    reg = new RegExp(reg.source, reg.flags + (reg.sticky ? "" : "y"));
    var match = this.Code.substring(this.Ptr).match(reg);
    if (!match) {
      return new Claim(this, undefined, this.Ptr);
    }
    var c = new Claim(this, match, this.Ptr);
    this.Ptr += match[0].length;
    return c;
  }
  Flag() {
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

export function Parse(code: string): Scope {
  var scope = new Scope();
  scope.Assembly.push(`jmp postdata`);
  var claimer = new Claimer(code);
  var statements = [];
  var s = Statement.ClaimTopLevel(claimer);
  while (s !== null) {
    statements.push(s);
    claimer.Claim(/;/);
    s = Statement.ClaimTopLevel(claimer);
  }
  var typeDefs: Class[] = statements.filter(
    (c) => c instanceof Class
  ) as Class[];
  var curLength = 0;
  while (typeDefs.length > 0 && typeDefs.length !== curLength) {
    curLength = typeDefs.length;
    console.log(typeDefs);
    typeDefs = typeDefs.filter((c) => !c.TrySetup(scope));
  }
  var o: string[] = [];
  for (var i = 0; i < statements.length; i++) {
    o.push(...statements[i].Evaluate(scope));
  }
  scope.Assembly.push("postdata:", ...o);
  scope.Assembly.push(`halt`);
  console.dir(statements);
  console.dir(scope);

  return scope;
}
