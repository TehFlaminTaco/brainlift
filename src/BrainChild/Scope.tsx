import { Guid } from "js-guid";
import { TypeDefinition } from "./Types";
import { Claimer } from "./brainchild";
import { VarType, FuncType } from "./vartype";
import { ASMInterpreter } from "../brainasm";
import { Token } from "./token";

export class Scope {
  static CURRENT: Scope;
  Vars: { [Identifier: string]: [Type: VarType, AssembledName: string] } = {};
  AllVars: {
    [Label: string]: [
      type: VarType,
      identifier: string,
      file: string,
      func: string
    ];
  } = {};
  Parent: Scope | null = null;
  Assembly: string[] = [];
  TakenLabels: { [label: string]: boolean } = {};
  CurrentFile: string = "main.bc";
  CurrentFunction: string = "";
  private CurrentRequiredReturns: VarType[] | null = [];
  IsFunctionScope: boolean = false;
  UserTypes: { [name: string]: TypeDefinition } = {};
  TypeInformation: [t: Token, types: VarType[]][] = [];
  private HasAllocator: boolean = false;

  UsingAllocator(): boolean {
    return (
      this.HasAllocator ||
      (this.Parent !== null ? this.Parent.UsingAllocator() : false)
    );
  }
  private SetAllocator() {
    this.HasAllocator = true;
    if (this.Parent) this.Parent.SetAllocator();
  }

  GetRequiredReturns(): VarType[] | null {
    if (!this.IsFunctionScope) return null;
    if (!this.Parent) return null;
    if (this.Parent.IsFunctionScope) return this.Parent.GetRequiredReturns();
    return this.CurrentRequiredReturns;
  }

  SetRequiredReturns(v: VarType[] | null) {
    if (!this.IsFunctionScope) return;
    if (!this.Parent) return;
    if (this.Parent.IsFunctionScope) {
      this.Parent.SetRequiredReturns(v);
      return;
    }
    this.CurrentRequiredReturns = v;
  }

  RequireAllocator() {
    if (this.UsingAllocator()) return;
    this.SetAllocator();
    var asm: string[] = [];
    asm.push(
      ...`vAllocTable: db 0
vAllocSize: db 0
alloc:
    seta vAllocTable
    setb aftercode
    putbptra
    seta vAllocSize
    apopb
    putbptra
    wAllocCond:
        seta vAllocTable
        ptra
        ptra
        jnza wAllocBody
        seta vAllocTable
        ptra
        inca
        ptra
        nota
        jnza wAllocDone
        seta vAllocTable
        ptra
        inca
        ptra
        setb vAllocSize
        ptrb
        addb 3
        cmp
        jnzb wAllocBody
        jmp wAllocDone
    wAllocBody:
        seta vAllocTable
        ptra
        setb vAllocTable
        ptrb
        incb
        ptrb
        addba
        adda 2
        setb vAllocTable
        putaptrb
        jmp wAllocCond
    wAllocDone:
    seta vAllocTable
    ptra
    inca
    ptra
    jnza fAllocSlip
    jmp fAllocSlipDone
    fAllocSlip:
        setb vAllocSize
        ptrb
        subba
        suba 2
        apusha
        seta vAllocTable
        ptra
        setb vAllocSize
        ptrb
        addba
        adda 2
        setb 0
        putbptra
        inca
        apopb
        putbptra
    fAllocSlipDone:
    seta vAllocTable
    ptra
    setb 1
    putbptra
    inca
    setb vAllocSize
    ptrb
    putbptra
    inca
    apusha
    ret

vFreeTable: db 0
vFreeTarget: db 0
vFreeLast: db 0
free:
    seta vFreeTable
    setb aftercode
    putbptra
    seta vFreeTarget
    apopb
    subb 2
    putbptra
    wFreeCond:
        seta vFreeTable
        ptra
        setb vFreeTarget
        ptrb
        cmp
        notb
        jnzb wFreeDone
        seta vFreeLast
        setb vFreeTable
        ptrb
        putbptra
        seta vFreeTable
        ptra
        setb vFreeTable
        ptrb
        incb
        ptrb
        addba
        adda 2
        setb vFreeTable
        putaptrb
        jmp wFreeCond
    wFreeDone:
    seta vFreeTable
    ptra
    setb vFreeTarget
    ptrb
    subab
    notb
    jnzb fFreeClear
    ret
    fFreeClear:
        seta vFreeTable
        ptra
        setb 0
        putbptra
        seta vFreeLast
        ptra
        ptra
        jnza fFreeDone
        seta vFreeTarget
        ptra
        inca
        ptra
        setb vFreeLast
        ptrb
        incb
        ptrb
        addab
        addb 2
        seta vFreeLast
        ptra
        inca
        putbptra
    fFreeDone:
    ret`.split("\n")
    );
    this.Assembly.push(...asm);
    var falseClaimer = new Claimer("");
    var falseFlag = falseClaimer.Flag();
    var allocType = new FuncType(falseClaimer, falseFlag);
    allocType.ArgTypes = [VarType.Int];
    allocType.RetTypes = [VarType.VoidPtr];
    var freeType = new FuncType(falseClaimer, falseFlag);
    freeType.ArgTypes = [VarType.VoidPtr];
    freeType.RetTypes = [];
    this.Set("alloc", allocType, false);
    this.Set("free", freeType, false);
    var allocV = this.Get("alloc");
    var freeV = this.Get("free");
    this.Assembly.push(`${allocV[1]}: db alloc`);
    this.Assembly.push(`${freeV[1]}: db free`);
  }

  GetSafeName(name: string) {
    name = name.replace(/[^a-zA-Z]+/g, "");
    let newName = name;
    while (this.TakenLabels[newName]) {
      newName = `${name}_${Guid.newGuid().toString().substr(0, 8)}`;
    }
    this.TakenLabels[newName] = true;
    return newName;
  }

  Get(Identifier: string): [Type: VarType, AssembledName: string] {
    var o = this.Vars[Identifier] ?? this.Parent?.Get(Identifier);
    if (!o) {
      throw new Error(`Unknown identifier ${Identifier}`);
    }
    return o;
  }

  Set(Identifier: string, Type: VarType, setup: boolean = true): string {
    var name = this.GetSafeName(`var${Type}${Identifier}`);
    this.Vars[Identifier] = [Type, name];
    if (setup) this.Assembly.push(`${name}: db 0`);
    this.AllVars[name] = [
      Type,
      Identifier,
      this.CurrentFile,
      this.CurrentFunction,
    ];
    return name;
  }

  Sub(): Scope {
    var subScope = new Scope();
    subScope.Parent = this;
    subScope.Assembly = this.Assembly;
    subScope.TakenLabels = this.TakenLabels;
    subScope.IsFunctionScope = this.IsFunctionScope;
    subScope.UserTypes = this.UserTypes;
    subScope.CurrentRequiredReturns = this.CurrentRequiredReturns;
    subScope.AllVars = this.AllVars;
    subScope.TypeInformation = this.TypeInformation;
    subScope.CurrentFunction = this.CurrentFunction;
    subScope.CurrentFile = this.CurrentFile;
    return subScope;
  }

  InformType(t: Token, types: VarType[]) {
    if (this.TypeInformation.filter((c) => c[0] === t).length) return;
    this.TypeInformation.push([t, types]);
  }

  GetFunctionVariables(): [
    Ident: string,
    Type: VarType,
    AssembledName: string
  ][] {
    if (!this.IsFunctionScope) return [];
    var o: [Ident: string, Type: VarType, AssembledName: string][] = [];
    var usedIdents: string[] = [];
    for (var ident in this.Vars) {
      usedIdents.push(ident);
      o.push([ident, this.Vars[ident][0], this.Vars[ident][1]]);
    }
    if (this.Parent) {
      var parentIdents = this.Parent.GetFunctionVariables();
      parentIdents
        .filter((c) => !usedIdents.includes(c[0]))
        .forEach((c) => {
          o.push(c);
          usedIdents.push(c[0]);
        });
    }
    return o;
  }

  DumpFunctionVariables(): string[] {
    var o: string[] = [];
    var vars = this.GetFunctionVariables();
    vars.sort((a, b) => a[2].localeCompare(b[2]));
    for (var i = 0; i < vars.length; i++) {
      o.push(`seta ${vars[i][2]}`, `ptra`, `bpusha`);
    }
    return o;
  }
  LoadFunctionVariables(): string[] {
    var o: string[] = [];
    var vars = this.GetFunctionVariables();
    vars.sort((a, b) => a[2].localeCompare(b[2]));
    for (var i = vars.length - 1; i >= 0; i--) {
      o.push(`seta ${vars[i][2]}`, `bpopb`, `putbptra`);
    }
    return o;
  }

  static CompressRedundancy(left: string, right: string): string | null {
    var padding = left.match(/^\s*/)![0];
    left = left.replace(/^\s*(.*?)\s*$/, "$1");
    right = right.replace(/^\s*(.*?)\s*$/, "$1");

    if (left === `apusha` && right === `apopa`) return ``;
    if (left === `bpusha` && right === `bpopa`) return ``;
    if (left === `apushb` && right === `apopb`) return ``;
    if (left === `bpushb` && right === `bpopb`) return ``;
    var m: RegExpMatchArray | null;
    m = left.match(/^seta\s+(.*)/);
    if (m && right === "apusha") return `${padding}apush ${m[1]}`;
    if (m && right === "bpusha") return `${padding}bpush ${m[1]}`;
    m = left.match(/^setb\s+(.*)/);
    if (m && right === "apushb") return `${padding}apush ${m[1]}`;
    if (m && right === "bpushb") return `${padding}bpush ${m[1]}`;
    m = left.match(/^apush\s+(.*)/);
    if (m && right === `apopa`) return `${padding}seta ${m[1]}`;
    if (m && right === `apopb`) return `${padding}setb ${m[1]}`;
    m = left.match(/^bpush\s+(.*)/);
    if (m && right === `bpopa`) return `${padding}seta ${m[1]}`;
    if (m && right === `bpopb`) return `${padding}setb ${m[1]}`;
    if (left.match(/^apush\s+/) && right === "apop") return "";
    if (left.match(/^bpush\s+/) && right === "bpop") return "";
    if ((left === "apusha" || left === "apushb") && right === "apop") return "";
    if ((left === "bpusha" || left === "bpushb") && right === "bpop") return "";

    return null;
  }

  static ObliterateRedundancies(
    assembly: string[],
    startFrom: number = 0
  ): string[] {
    if (startFrom < 0) startFrom = 0;
    for (var i = startFrom; i < assembly.length - 1; i++) {
      var shorter = this.CompressRedundancy(assembly[i], assembly[i + 1]);
      if (shorter !== null) {
        if (shorter.length === 0)
          return Scope.ObliterateRedundancies(
            [...assembly.slice(0, i), ...assembly.slice(i + 2)],
            i - 1
          );
        else
          return Scope.ObliterateRedundancies(
            [...assembly.slice(0, i), shorter, ...assembly.slice(i + 2)],
            i - 1
          );
      }
    }
    return assembly;
  }

  RenderFunction(
    bs: ASMInterpreter,
    func: string,
    vars: [label: string, type: VarType, ident: string][]
  ): string {
    let body = "";
    let f = this.AllVars[func];
    let name = `<b>function</b> ${func}`;
    if (f && f[0] instanceof FuncType) {
      let funcType = f[0] as FuncType;
      name = `<b>function</b> ${f[1]}(<b>${funcType.ArgTypes.map(c=>c.ToHTML()).join(
        "</b>, <b>"
      )}</b>)`;
      if (funcType.RetTypes.length > 0)
        name += ` -> <b>${funcType.RetTypes.map(c=>c.ToHTML()).join("</b>, <b>")}</b>`;
    }
    let isGlobal = false;
    if (func.length === 0) {
      name = `<b>GLOBAL</b>`;
      isGlobal = true;
    }
    body += `${name} {<br>`;
    for (let i in vars) {
      let v = vars[i];
      if (isGlobal) {
        if (v[1] instanceof FuncType) continue;
      }
      body += `\t${v[1]
        .Debug(this, bs, v[0], v[2], bs.Labels[v[0]])
        .replace(/<br>(?!$)/g, "<br>\t")}<br>`;
    }
    body += "}<br>";
    return body;
  }

  DebuggedVals: Set<number> = new Set();
  RenderBSMemory(bs: ASMInterpreter) {
    this.DebuggedVals = new Set();
    bs.RenderBSMemory();
    let body = `<br><div id='variables'>`;
    let varsByFileAndFunction: {
      [file: string]: {
        [func: string]: [label: string, type: VarType, ident: string][];
      };
    } = {};
    let classesByFile: {
      [file: string]: { [label: string]: [type: VarType, ident: string] };
    } = {};
    for (let label in this.AllVars) {
      let v = this.AllVars[label];
      if (!v) continue;
      if (!v[0]) continue;
      varsByFileAndFunction[v[2]] ??= {};
      classesByFile[v[2]] ??= {};
      if (v[0].TypeName === "type" + v[1]) {
        // A class.
        classesByFile[v[2]][label] = [v[0], v[1]];
      } else {
        varsByFileAndFunction[v[2]][v[3]] ??= [];
        varsByFileAndFunction[v[2]][v[3]].push([label, v[0], v[1]]);
      }
    }
    for (let file in varsByFileAndFunction) {
      let varsByFunction = varsByFileAndFunction[file];
      body += `${file}<br>`;
      if (varsByFunction[""]) {
        body += this.RenderFunction(bs, "", varsByFunction[""]);
        delete varsByFunction[""];
      }
      for (let label in classesByFile[file]) {
        let cls = classesByFile[file][label];
        let typeDef = cls[0].GetDefinition();
        body += `<b>class</b> ${cls[1]} {<br>`;
        let childrenByOffset: [VarType, number, string, string][] = [];

        for (let ident in typeDef.Children) {
          let child = typeDef.Children[ident];
          childrenByOffset[child[1]] = [child[0], child[1], child[2], ident];
        }
        for (let i = 0; i < childrenByOffset.length; i++) {
          let child = childrenByOffset[i];
          if (!child) continue;
          if (child[3] === "new" || child[3] === "base") continue;
          if (child[0] instanceof FuncType && varsByFunction[child[2]]) {
            body += `\t${this.RenderFunction(
              bs,
              child[2],
              varsByFunction[child[2]]
            ).replace(/<br>(?!$)/g, "<br>\t")}`;
            delete varsByFunction[child[2]];
          } else {
            //body += `\t<b>${child[0]}</b> ${child[3]} = ${child[2]}<br>`;
            body +=
              "\t" +
              child[0]
                .Debug(
                  this,
                  bs,
                  "",
                  child[3],
                  bs.Labels[typeDef.ClassLabel] + child[1]
                )
                .replace(/<br>(?!$)/g, "<br>\t") +
              "<br>";
          }
        }
        body += "}<br>";
      }
      for (let func in varsByFunction) {
        this.DebuggedVals.add(bs.Labels[func]);
        body += this.RenderFunction(bs, func, varsByFunction[func]);
      }
    }
    body = body.replace(/\{(\s*<br>)*\s*\}/g, "{}");
    body += "</div>";
    body += bs.RenderHeap();
    document.querySelector('div.tab[data-target="baMemory"]')!.innerHTML +=
      body;
  }
}
