import { Claimer } from "./brainchild";
import { FunctionDefinition } from "./functiondefinition";
import { Identifier } from "./identifier";
import { Scope } from "./Scope";
import { Statement } from "./statement";
import { TypeDefinition } from "./Types";
import { VariableDecleration } from "./variabledefinition";
import { FuncType, VarType } from "./vartype";

export class Class extends Statement {
  Members: (VariableDecleration | FunctionDefinition)[] = [];
  Name: Identifier | null = null;
  Parent: Identifier | null = null;
  static Claim(claimer: Claimer): Class | null {
    var flg = claimer.Claim(/class\b/);
    if (!flg.Success) return null;
    var className = Identifier.Claim(claimer);
    if (className === null) {
      flg.Fail();
      return null;
    }
    var parent: Identifier | null = null;
    if (claimer.Claim(/:/).Success) {
      parent = Identifier.Claim(claimer);
      if (parent === null) {
        flg.Fail();
        return null;
      }
    }
    if (!claimer.Claim(/\{/).Success) {
      flg.Fail();
      return null;
    }
    var members: (VariableDecleration | FunctionDefinition)[] = [];
    var member: VariableDecleration | FunctionDefinition | null =
      VariableDecleration.Claim(claimer) ??
      FunctionDefinition.ClaimMetamethod(claimer) ??
      FunctionDefinition.Claim(claimer) ??
      null;
    while (member !== null) {
      if (member instanceof FunctionDefinition) {
        if (!(member.Target instanceof Identifier)) {
          flg.Fail();
          return null;
        }
      }
      members.push(member);
      claimer.Claim(/;/);
      member =
        VariableDecleration.Claim(claimer) ??
        FunctionDefinition.ClaimMetamethod(claimer) ??
        FunctionDefinition.Claim(claimer) ??
        null;
    }

    if (!claimer.Claim(/}/).Success) {
      flg.Fail();
      return null;
    }
    var cls = new Class(claimer, flg);
    cls.Members = members;
    cls.Name = className;
    cls.Parent = parent;
    return cls;
  }
  TrySetup(scope: Scope): boolean {
    if (this.Parent !== null && !scope.UserTypes[this.Parent!.Name]) {
      return false;
    }
    var typeDef = new TypeDefinition();
    if (this.Parent !== null) {
      var parent = scope.UserTypes[this.Parent!.Name];
      if (!parent) {
        return false;
      }
      for (var id in parent.MetaMethods) {
        typeDef.MetaMethods[id] = parent.MetaMethods[id].concat();
      }
      for (var name in parent.Children) {
        typeDef.Children[name] = parent.Children[name];
      }
      typeDef.Size = parent.Size;
    } else {
      typeDef.Size = 0;
    }
    for (var i = 0; i < this.Members.length; i++) {
      var member = this.Members[i];
      if (member instanceof FunctionDefinition) {
        if (member.IsMeta) {
          var falseClaimer = new Claimer("");
          var falseClaim = falseClaimer.Flag();
          var funcType = new FuncType(falseClaimer, falseClaim);
          funcType.RetTypes = member.RetTypes.concat();
          funcType.ArgTypes = member.Args.map((c) => c.Type!);
          member.Label = scope.GetSafeName(
            "metamethod_" + funcType.RetTypes + "_" + funcType.ArgTypes
          );
          typeDef.AddMetamethod(
            (member.Target as Identifier).Name,
            member.RetTypes,
            member.Args.map((c) => c.Type) as VarType[],
            [`seta ${member.Label}`, `calla`]
          );
          continue;
        }
      }
    }
    return true;
  }

  Evaluate(scope: Scope): string[] {
    for (var i = 0; i < this.Members.length; i++) {
      this.Members[i].Evaluate(scope);
    }
    return [];
  }
}
Statement.RegisterTopLevel(Class.Claim);
