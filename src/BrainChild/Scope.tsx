import { Guid } from "js-guid";
import { TypeDefinition } from "./Types";
import { Claimer } from "./brainchild";
import { VarType, FuncType } from "./vartype";
import { ASMInterpreter } from "../brainasm";
import { Token } from "./token";

// Metamethod stuff //
let simpleAdd: string[] = [`apopb`, `apopa`, `addab`, `apushb`];
let simpleSub: string[] = [`apopb`, `apopa`, `subba`, `apusha`];
let simpleMul: string[] = [`apopb`, `apopa`, `mulab`, `apushb`];
let simpleDiv: string[] = [`apopb`, `apopa`, `divab`, `apusha`];
let simpleMod: string[] = [`apopb`, `apopa`, `divab`, `apushb`];
let simpleDivMod: string[] = [`apopb`, `apopa`, `divab`, `apusha`, `apushb`];
let simpleLt: string[] = [`apopb`, `apopa`, `cmp`, `apushb`];
let simpleGt: string[] = [`apopb`, `apopa`, `cmp`, `apusha`];
let simpleEq: string[] = [`apopb`, `apopa`, `cmp`, `addba`, `nota`, `apusha`];
let simpleNe: string[] = [`apopb`, `apopa`, `cmp`, `addba`, `apusha`];
let simpleUnm: string[] = [`apopb`, `seta 0`, `subab`, `apushb`];
let simpleUnp: string[] = [];
let simpleNot: string[] = [`apopa`, `nota`, `apusha`];

var simpleOps: [string, string[]][] = [
  ["add", simpleAdd],
  ["sub", simpleSub],
  ["mul", simpleMul],
  ["div", simpleDiv],
  ["mod", simpleMod],
  ["lt", simpleLt],
  ["gt", simpleGt],
  ["eq", simpleEq],
  ["ne", simpleNe],
];
// End of Metamethod Stuff //

export class Scope {
  static CURRENT: Scope;
  Vars: {
    [Identifier: string]: [
      Type: VarType,
      AssembledName: string,
      ConstantValue: null | number
    ];
  } = {};
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

  private ScratchLabel: string|null = null;
  MaxScratchRequired: number = 0;
  GetScratch(size: number): string {
    if(this.Parent) return this.Parent.GetScratch(size);
    this.MaxScratchRequired = Math.max(this.MaxScratchRequired, size);
    return this.ScratchLabel ??= this.GetSafeName("scratch");
  }

  // Metamethods are By name, and by FuncType.
  // Collisions are forbidden
  SoftInitilizedMetamethods: VarType[] = [];
  MetaMethods: {
    [name: string]: [
      ReturnTypes: VarType[],
      ArgTypes: VarType[],
      Code: string[],
      GenericArgs: string[]
    ][];
  } = {};

  SetupIntMetamethods() {
    simpleOps.forEach((c) => {
      this.AddMetamethodSoft(
        c[0],
        [VarType.Int],
        [VarType.Int, VarType.Int],
        c[1]
      );
    });
    this.AddMetamethodSoft(
      "divmod",
      [VarType.Int, VarType.Int],
      [VarType.Int, VarType.Int],
      simpleDivMod
    );
    this.AddMetamethodSoft("truthy", [VarType.Int], [VarType.Int], []);
    this.AddMetamethodSoft("not", [VarType.Int], [VarType.Int], simpleNot);
    this.AddMetamethodSoft("unm", [VarType.Int], [VarType.Int], simpleUnm);
    this.AddMetamethodSoft("unp", [VarType.Int], [VarType.Int], simpleUnp);
  }

  TryFallbacks(
    name: string,
    argTypes: VarType[]
  ): [ReturnTypes: VarType[], ArgTypes: VarType[], Code: string[]] | null {
    var inverses = [
      ["eq", "ne"],
      ["lt", "ge"],
      ["gt", "le"],
      ["truthy", "not"],
    ];
    for (let i = 0; i < inverses.length; i++) {
      let inv = inverses[i];
      if (name === inv[0]) {
        try {
          let other = this.GetMetamethod(inv[1], argTypes, false);
          if (other !== null && VarType.AllEquals(other[0], [VarType.Int])) {
            let newMethod = other[2].concat(`apopa`, `nota`, `apusha`);
            return [other[0], other[1], newMethod];
          }
        } catch (e) {
          return null;
        }
      } else if (name === inv[1]) {
        try {
          let other = this.GetMetamethod(inv[0], argTypes, false);
          if (other !== null && VarType.AllEquals(other[0], [VarType.Int])) {
            let newMethod = other[2].concat(`apopa`, `nota`, `apusha`);
            return [other[0], other[1], newMethod];
          }
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  }

  SoftInit(t: VarType) {
    // Used to register common Metamethods. Ugly hack, (Ofc)
    if (t.TypeName === "int" && t.PointerDepth === 0) {
      this.SetupIntMetamethods();
      return;
    }
    if (t instanceof FuncType) {
      this.AddMetamethodSoft("truthy", [VarType.Int], [t], []);
      return;
    }
    if (t.PointerDepth > 0) {
      let t1 = t.WithDeltaPointerDepth(-1);
      // Same as basic math, but with Pointers.
      simpleOps.forEach((c) => {
        this.AddMetamethodSoft(c[0], [t], [t, VarType.Int], c[1]);
        this.AddMetamethodSoft(c[0], [t], [VarType.Int, t], c[1]);
        this.AddMetamethodSoft(c[0], [t], [VarType.VoidPtr, t], c[1]);
        this.AddMetamethodSoft(c[0], [t], [t, VarType.VoidPtr], c[1]);
      });
      this.AddMetamethodSoft(
        "divmod",
        [t, VarType.Int],
        [t, VarType.Int],
        simpleDivMod
      );
      this.AddMetamethodSoft(
        "divmod",
        [t, VarType.Int],
        [VarType.Int, t],
        simpleDivMod
      );
      this.AddMetamethodSoft(
        "divmod",
        [t, VarType.Int],
        [VarType.VoidPtr, t],
        simpleDivMod
      );
      this.AddMetamethodSoft(
        "divmod",
        [t, VarType.Int],
        [t, VarType.VoidPtr],
        simpleDivMod
      );
      this.AddMetamethodSoft("truthy", [VarType.Int], [t], []);
      this.AddMetamethodSoft("not", [VarType.Int], [t], simpleNot);
      this.AddMetamethodSoft("unm", [t], [t], simpleUnm);
      this.AddMetamethodSoft("unp", [t], [t], simpleUnp);
      this.AddMetamethodSoft("getindex", [t.WithDeltaPointerDepth(-1)], [t, VarType.Int],
        t1.IsWide()
        ? [`apopa`, `setb ${t1.GetDefinition().Size}`, `mulba`, `apopb`, `addba`, ...t1.Get('a', 'a')]
        : ["apopa", "apopb", "addab", "ptrb", "apushb"]);
      this.AddMetamethodSoft("setindex", [t.WithDeltaPointerDepth(-1)], [t, VarType.Int, t.WithDeltaPointerDepth(-1)],
        t1.IsWide()
        ? [`REM Wide set metamethod`, ...t1.FlipAB(), `apopa`, `setb ${t1.GetDefinition().Size}`, `mulba`, `apopb`, `addab`, ...t1.FlipBA(), ...t1.Put("a","b"), `REM end wide set metamethod`]
        : ["apopa", "bpusha", "apopa", "apopb", "addab", "bpopa", "bpusha", "putaptrb", "bpopa", "apusha"]);
      this.AddMetamethodSoft("ptrindex", [t], [t, VarType.Int],
        t1.IsWide()
        ? [`apopa`, `setb ${t1.GetDefinition().Size}`, `mulba`, `apopb`, `addba`, `apusha`]
        : simpleAdd);
      return;
    }
  }

  RemapGenericMetamethod(
    mm: [
      ReturnTypes: VarType[],
      ArgTypes: VarType[],
      Code: string[],
      GenericArgs: string[]
    ],
    inTypes: VarType[],
    exactly: boolean
  ): [
    ReturnTypes: VarType[],
    ArgTypes: VarType[],
    Code: string[],
    GenericArgs: string[]
  ] {
    if (mm[3].length === 0) return mm;
    var genericifiedMap: { [generic: string]: VarType } = {};
    let failed: boolean = false;
    let argTypes: VarType[] = [];
    let returnTypes: VarType[] = [];
    // Iterate through inTypes, if the metamethod ArgTypes is a generic, and the inType is a specific type, replace the generic with the specific type and add it to the map
    // If it's already in the map, check that one coaxes into the other, and simplify if possible
    // If they don't coax, fail.
    // Recurse through the generic arguments of each type as well.
    // Finally, apply the same mapping to the metamethod's ReturnTypes
    // And return the modified metamethod.
    let trySwap = function (inMM: VarType, inType: VarType): VarType {
      if (failed) return inMM;
      if (mm[3].includes(inMM.TypeName)) {
        // If inMM pointerDepth is greater than 0, then this will 'mess' with our mapping. So we have to adjust the map according.
        // Check if it's already in the map
        if (inMM.TypeName in genericifiedMap) {
          let mapped = genericifiedMap[inMM.TypeName].WithDeltaPointerDepth(
            inMM.PointerDepth
          );
          // If we can coax/equal to directly to what's in the map, return that
          if (
            exactly
              ? mapped.Equals(inType)
              : VarType.CanCoax([mapped], [inType])
          ) {
            return mapped;
          }
          // If what's in the map can coax/equal to what we have, update the map and return the new type
          // Frustratingly, I think we have to do 2 passes to ensure all the casts are called correctly later.
          if (
            exactly
              ? inType.Equals(mapped)
              : VarType.CanCoax([inType], [mapped])
          ) {
            genericifiedMap[inMM.TypeName] = inType.WithDeltaPointerDepth(
              -inMM.PointerDepth
            );
            return inType;
          }
          failed = true;
          return inMM;
        }
        // Otherwise, we're adding it to the map
        genericifiedMap[inMM.TypeName] = inType.WithDeltaPointerDepth(
          -inMM.PointerDepth
        );
        return inType;
      }

      // Check that a is b to the precision of exactly
      if (
        !(exactly ? inMM.Equals(inType) : VarType.CanCoax([inMM], [inType]))
      ) {
        failed = true;
        return inMM;
      }
      // Recurse through the generic arguments of each type as well.
      if (inMM.Generics.length > 0) {
        let newGenericArgs: VarType[] = [];
        for (
          let i = 0;
          i < Math.min(inMM.Generics.length, inType.Generics.length);
          i++
        ) {
          newGenericArgs.push(trySwap(inMM.Generics[i], inType.Generics[i]));
        }
        return inMM.WithGenerics(newGenericArgs);
      }
      return inMM;
    };
    // Used to modify returnTypes after the fact
    let forceSwap = function (inMM: VarType): VarType {
      if (mm[3].includes(inMM.TypeName)) {
        if (inMM.TypeName in genericifiedMap) {
          return genericifiedMap[inMM.TypeName].WithDeltaPointerDepth(
            inMM.PointerDepth
          );
        }
      }
      if (inMM.Generics.length > 0) {
        let newGenericArgs: VarType[] = [];
        for (let i = 0; i < inMM.Generics.length; i++) {
          newGenericArgs.push(forceSwap(inMM.Generics[i]));
        }
        return inMM.WithGenerics(newGenericArgs);
      }
      return inMM;
    };
    if (mm[1].length !== inTypes.length) {
      failed = true;
      return mm;
    }
    // The first loop is done to ensure all types are mapped to their least-generic form.
    for (let i = 0; i < mm[1].length; i++) {
      trySwap(mm[1][i], inTypes[i]);
      if (failed) return mm;
    }
    // This loop generates argTypes
    for (let i = 0; i < mm[1].length; i++) {
      argTypes.push(trySwap(mm[1][i], inTypes[i]));
      if (failed)
        // Impossible?
        return mm;
    }
    // This loop generates returnTypes
    for (let i = 0; i < mm[0].length; i++) {
      returnTypes.push(forceSwap(mm[0][i]));
    }
    return [returnTypes, argTypes, mm[2], []];
  }

  GetMetamethod(
    name: string,
    argTypes: VarType[],
    canFallback: boolean = true,
    exactly: boolean = false
  ): [ReturnTypes: VarType[], ArgTypes: VarType[], Code: string[]] | null {
    // Check all ArgTypes for SoftInitilizedMetamethods, if they aren't there yet, add them and run SoftInit on the type
    argTypes
      .filter((c: VarType) => !this.SoftInitilizedMetamethods.includes(c))
      .forEach((c: VarType) => {
        this.SoftInit(c);
        this.SoftInitilizedMetamethods.push(c);
      });
    var mm = this.MetaMethods[name];
    if (mm === undefined)
      return canFallback ? this.TryFallbacks(name, argTypes) : null;
    mm = mm.map((c) => this.RemapGenericMetamethod(c, argTypes, exactly));
    mm = mm.filter((c) => c[3].length === 0); // Anything with generics failed to map
    mm = mm.filter((c) =>
      exactly
        ? VarType.AllEquals(c[1], argTypes)
        : VarType.CanCoax(c[1], argTypes)[0]
    );
    if (mm.length === 0)
      return canFallback ? this.TryFallbacks(name, argTypes) : null;
    mm.sort(
      (a, b) =>
        VarType.CountMatches(b[1], argTypes) -
        VarType.CountMatches(a[1], argTypes)
    );
    var bestMatch = VarType.CountMatches(mm[0][1], argTypes);
    mm = mm.filter((c) => VarType.CountMatches(c[1], argTypes) === bestMatch);
    if (mm.length > 1)
      throw new Error(
        `Ambiguous Metamethod: ${name} Received: ${argTypes} Options: ${mm
          .map((c) => "[" + c[0].join(",") + "]")
          .join("m")}`
      );
    return [mm[0][0], mm[0][1], mm[0][2]];
  }
  AddMetamethodSoft(
    name: string,
    retTypes: VarType[],
    argTypes: VarType[],
    code: string[]
  ) {
    this.MetaMethods[name] = this.MetaMethods[name] ?? [];
    // Check if any metamethod already exists with this signature
    for (let i = 0; i < this.MetaMethods[name].length; i++) {
      if (
        VarType.AllEquals(this.MetaMethods[name][i][1], argTypes) &&
        (name === "cast"
          ? VarType.AllEquals(this.MetaMethods[name][i][0], retTypes)
          : true)
      ) {
        return;
      }
    }
    this.MetaMethods[name].push([retTypes, argTypes, code, []]);
  }

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
      ...`putchar:
    apopa
    writea
    ret
getchar:
    reada
    apusha
    ret
vAllocTable: db 0
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
    freeType.ArgTypes = [VarType.Void];
    freeType.RetTypes = [];
    let putcharType = new FuncType(falseClaimer, falseFlag);
    putcharType.ArgTypes = [VarType.Int];
    putcharType.RetTypes = [];
    let getcharType = new FuncType(falseClaimer, falseFlag);
    getcharType.ArgTypes = [];
    getcharType.RetTypes = [VarType.Int];
    this.Set("alloc", allocType, false);
    this.Set("free", freeType, false);
    this.Set("putchar", putcharType, false);
    this.Set("getchar", getcharType, false);
    var allocV = this.Get("alloc");
    var freeV = this.Get("free");
    var putcharV = this.Get("putchar");
    var getcharV = this.Get("getchar");
    this.Assembly.push(`${allocV[1]}: db alloc`);
    this.Assembly.push(`${freeV[1]}: db free`);
    this.Assembly.push(`${putcharV[1]}: db putchar`);
    this.Assembly.push(`${getcharV[1]}: db getchar`);
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

  Get(
    Identifier: string
  ): [Type: VarType, AssembledName: string, ConstantValue: number | null] {
    if(Identifier === "_")
      return [VarType.Discard, "", 0];
    var o = this.Vars[Identifier] ?? this.Parent?.Get(Identifier);
    if (!o) {
      throw new Error(`Unknown identifier ${Identifier}`);
    }
    return o;
  }

  Set(Identifier: string, Type: VarType, setup: boolean = true): string {
    if (Type.TypeName === "discard") setup = false;
    var name = this.GetSafeName(`var${Type}${Identifier}`);
    this.Vars[Identifier] = [Type, name, null];
    let typeDef = Type.GetDefinition();
    if (setup) this.Assembly.push(`${name}: db ${typeDef.Wide ? new Array(typeDef.Size).fill('0').join(',') : 0}`);
    this.AllVars[name] = [
      Type,
      Identifier,
      this.CurrentFile,
      this.CurrentFunction,
    ];
    return name;
  }

  SetConstant(
    Identifier: string,
    Type: VarType | null,
    val: number,
    force: boolean
  ): boolean {
    if (force) {
      if (Type === null)
        throw new Error("Must provide type when setting constant");
      let name = this.GetSafeName(`var${Type}${Identifier}`);
      this.Vars[Identifier] = [Type, name, val];
      return true;
    }
    if (Identifier in this.Vars) {
      let v = this.Vars[Identifier];
      if (v[2] === null) return false; // Cannot override non-constant
      v[2] = val;
      return true;
    }
    return this.Parent?.SetConstant(Identifier, Type, val, force) ?? false;
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
    subScope.MetaMethods = this.MetaMethods;
    subScope.SoftInitilizedMetamethods = this.SoftInitilizedMetamethods;
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

  static SimplyRedundant(line: string): boolean {
    // If Line is adda 0 or addb 0, it's redundant.
    if (line.match(/^\s*(adda|addb|suba|subb)\s+0\s*$/)) return true;

    return false;
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
    return assembly.filter(c=>!Scope.SimplyRedundant(c));
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
      name = `<b>function</b> ${f[1]}(<b>${funcType.ArgTypes.map((c) =>
        c.ToHTML()
      ).join("</b>, <b>")}</b>)`;
      if (funcType.RetTypes.length > 0)
        name += ` -> <b>${funcType.RetTypes.map((c) => c.ToHTML()).join(
          "</b>, <b>"
        )}</b>`;
    }
    let isGlobal = false;
    if (func.length === 0) {
      name = `<b>GLOBAL</b>`;
      isGlobal = true;
    }
    body += `${name} {<br>`;
    for (let i in vars) {
      let v = vars[i];
      if (v[2].startsWith("_")) continue;
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

        for (let ident in typeDef.VirtualChildren) {
          let child = typeDef.VirtualChildren[ident];
          childrenByOffset[child[2]] = [child[0], child[2], child[3], ident];
        }
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
