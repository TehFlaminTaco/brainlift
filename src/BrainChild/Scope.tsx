import { Guid } from "js-guid";
import { TypeDefinition, TypeVoid } from "./Types";
import { Claimer } from "./brainchild";
import { VarType, FuncType } from "./vartype";
import { ASMInterpreter } from "../brainasm";
import { Token } from "./token";
import { Include } from "./include";
import { Obliterate } from "../obliterate";

// Metamethod stuff //
let simpleAdd: string[] = [`xpopb`, `xpopa`, `addab`, `xpushb`];
let simpleSub: string[] = [`xpopb`, `xpopa`, `subba`, `xpusha`];
let simpleMul: string[] = [`xpopb`, `xpopa`, `mulab`, `xpushb`];
let simpleDiv: string[] = [`xpopb`, `xpopa`, `divab`, `xpusha`];
let simpleMod: string[] = [`xpopb`, `xpopa`, `divab`, `xpushb`];
let simpleDivMod: string[] = [`xpopb`, `xpopa`, `divab`, `xpusha`, `xpushb`];
let simpleLt: string[] = [`xpopb`, `xpopa`, `cmp`, `xpushb`];
let simpleGt: string[] = [`xpopb`, `xpopa`, `cmp`, `xpusha`];
let simpleEq: string[] = [`xpopb`, `xpopa`, `cmp`, `addba`, `nota`, `xpusha`];
let simpleNe: string[] = [`xpopb`, `xpopa`, `cmp`, `addba`, `xpusha`];
let simpleUnm: string[] = [`xpopb`, `seta 0`, `subab`, `xpushb`];
let simpleUnp: string[] = [];
let simpleNot: string[] = [`xpopa`, `nota`, `xpusha`];

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
  Vars: Map<string, [
      Type: VarType,
      AssembledName: string,
      ConstantValue: null | number
    ]> = new Map();
  AllVars: Map<string,[
      type: VarType,
      identifier: string,
      file: string,
      func: string
    ]> = new Map();
  Parent: Scope | null = null;
  Assembly: string[] = [];
  TakenLabels: { [label: string]: boolean } = {};
  CurrentFile: string = "main.bc";
  CurrentFunction: string = "";
  Deferred: string[] = [];

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
      GenericArgs: string[],
      File: string
    ][];
  } = {};

  FastMMCache: Map<string, Map<string, [ReturnTypes: VarType[], ArgTypes: VarType[], Code: string[]]>> = new Map();
  SlowMMCache: Map<string, Map<string, [ReturnTypes: VarType[], ArgTypes: VarType[], Code: string[]]>> = new Map();

  SetupIntMetamethods() {
    let oldFile = this.CurrentFile;
    this.CurrentFile = "GLOBAL";
    try {simpleOps.forEach((c) => {
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
    } finally {
      this.CurrentFile = oldFile;
    }
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
          let other = this.GetMetamethod(inv[1], argTypes, {canFallback: false});
          if (other !== null && VarType.AllEquals(other[0], [VarType.Int])) {
            let newMethod = other[2].concat(`xpopa`, `nota`, `xpusha`);
            return [other[0], other[1], newMethod];
          }
        } catch (e) {
          return null;
        }
      } else if (name === inv[1]) {
        try {
          let other = this.GetMetamethod(inv[0], argTypes, {canFallback: false});
          if (other !== null && VarType.AllEquals(other[0], [VarType.Int])) {
            let newMethod = other[2].concat(`xpopa`, `nota`, `xpusha`);
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
    let oldFile = this.CurrentFile;
    this.CurrentFile = "GLOBAL";
    try {
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
          ? [`xpopa`, `setb ${t1.GetDefinition().Size}`, `mulba`, `xpopb`, `addba`, ...t1.Get('x', 'a')]
          : ["xpopa", "xpopb", "addab", "ptrb", "xpushb"]);
        this.AddMetamethodSoft("setindex", [t.WithDeltaPointerDepth(-1)], [t, VarType.Int, t.WithDeltaPointerDepth(-1)],
          t1.IsWide()
          ? [...t1.FlipXY(), `xpopa`, `setb ${t1.GetDefinition().Size}`, `mulba`, `xpopb`, `addab`, ...t1.FlipYX(), ...t1.Put("x","b")]
          : ["xpopa", "ypusha", "xpopa", "xpopb", "addab", "ypopa", "putaptrb"]);
        this.AddMetamethodSoft("ptrindex", [t], [t, VarType.Int],
          t1.IsWide()
          ? [`xpopa`, `setb ${t1.GetDefinition().Size}`, `mulba`, `xpopb`, `addba`, `xpusha`]
          : simpleAdd);
        this.AddMetamethodSoft("dispose", [], [t], [`call free`]);
        return;
      }
    }finally{
      this.CurrentFile = oldFile;
    }
  }

  RemapGenericMetamethod(
    mm: [
      ReturnTypes: VarType[],
      ArgTypes: VarType[],
      Code: string[],
      GenericArgs: string[],
      File: string
    ],
    inTypes: VarType[],
    exactly: boolean
  ): [
    ReturnTypes: VarType[],
    ArgTypes: VarType[],
    Code: string[],
    GenericArgs: string[],
    File: string
  ] {
    if (mm[3].length === 0) return mm;
    var genericifiedMap: { [generic: string]: VarType } = {};
    let failed: boolean = false;
    let argTypes: VarType[] = [];
    let returnTypes: VarType[] = [];
    let fakeClaimer = new Claimer("");
    let fakeClaim = fakeClaimer.Flag();// Iterate through inTypes, if the metamethod ArgTypes is a generic, and the inType is a specific type, replace the generic with the specific type and add it to the map
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
      // If a and b are functypes, recurse through their return types and argTypes.
      if(inMM instanceof FuncType && inType instanceof FuncType){
        let inMMFunc = inMM as FuncType;
        let inTypeFunc = inType as FuncType;
        if(inMMFunc.ArgTypes.length !== inTypeFunc.ArgTypes.length || inMMFunc.RetTypes.length !== inTypeFunc.RetTypes.length){
          failed = true;
          return inMM;
        }
        let newFncType = new FuncType(fakeClaimer, fakeClaim);
        newFncType.ArgTypes = [];
        newFncType.RetTypes = [];
        let oldExact = exactly;
        exactly = true;
        for(let i=0; i < inMMFunc.ArgTypes.length; i++){
          newFncType.ArgTypes.push(trySwap(inMMFunc.ArgTypes[i], inTypeFunc.ArgTypes[i]))
        }
        for(let i=0; i < inMMFunc.RetTypes.length; i++){
          newFncType.RetTypes.push(trySwap(inMMFunc.RetTypes[i], inTypeFunc.RetTypes[i]))
        }
        exactly = oldExact;
        if(failed)return inMM;
        return newFncType;
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
        for(let i=inType.Generics.length; i < inMM.Generics.length; i++){ // If there are more EXPECTED generic args then real generic args, just use $i
          let fakeClaimer = new Claimer("","");
          let fakeClaim = fakeClaimer.Flag();
          let vt: VarType = new VarType(fakeClaimer, fakeClaim);
          vt.PointerDepth = 0;
          vt.TypeName = "metamethodgeneric$"+i;
          vt.Generics = [];
          newGenericArgs.push(trySwap(inMM.Generics[i], vt));
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
    return [returnTypes, argTypes, mm[2], [], mm[4]];
  }

  TrySlowCache(fileKey: string, argKey: string, res: [ReturnTypes: VarType[], ArgTypes: VarType[], Code: string[]] | null){
    if(fileKey.indexOf("&")===-1)fileKey = fileKey + "&" + this.CurrentFile;
    if(res === null) return null;
    this.SlowMMCache.get(fileKey)!.set(argKey, res);
    return res;
  }
  CacheGet(name: string, argTypes: string|VarType[]): [ReturnTypes: VarType[], ArgTypes: VarType[], Code: string[]] | null {
    let fileKey = name + "&" + this.CurrentFile;
    let argKey = typeof argTypes==="string" ? argTypes : argTypes.map(c=>c.toString()).join(",");
    if(this.FastMMCache.has(fileKey) && this.FastMMCache.get(fileKey)!.has(argKey))
      return this.FastMMCache.get(fileKey)!.get(argKey)!;
    if(!this.SlowMMCache.has(fileKey))
      this.SlowMMCache.set(fileKey, new Map());
    if(this.SlowMMCache.get(fileKey)!.has(argKey))
      return this.SlowMMCache.get(fileKey)!.get(argKey)!;
    fileKey = name + "$GLOBAL"
    if(this.FastMMCache.has(fileKey) && this.FastMMCache.get(fileKey)!.has(argKey))
      return this.FastMMCache.get(fileKey)!.get(argKey)!;
    if(!this.SlowMMCache.has(fileKey))
      this.SlowMMCache.set(fileKey, new Map());
    if(this.SlowMMCache.get(fileKey)!.has(argKey))
      return this.SlowMMCache.get(fileKey)!.get(argKey)!;
    return null;
  }
  GetMetamethod(
    name: string,
    argTypes: VarType[],
    options: {
      canFallback?: boolean,
      exactly?: boolean,
      strictTo?: number
    } = {}
  ): [ReturnTypes: VarType[], ArgTypes: VarType[], Code: string[]] | null {
    let fileKey = name + "&" + this.CurrentFile;
    let argKey = argTypes.map(c=>c.toString()).join(",");
    let cacheHit: [ReturnTypes: VarType[], ArgTypes: VarType[], Code: string[]] | null ;
    if(cacheHit = this.CacheGet(name,argTypes)) return cacheHit;
    options.canFallback ??= true;
    options.exactly ??= false;
    // Check all ArgTypes for SoftInitilizedMetamethods, if they aren't there yet, add them and run SoftInit on the type
    argTypes
      .filter((c: VarType) => !this.SoftInitilizedMetamethods.includes(c))
      .forEach((c: VarType) => {
        this.SoftInit(c);
        this.SoftInitilizedMetamethods.push(c);
      });
    var mm = this.MetaMethods[name];
    if (mm === undefined)
      return this.TrySlowCache(fileKey, argKey, options.canFallback ? this.TryFallbacks(name, argTypes) : null);
    mm = mm.filter(c=>c[4]==="GLOBAL" || c[4]===this.CurrentFile || Include.Includes[this.CurrentFile]?.has(c[4]))
    mm = mm.map((c) => this.RemapGenericMetamethod(c, argTypes, options.exactly!));
    mm = mm.filter((c) => c[3].length === 0); // Anything with generics failed to map
    mm = mm.filter((c) =>
      options.exactly
        ? VarType.AllEquals(c[1], argTypes)
        : VarType.CanCoax(c[1], argTypes)[0]
    );
    if(options.strictTo)
      mm = mm.filter((c) => VarType.AllEquals(c[1].slice(0,options.strictTo), argTypes.slice(0,options.strictTo)))
    if (mm.length === 0)
      return this.TrySlowCache(fileKey,argKey,options.canFallback ? this.TryFallbacks(name, argTypes) : null);
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
    return this.TrySlowCache(fileKey,argKey,[mm[0][0], mm[0][1], mm[0][2]]);
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
    // Nuke all slow caches for this name.
    for(let key of [...this.SlowMMCache.keys()]){
      if(key.startsWith(name + "$")){
        this.SlowMMCache.set(key, new Map());
      }
    }
    if(!this.FastMMCache.has(name+"$"+this.CurrentFile))
      this.FastMMCache.set(name+"$"+this.CurrentFile,new Map());
    this.FastMMCache.get(name+"$"+this.CurrentFile)!.set(argTypes.map(c=>c.toString()).join(','),[retTypes, argTypes, code])
    this.MetaMethods[name].push([retTypes, argTypes, code, [], this.CurrentFile]);
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
    xpopa
    writea
    ret
getchar:
    reada
    xpusha
    ret
vAllocTable: db 0
vAllocSize: db 0
alloc:
    seta vAllocTable
    setb aftercode
    putbptra
    seta vAllocSize
    xpopb
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
        xpusha
        seta vAllocTable
        ptra
        setb vAllocSize
        ptrb
        addba
        adda 2
        setb 0
        putbptra
        inca
        xpopb
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
    xpusha
    ret

vFreeTable: db 0
vFreeTarget: db 0
vFreeLast: db 0
free:
    seta vFreeTable
    setb aftercode
    putbptra
    seta vFreeTarget
    xpopb
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
    if(Identifier === "COMPILER")
      return [VarType.Compiler, "", 0];
    var o = this.Vars.has(Identifier) ? this.Vars.get(Identifier) : this.Parent?.Get(Identifier);
    if (!o) {
      throw new Error(`Unknown identifier ${Identifier}`);
    }
    return o;
  }

  TryGet(
    Identifier: string
  ): [Type: VarType, AssembledName: string, ConstantValue: number | null]|null {
    if(Identifier === "_")
      return [VarType.Discard, "", 0];
    if(Identifier === "COMPILER")
      return [VarType.Compiler, "", 0];
    var o = this.Vars.has(Identifier) ? this.Vars.get(Identifier) : this.Parent?.TryGet(Identifier);
    if (!o) {
      return null;
    }
    return o;
  }

  Set(Identifier: string, Type: VarType, setup: boolean = true): string {
    if (Type.TypeName === "discard") setup = false;
    var name = this.GetSafeName(`var${Type}${Identifier}`);
    this.Vars.set(Identifier, [Type, name, null]);
    let typeDef: TypeDefinition = TypeVoid;
    try {typeDef = Type.GetDefinition();}catch{};
    if (setup) this.Assembly.push(`${name}: db ${typeDef.Wide ? new Array(typeDef.Size).fill('0').join(',') : 0}`);
    this.AllVars.set(name, [
      Type,
      Identifier,
      this.CurrentFile,
      this.CurrentFunction,
    ]);
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
      this.Vars.set(Identifier, [Type, name, val]);
      return true;
    }
    if (this.Vars.has(Identifier)) {
      let v = this.Vars.get(Identifier)!;
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
    subScope.FastMMCache = this.FastMMCache;
    subScope.SlowMMCache = this.SlowMMCache;
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
    for (var ident of this.Vars.keys()) {
      usedIdents.push(ident);
      o.push([ident, this.Vars.get(ident)![0], this.Vars.get(ident)![1]]);
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
      o.push(`seta ${vars[i][2]}`, `ptra`, `ypusha`);
    }
    return o;
  }
  LoadFunctionVariables(): string[] {
    var o: string[] = [];
    var vars = this.GetFunctionVariables();
    vars.sort((a, b) => a[2].localeCompare(b[2]));
    for (var i = vars.length - 1; i >= 0; i--) {
      o.push(`seta ${vars[i][2]}`, `ypopb`, `putbptra`);
    }
    return o;
  }

  static CompressRedundancy(left: string, right: string): string | null {
    var padding = left.match(/^\s*/)![0];
    left = left.replace(/^\s*(.*?)\s*$/, "$1");
    right = right.replace(/^\s*(.*?)\s*$/, "$1");

    if (left === `xpusha` && right === `xpopa`) return ``;
    if (left === `ypusha` && right === `ypopa`) return ``;
    if (left === `xpushb` && right === `xpopb`) return ``;
    if (left === `ypushb` && right === `ypopb`) return ``;
    var m: RegExpMatchArray | null;
    m = left.match(/^seta\s+(.*)/);
    if (m && right === "xpusha") return `${padding}xpush ${m[1]}`;
    if (m && right === "ypusha") return `${padding}ypush ${m[1]}`;
    m = left.match(/^setb\s+(.*)/);
    if (m && right === "xpushb") return `${padding}xpush ${m[1]}`;
    if (m && right === "ypushb") return `${padding}ypush ${m[1]}`;
    m = left.match(/^xpush\s+(.*)/);
    if (m && right === `xpopa`) return `${padding}seta ${m[1]}`;
    if (m && right === `xpopb`) return `${padding}setb ${m[1]}`;
    m = left.match(/^ypush\s+(.*)/);
    if (m && right === `ypopa`) return `${padding}seta ${m[1]}`;
    if (m && right === `ypopb`) return `${padding}setb ${m[1]}`;
    if (left.match(/^xpush\s+/) && right === "xpop") return "";
    if (left.match(/^ypush\s+/) && right === "ypop") return "";
    if ((left === "xpusha" || left === "xpushb") && right === "xpop") return "";
    if ((left === "ypusha" || left === "ypushb") && right === "ypop") return "";

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
    //Obliterate(assembly);
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
    let f = this.AllVars.get(func);
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
    for (let label of this.AllVars.keys()) {
      let v = this.AllVars.get(label);
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
          if (child[3] === "new") continue;
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
    document.querySelector('div.tab[data-target="baHeap"]')!.innerHTML = bs.RenderHeap();
    document.querySelector('div.tab[data-target="baMemory"]')!.innerHTML +=
      body;
  }
}
