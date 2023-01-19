import { VarType } from "./vartype";
import { Guid } from "js-guid";
import { TypeDefinition } from "./Types";


export class Scope {
  Vars: { [Identifier: string]: [Type: VarType, AssembledName: string]; } = {};
  Parent: Scope | null = null;
  Assembly: string[] = [];
  TakenLabels: { [label: string]: boolean; } = {};
  CurrentRequiredReturns: VarType[] = [];
  IsFunctionScope: boolean = false;
  UserTypes: {[name: string]: TypeDefinition} = {};

  GetSafeName(name: string) {
    name = name.replace(
      /[^a-zA-Z_]+/g,
      ""
    );
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
    if (setup)
      this.Assembly.push(`${name}: db 0`);
    return name;
  }

  Sub(): Scope {
    var subScope = new Scope();
    subScope.Parent = this;
    subScope.Assembly = this.Assembly;
    subScope.TakenLabels = this.TakenLabels;
    subScope.IsFunctionScope = this.IsFunctionScope;
    subScope.UserTypes = this.UserTypes;
    return subScope;
  }

  GetFunctionVariables(): [Ident: string, Type: VarType, AssembledName: string][] {
    if(!this.IsFunctionScope)return [];
    var o: [Ident: string, Type: VarType, AssembledName: string][] = [];
    var usedIdents: string[] = [];
    for (var ident in this.Vars){
      usedIdents.push(ident);
      o.push([ident, this.Vars[ident][0], this.Vars[ident][1]])
    };
    if(this.Parent){
      var parentIdents = this.Parent.GetFunctionVariables();
      parentIdents.filter(c=>!usedIdents.includes(c[0])).forEach(c=>{
        o.push(c);
        usedIdents.push(c[0]);
      })
    }
    return o;
  }

  DumpFunctionVariables(): string[] {
    var o: string[] = [];
    var vars = this.GetFunctionVariables();
    vars.sort((a,b)=>a[2].localeCompare(b[2]));
    for(var i=0; i < vars.length; i++){
      o.push(`seta ${vars[i][2]}`, `ptra`, `bpusha`);
    }
    return o;
  }
  LoadFunctionVariables(): string[] {
    var o: string[] = [];
    var vars = this.GetFunctionVariables();
    vars.sort((a,b)=>a[2].localeCompare(b[2]));
    for(var i=vars.length-1; i>=0; i--){
      o.push(`seta ${vars[i][2]}`, `bpopb`, `putbptra`);
    }
    return o;
  }

  static CompressRedundancy(left: string, right: string): string | null {
    var padding = left.match(/^\s*/)![0];
    left = left.replace(/^\s*(.*?)\s*$/, "$1");
    right = right.replace(/^\s*(.*?)\s*$/, "$1");

    if (left === `apusha` && right === `apopa`)
      return ``;
    if (left === `bpusha` && right === `bpopa`)
      return ``;
    if (left === `apushb` && right === `apopb`)
      return ``;
    if (left === `bpushb` && right === `bpopb`)
      return ``;
    var m: RegExpMatchArray | null;
    m = left.match(/^seta\s+(.*)/);
    if(m && right === 'apusha')return `${padding}apush ${m[1]}`
    if(m && right === 'bpusha')return `${padding}bpush ${m[1]}`
    m = left.match(/^setb\s+(.*)/);
    if(m && right === 'apushb')return `${padding}apush ${m[1]}`
    if(m && right === 'bpushb')return `${padding}bpush ${m[1]}`
    m = left.match(/^apush\s+(.*)/);
    if (m && right === `apopa`)
      return `${padding}seta ${m[1]}`;
    if (m && right === `apopb`)
      return `${padding}setb ${m[1]}`;
    m = left.match(/^bpush\s+(.*)/);
    if (m && right === `bpopa`)
      return `${padding}seta ${m[1]}`;
    if (m && right === `bpopb`)
      return `${padding}setb ${m[1]}`;
    if(left.match(/^apush\s+/) && right === 'apop') return '';
    if(left.match(/^bpush\s+/) && right === 'bpop') return '';


    return null;
  }

  static ObliterateRedundancies(assembly: string[]): string[] {
    for (var i = 0; i < assembly.length - 1; i++) {
      var shorter = this.CompressRedundancy(assembly[i], assembly[i + 1]);
      if (shorter !== null) {
        if (shorter.length === 0)
          return Scope.ObliterateRedundancies([...assembly.slice(0, i), ...assembly.slice(i + 2)]);

        else
          return Scope.ObliterateRedundancies([...assembly.slice(0, i), shorter, ...assembly.slice(i + 2)]);
      }
    }
    return assembly;
  }
}
