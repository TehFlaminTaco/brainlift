import { FuncType, VarType } from "./vartype";



export class TypeDefinition {
  MetaMethods: {[id: string]: [ReturnTypes: VarType[], ArgTypes: VarType[], Code: string[]][]} = {}
  Children: {[id: string]: [type: VarType, offset: number, initial: number]} = {}
  Size: number = 1;

  GetMetamethod(name: string, argTypes: VarType[]): [ReturnTypes: VarType[], ArgTypes: VarType[], Code: string[]]|null{
    var mm = this.MetaMethods[name];
    if(mm === undefined)return null;
    mm=mm.filter(c=>VarType.CanCoax(c[1], argTypes));
    if(mm.length === 0)return null;
    mm.sort((a,b)=>VarType.CountMatches(b[1], argTypes)-VarType.CountMatches(a[1], argTypes))
    var bestMatch = VarType.CountMatches(mm[0][1], argTypes);
    mm=mm.filter(c=>VarType.CountMatches(c[1],argTypes)===bestMatch)
    if(mm.length > 1)throw new Error(`Ambiguous Metamethod: ${name} Received: ${argTypes} Options: ${mm.map(c=>"["+c[0].join(',')+"]").join('m')}`)
    return mm[0];
  }
  AddMetamethod(name: string, returnTypes: VarType[], argTypes: VarType[], code: string[]){
    if(this.MetaMethods[name]===undefined){
      this.MetaMethods[name] = [];
    }
    this.MetaMethods[name].push([returnTypes, argTypes, code]);
  }
}

export var TypeInt = new TypeDefinition();
export var TypeVoid = new TypeDefinition();

var simpleAdd = [`apopb`, `apopa`, `addab`, `apushb`]
var simpleSub = [`apopb`, `apopa`, `subba`, `apusha`]
var simpleMul = [`apopb`, `apopa`, `mulab`, `apushb`]
var simpleDiv = [`apopb`, `apopa`, `divab`, `apusha`]
var simpleMod = [`apopb`, `apopa`, `divab`, `apushb`]

var simpleOps: [string, string[]][] = [['add', simpleAdd],['sub', simpleSub], ['mul', simpleMul], ['div', simpleDiv], ['mod', simpleMod]]

export function GeneratePointerType(typ: VarType): TypeDefinition{
  var t = new TypeDefinition();
  simpleOps.forEach(c=>{
    t.AddMetamethod(c[0], [typ], [typ, VarType.Int], c[1])
    t.AddMetamethod(c[0], [typ], [VarType.Int, typ], c[1])
    t.AddMetamethod(c[0], [typ], [typ, VarType.VoidPtr], c[1])
    t.AddMetamethod(c[0], [typ], [VarType.VoidPtr, typ], c[1])
  });
  t.AddMetamethod("truthy", [VarType.Int], [typ], []);

  return t;
}

export function GenerateFuncType(typ: FuncType): TypeDefinition{
  var t = new TypeDefinition();
  t.AddMetamethod("truthy", [VarType.Int], [typ], []);
  return t;
}

simpleOps.forEach(c=>{
  TypeInt.AddMetamethod(c[0], [VarType.Int], [VarType.Int, VarType.Int], c[1])
});
TypeInt.AddMetamethod("truthy", [VarType.Int], [VarType.Int], []);

