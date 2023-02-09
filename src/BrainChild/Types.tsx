import { FuncType, VarType } from "./vartype";

export class TypeDefinition {
  MetaMethods: {
    [id: string]: [
      ReturnTypes: VarType[],
      ArgTypes: VarType[],
      Code: string[]
    ][];
  } = {};
  Children: { [id: string]: [type: VarType, offset: number, initial: string] } =
    {};
  Size: number = 1;
  Parent: TypeDefinition | null = null;

  TypeType: TypeDefinition | null = null;
  ClassLabel: string = "";
  Name: string = "";

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
        let other = this.GetMetamethod(inv[1], argTypes, false);
        if (other !== null) {
          let newMethod = other[2].concat(`apopa`, `nota`, `apusha`);
          return [other[0], other[1], newMethod];
        }
      } else if (name === inv[1]) {
        let other = this.GetMetamethod(inv[0], argTypes, false);
        if (other !== null) {
          let newMethod = other[2].concat(`apopa`, `nota`, `apusha`);
          return [other[0], other[1], newMethod];
        }
      }
    }
    return null;
  }

  GetMetamethod(
    name: string,
    argTypes: VarType[],
    canFallback: boolean = true,
    exactly: boolean = false
  ): [ReturnTypes: VarType[], ArgTypes: VarType[], Code: string[]] | null {
    var mm = this.MetaMethods[name];
    if (mm === undefined)
      return canFallback ? this.TryFallbacks(name, argTypes) : null;
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
    return mm[0];
  }
  AddMetamethod(
    name: string,
    returnTypes: VarType[],
    argTypes: VarType[],
    code: string[]
  ) {
    if (this.MetaMethods[name] === undefined) {
      this.MetaMethods[name] = [];
    }
    this.MetaMethods[name].push([returnTypes, argTypes, code]);
  }

  IsParent(other: TypeDefinition): boolean {
    if (other === this) return true;
    if (other.Parent === null) return false;
    return this.IsParent(other.Parent);
  }
}

export var TypeInt = new TypeDefinition();
export var TypeVoid = new TypeDefinition();

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

export function GeneratePointerType(typ: VarType): TypeDefinition {
  var t = new TypeDefinition();
  simpleOps.forEach((c) => {
    t.AddMetamethod(c[0], [typ], [typ, VarType.Int], c[1]);
    t.AddMetamethod(c[0], [typ], [VarType.Int, typ], c[1]);
    t.AddMetamethod(c[0], [typ], [typ, VarType.VoidPtr], c[1]);
    t.AddMetamethod(c[0], [typ], [VarType.VoidPtr, typ], c[1]);
  });
  t.AddMetamethod("divmod", [typ, typ], [typ, VarType.Int], simpleDivMod);
  t.AddMetamethod("divmod", [typ, typ], [VarType.Int, typ], simpleDivMod);
  t.AddMetamethod("divmod", [typ, typ], [typ, VarType.VoidPtr], simpleDivMod);
  t.AddMetamethod("divmod", [typ, typ], [VarType.VoidPtr, typ], simpleDivMod);
  t.AddMetamethod("truthy", [VarType.Int], [typ], []);
  t.AddMetamethod("not", [VarType.Int], [typ], simpleNot);
  t.AddMetamethod("unm", [typ], [typ], simpleUnm);
  t.AddMetamethod("unp", [VarType.Int], [typ], simpleUnp);

  return t;
}

export function GenerateFuncType(typ: FuncType): TypeDefinition {
  var t = new TypeDefinition();
  t.AddMetamethod("truthy", [VarType.Int], [typ], []);
  return t;
}

simpleOps.forEach((c) => {
  TypeInt.AddMetamethod(c[0], [VarType.Int], [VarType.Int, VarType.Int], c[1]);
});
TypeInt.AddMetamethod(
  "divmod",
  [VarType.Int, VarType.Int],
  [VarType.Int, VarType.Int],
  simpleDivMod
);
TypeInt.AddMetamethod("truthy", [VarType.Int], [VarType.Int], []);
TypeInt.AddMetamethod("not", [VarType.Int], [VarType.Int], simpleNot);
TypeInt.AddMetamethod("unm", [VarType.Int], [VarType.Int], simpleUnm);
TypeInt.AddMetamethod("unp", [VarType.Int], [VarType.Int], simpleUnp);