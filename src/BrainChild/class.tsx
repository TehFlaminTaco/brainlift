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
  StaticMembers: (VariableDecleration | FunctionDefinition)[] = [];
  Name: Identifier | null = null;
  Parent: Identifier | null = null;

  private static ClaimMember(
    claimer: Claimer
  ):
    | [isStatic: boolean, member: VariableDecleration | FunctionDefinition]
    | null {
    var flg = claimer.Flag();
    var member: VariableDecleration | FunctionDefinition | null;
    if (claimer.Claim(/static\b/).Success) {
      member =
        VariableDecleration.Claim(claimer) ??
        FunctionDefinition.Claim(claimer) ??
        null;
      if (member === null) {
        flg.Fail();
        return null;
      }
      return [true, member];
    }
    member =
      VariableDecleration.Claim(claimer) ??
      FunctionDefinition.ClaimMetamethod(claimer) ??
      FunctionDefinition.Claim(claimer) ??
      null;
    if (member === null) return null;
    return [false, member];
  }

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
    var staticMembers: (VariableDecleration | FunctionDefinition)[] = [];
    var member:
      | [isStatic: boolean, member: VariableDecleration | FunctionDefinition]
      | null = Class.ClaimMember(claimer);
    while (member !== null) {
      if (member[1] instanceof FunctionDefinition) {
        var fnc = member[1] as FunctionDefinition;
        if (
          (fnc.IsMeta && (fnc.Target as Identifier).Name === className.Name) ||
          (!fnc.IsMeta && !member[0])
        ) {
          var falseClaimer = new Claimer("");
          var falseFlag = falseClaimer.Flag();
          var declareThis = new VariableDecleration(falseClaimer, falseFlag);
          declareThis.Identifier = new Identifier(falseClaimer, falseFlag);
          declareThis.Identifier.Name = "this";
          declareThis.Type = new VarType(falseClaimer, falseFlag);
          declareThis.Type.TypeName = className.Name;
          fnc.Args.push(declareThis);
        }
        if (!(fnc.Target instanceof Identifier)) {
          flg.Fail();
          return null;
        }
      }
      (member[0] ? staticMembers : members).push(member[1]);
      claimer.Claim(/;/);
      member = Class.ClaimMember(claimer);
    }

    if (!claimer.Claim(/}/).Success) {
      flg.Fail();
      return null;
    }
    var cls = new Class(claimer, flg);
    cls.Members = members;
    cls.StaticMembers = staticMembers;
    cls.Name = className;
    cls.Parent = parent;
    return cls;
  }

  GenerateNewMethod(scope: Scope): string {
    var typeDef = scope.UserTypes[this.Name!.Name];
    var label = scope.GetSafeName(`new${this.Name!.Name}`);
    scope.RequireAllocator();
    var asm: string[] = [];
    asm.push(
      `${label}:`,
      `  apush ${typeDef.Size}`,
      `  call alloc`,
      `  apopb`,
      `  apushb`
    );
    for (let i = 0; i < this.Members.length; i++) {
      var member = this.Members[i];
      if (member instanceof FunctionDefinition) member.Evaluate(scope);
    }
    var childrenByOffset = [];
    for (let id in typeDef.Children) {
      let child = typeDef.Children[id];
      childrenByOffset[child[1]] = child;
    }
    for (let i = 0; i < childrenByOffset.length; i++) {
      let child = childrenByOffset[i];
      if (child) asm.push(`  seta ${child[2]}`, `  putaptrb`);
      if (i < childrenByOffset.length - 1) asm.push(`  incb`);
    }
    asm.push(`  ret`);
    scope.Assembly.push(...asm);
    return label;
  }

  TrySetup(scope: Scope): boolean {
    if (this.Parent !== null && !scope.UserTypes[this.Parent!.Name]) {
      return false;
    }
    var objectType = new TypeDefinition();
    var classType = new TypeDefinition();
    objectType.ClassLabel = scope.GetSafeName(`class${this.Name!.Name}`);
    classType.ClassLabel = scope.GetSafeName(`classtype${this.Name!.Name}`);
    objectType.Name = this.Name!.Name;
    classType.Name = `type${this.Name!.Name}`;
    objectType.TypeType = classType;
    if (this.Parent !== null) {
      var parent = scope.UserTypes[this.Parent!.Name];
      var classParent = parent.TypeType;
      if (!parent || !classParent) {
        return false;
      }
      objectType.Parent = parent;
      classType.Parent = classParent;
      for (var id in parent.MetaMethods) {
        objectType.MetaMethods[id] = parent.MetaMethods[id].concat();
      }
      for (let name in parent.Children) {
        if (parent.Children[name][1] !== 0)
          objectType.Children[name] = parent.Children[name];
      }
      objectType.Size = parent.Size;
      for (let name in classParent.Children) {
        if (classParent.Children[name][1] > 1)
          classType.Children[name] = classParent.Children[name];
      }
      classType.Size = classParent.Size;
      classType.Children["base"] = [VarType.Type, 0, classParent.ClassLabel];
    } else {
      objectType.Size = 1;
      classType.Size = 2;
    }
    objectType.Children["class"] = [VarType.Type, 0, classType.ClassLabel];
    classType.Children["new"] = [VarType.Void, 1, "0"];
    for (var i = 0; i < this.StaticMembers.length; i++) {
      let member = this.StaticMembers[i];
      let name: Identifier =
        member instanceof FunctionDefinition
          ? (member.Target as Identifier)
          : (member as VariableDecleration).Identifier!;
      let type: VarType;
      if (member instanceof FunctionDefinition) {
        let ftype = new FuncType(member.Claimer, member.Claim);
        ftype.RetTypes = member.RetTypes;
        ftype.ArgTypes = member.Args.map((c) => c.Type!);
        type = ftype;
      } else {
        type = member.Type!;
      }
      classType.Children[name.Name] = [
        type,
        classType.Size++,
        member instanceof FunctionDefinition ? member.Label : "0",
      ];
    }
    for (var i = 0; i < this.Members.length; i++) {
      let member = this.Members[i];
      if (member instanceof FunctionDefinition) {
        if (member.IsMeta) {
          let falseClaimer = new Claimer("");
          let falseClaim = falseClaimer.Flag();
          let funcType = new FuncType(falseClaimer, falseClaim);
          funcType.RetTypes = member.RetTypes.concat();
          funcType.ArgTypes = member.Args.map((c) => c.Type!);
          member.Label = scope.GetSafeName(
            "metamethod_" + funcType.RetTypes + "_" + funcType.ArgTypes
          );
          objectType.AddMetamethod(
            (member.Target as Identifier).Name,
            member.RetTypes,
            member.Args.map((c) => c.Type) as VarType[],
            [`seta ${member.Label}`, `calla`]
          );
          continue;
        } else {
          let falseClaimer = new Claimer("");
          let falseClaim = falseClaimer.Flag();
          let funcType = new FuncType(falseClaimer, falseClaim);
          funcType.RetTypes = member.RetTypes.concat();
          funcType.ArgTypes = member.Args.map((c) => c.Type!);
          member.Label = scope.GetSafeName(
            "function_" + funcType.RetTypes + "_" + funcType.ArgTypes
          );
        }
      }
      let name: Identifier =
        member instanceof FunctionDefinition
          ? (member.Target as Identifier)
          : (member as VariableDecleration).Identifier!;
      let type: VarType;
      if (member instanceof FunctionDefinition) {
        let ftype = new FuncType(member.Claimer, member.Claim);
        ftype.RetTypes = member.RetTypes;
        ftype.ArgTypes = member.Args.map((c) => c.Type!);
        type = ftype;
      } else {
        type = member.Type!;
      }
      objectType.Children[name.Name] = [
        type,
        objectType.Size++,
        member instanceof FunctionDefinition ? member.Label : "0",
      ];
      if (member instanceof FunctionDefinition) {
        classType.Children[name.Name] = [
          type,
          classType.Size++,
          member instanceof FunctionDefinition ? member.Label : "0",
        ];
      }
    }

    scope.UserTypes[this.Name!.Name] = objectType;
    return true;
  }

  Evaluate(scope: Scope): string[] {
    var asm: string[] = [];
    var objectDef = scope.UserTypes[this.Name!.Name];
    var classDef = objectDef.TypeType;
    if (!objectDef || !classDef)
      throw new Error(
        `Tried to compile non-registered class: ${this.Name!.Name}`
      );
    asm.push(`${classDef.ClassLabel}:`);
    for (var i = 0; i < this.StaticMembers.length; i++) {
      let member = this.StaticMembers[i];
      if (member instanceof FunctionDefinition) {
        member.IsMeta = true;
        member.Evaluate(scope);
      }
    }
    var newMethod = this.GenerateNewMethod(scope);
    classDef.Children["new"][2] = newMethod;
    var vars: string[] = ["0"];
    for (var id in classDef.Children) {
      var child = classDef.Children[id];
      vars[child[1]] = child[2];
    }
    asm.push(`db ${vars}`);
    scope.Assembly.push(...asm);
    return [];
  }

  DefinitelyReturns(): boolean {
    return false;
  }
}
Statement.RegisterTopLevel(Class.Claim);
