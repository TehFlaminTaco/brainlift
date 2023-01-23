import { VarType } from "./vartype";
import { Guid } from "js-guid";
import { TypeDefinition } from "./Types";
import { Claimer } from "./brainchild";
import { FuncType } from "./vartype";

export class Scope {
  static CURRENT: Scope;
  Vars: { [Identifier: string]: [Type: VarType, AssembledName: string] } = {};
  AllVars: { [Label: string]: [VarType, string] } = {};
  Parent: Scope | null = null;
  Assembly: string[] = [];
  Data: string[] = [];
  TakenLabels: { [label: string]: boolean } = {};
  CurrentRequiredReturns: VarType[] = [];
  IsFunctionScope: boolean = false;
  UserTypes: { [name: string]: TypeDefinition } = {};
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
    name = name.replace(/[^a-zA-Z_]+/g, "");
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
    this.AllVars[name] = [Type, Identifier];
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
    return subScope;
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

  static ObliterateRedundancies(assembly: string[]): string[] {
    for (var i = 0; i < assembly.length - 1; i++) {
      var shorter = this.CompressRedundancy(assembly[i], assembly[i + 1]);
      if (shorter !== null) {
        if (shorter.length === 0)
          return Scope.ObliterateRedundancies([
            ...assembly.slice(0, i),
            ...assembly.slice(i + 2),
          ]);
        else
          return Scope.ObliterateRedundancies([
            ...assembly.slice(0, i),
            shorter,
            ...assembly.slice(i + 2),
          ]);
      }
    }
    return assembly;
  }
}
