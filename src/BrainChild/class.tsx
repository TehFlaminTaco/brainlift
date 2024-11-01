import { Assignment } from "./assignment";
import { Claimer } from "./brainchild";
import { FunctionDefinition } from "./functiondefinition";
import { Identifier } from "./identifier";
import { Reserve } from "./reserve";
import { Scope } from "./Scope";
import { IsSimplifyable, Simplifyable } from "./Simplifyable";
import { Statement } from "./statement";
import { TypeDefinition } from "./Types";
import { VariableDecleration } from "./variabledefinition";
import { FuncType, VarType } from "./vartype";

export class Class extends Statement {
  Members: (VariableDecleration | FunctionDefinition)[] = [];
  StaticMembers: (VariableDecleration | FunctionDefinition)[] = [];
  VirtualMembers: (VariableDecleration | FunctionDefinition)[] = [];
  Assignments: Assignment[] = [];
  StaticAssignments: Assignment[] = [];
  Constants: VariableDecleration[] = [];
  StaticConstants: VariableDecleration[] = [];
  Constructors: FunctionDefinition[] = [];
  Name: Identifier | null = null;
  GenericArgs: string[] = [];
  IsAbstract: boolean = false;
  FromFile: string = "";
  Wide: boolean = false;

  private static ClaimMember(
    claimer: Claimer,
    isAbstract: boolean,
    ofClass: Identifier
  ):
    | [
        flag: "" | "static" | "virtual" | "none",
        member: VariableDecleration | FunctionDefinition
      ]
    | null {
    var flg = claimer.Flag();
    var member: VariableDecleration | FunctionDefinition | null;
    if (!isAbstract && claimer.Claim(/new\b/).Success) {
      member = FunctionDefinition.ClaimConstructor(claimer, ofClass);
      if (member === null) {
        flg.Fail();
        return null;
      }
      return ["none", member];
    } else if (claimer.Claim(/static\b/).Success) {
      member =
        VariableDecleration.Claim(claimer) ??
        VariableDecleration.ClaimAbstract(claimer) ??
        FunctionDefinition.Claim(claimer) ??
        null;
      if (member === null) {
        flg.Fail();
        return null;
      }
      return ["static", member];
    } else if (claimer.Claim(/virtual\b/).Success) {
      member =
        VariableDecleration.Claim(claimer) ??
        VariableDecleration.ClaimAbstract(claimer) ??
        FunctionDefinition.Claim(claimer) ??
        null;
      if (member === null) {
        flg.Fail();
        return null;
      }
      return ["virtual", member];
    }
    member =
      VariableDecleration.Claim(claimer) ??
      VariableDecleration.ClaimAbstract(claimer) ??
      FunctionDefinition.Claim(claimer) ??
      null;
    if (member === null) return null;
    return ["", member];
  }

  static Claim(claimer: Claimer): Class | null {
    var flg = claimer.Flag();
    var abstract = false;
    if (claimer.Claim(/abstract\b/).Success) abstract = true;
    var c = claimer.Claim(/class\b/);
    let wide = false;
    if (wide=!c.Success) c = claimer.Claim(/struct\b/);
    if (!c.Success) return null;
    var className = Identifier.Claim(claimer);
    if (className === null) {
      flg.Fail();
      return null;
    }
    let generics: string[] = [];
    let genArgNum = 0;
    if (claimer.Claim(/</).Success) {
      let arg = Identifier.Claim(claimer);
      while (arg !== null) {
        generics.push(arg.Name);
        VarType.CurrentGenericArgs[arg.Name] = "$" + genArgNum++;
        if (!claimer.Claim(/,/).Success) break;
        arg = Identifier.Claim(claimer);
      }
      if (!claimer.Claim(/>/).Success) {
        VarType.CurrentGenericArgs = {};
        flg.Fail();
        return null;
      }
    }
    if (!claimer.Claim(/\{/).Success) {
      VarType.CurrentGenericArgs = {};
      flg.Fail();
      return null;
    }
    var members: (VariableDecleration | FunctionDefinition)[] = [];
    var staticMembers: (VariableDecleration | FunctionDefinition)[] = [];
    var virtualMembers: (VariableDecleration | FunctionDefinition)[] = [];
    let assignments: Assignment[] = [];
    let staticAssignments: Assignment[] = [];
    let constants: VariableDecleration[] = [];
    let staticConstants: VariableDecleration[] = [];
    let constructors: FunctionDefinition[] = [];
    var member:
      | [
          isStatic: "" | "static" | "virtual" | "none",
          member: VariableDecleration | FunctionDefinition
        ]
      | null = Class.ClaimMember(claimer, abstract, className);
    while (member !== null) {
      if (member[1] instanceof VariableDecleration && (member[1] as VariableDecleration).Type?.TypeName === "discard")
        throw new Error(`Cannot declare discard type variable in class ${(member[1] as VariableDecleration).Identifier!.Name}`);
      if (
        member[1] instanceof VariableDecleration &&
        member[0] !== "virtual" &&
        member[0] !== "none"
      ) {
        let assignValue = Assignment.RightClaim(member[1], claimer);
        if (assignValue) {
          if (member[0] === "static") staticAssignments.push(assignValue);
          else assignments.push(assignValue);
        }
      }
      if (member[0] !== "none") {
        if (member[1] instanceof FunctionDefinition) {
          var fnc = member[1] as FunctionDefinition;
          if (member[0] !== "static") {
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
            VarType.CurrentGenericArgs = {};
            flg.Fail();
            return null;
          }
        }
      }
      switch (member[0]) {
        case "static":
          if (
            member[1] instanceof VariableDecleration &&
            (member[1] as VariableDecleration).IsConstant
          )
            staticConstants.push(member[1]);
          else staticMembers.push(member[1]);
          break;
        case "virtual":
          virtualMembers.push(member[1]);
          break;
        case "":
          if (
            member[1] instanceof VariableDecleration &&
            (member[1] as VariableDecleration).IsConstant
          )
            constants.push(member[1]);
          else members.push(member[1]);
          break;
        case "none":
          constructors.push(member[1] as FunctionDefinition);
          break;
      }
      claimer.Claim(/;/);
      member = Class.ClaimMember(claimer, abstract, className);
    }

    VarType.CurrentGenericArgs = {};
    if (!claimer.Claim(/}/).Success) {
      flg.Fail();
      return null;
    }
    var cls = new Class(claimer, flg);
    cls.Members = members;
    cls.StaticMembers = staticMembers;
    cls.VirtualMembers = virtualMembers;
    cls.Assignments = assignments;
    cls.StaticAssignments = staticAssignments;
    cls.Constants = constants;
    cls.StaticConstants = staticConstants;
    cls.Constructors = constructors;
    cls.Name = className;
    cls.IsAbstract = abstract;
    cls.FromFile = claimer.File;
    cls.Wide = wide;
    return cls;
  }

  GenerateWideNewMethod(scope: Scope): string {
    let typeDef = scope.UserTypes[this.Name!.Name];
    let label = scope.GetSafeName(`new${this.Name!.Name}`);
    scope.RequireAllocator();
    let asm: string[] = [];
    asm.push(`${label}:`);
    let childrenByOffset = [];
    for (let id in typeDef.Children) {
      let child = typeDef.Children[id];
      childrenByOffset[child[1]] = [id, child];
    }
    let childrenInOrder = [];
    for (let i = 0; i < childrenByOffset.length; i++) {
      let child = childrenByOffset[i];
      childrenInOrder.push(i);
      if (child) {
        let childType = (child[1][0] as VarType);
        if((childType?.IsDefined()??false) && (childType?.GetDefinition().Wide ?? false))
          i += childType.GetDefinition().Size-1;
      }
    }
    for (let j = childrenInOrder.length-1; j >= 0; j--) {
      let i = childrenInOrder[j];
      let child = childrenByOffset[i];
      if (child) {
        let childType = (child[1][0] as VarType);
        // Check if there's a non-static assignment for this child.
        let possibleAssignments = this.Assignments.filter(
          (c) => (c.Left as VariableDecleration).Identifier!.Name === child[0]
        );
        if (possibleAssignments.length > 0) {
          if (possibleAssignments.length > 1)
            throw new Error(`Ambiguous default value for ${child[0]}`);
          let res = possibleAssignments[0].Right!.TryEvaluate(scope);
          asm.push(...res[1]);
          for (let spare = 1; spare < res[0].length; spare++)
            asm.push(...res[0][spare].APop());
        } else {
          if((childType?.IsDefined()??false) && (childType?.GetDefinition().Wide ?? false)){
            asm.push(...Array(childType.GetDefinition().Size).fill(`apush 0`));
          }else{
            asm.push(`apush ${child[1][2]}`);
          }
        }
      }else{
        asm.push(`apush 0`);
      }
    }
    asm.push(`  ret`);
    scope.Assembly.push(...asm);
    return label;
  }

  GenerateNewMethod(scope: Scope): string {
    var typeDef = scope.UserTypes[this.Name!.Name];
    if(typeDef.Wide)
      return this.GenerateWideNewMethod(scope);
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
    var childrenByOffset = [];
    for (let id in typeDef.Children) {
      let child = typeDef.Children[id];
      childrenByOffset[child[1]] = [id, child];
    }
    for (let i = 0; i < childrenByOffset.length; i++) {
      let child = childrenByOffset[i];
      if (child) {
        let childType = (child[1][0] as VarType);
        // Check if there's a non-static assignment for this child.
        let possibleAssignments = this.Assignments.filter(
          (c) => (c.Left as VariableDecleration).Identifier!.Name === child[0]
        );
        if (possibleAssignments.length > 0) {
          if (possibleAssignments.length > 1)
            throw new Error(`Ambiguous default value for ${child[0]}`);
          asm.push(`  apushb`);
          let res = possibleAssignments[0].Right!.TryEvaluate(scope);
          asm.push(...res[1]);
          for (let spare = 1; spare < res[0].length; spare++)
            asm.push(...res[0][spare].APop());
          ///asm.push(`    apopa`, `    apopb`, `    putaptrb`);
          asm.push(...res[0][0].FlipAB(), `apopb`, ...res[0][0].FlipBA(), ...res[0][0].Put("a","b"));
        } else {
          if((childType?.IsDefined()??false) && (childType?.GetDefinition().Wide ?? false)){
            asm.push(`seta 0`, ...Array(childType.GetDefinition().Size).fill(['putaptrb','incb']).flat());
          }else{
            asm.push(`  seta ${child[1][2]}`, `  putaptrb`);
          }
        }
        if((childType?.IsDefined()??false) && (childType?.GetDefinition().Wide ?? false))
          i += childType.GetDefinition().Size-1;
      }
      if (i < childrenByOffset.length - 1) asm.push(`  incb`);
    }
    asm.push(`  ret`);
    scope.Assembly.push(...asm);
    return label;
  }

  TrySetup(scope: Scope): boolean {
    var objectType = new TypeDefinition();
    var classType = new TypeDefinition();
    objectType.ClassLabel = scope.GetSafeName(`class${this.Name!.Name}`);
    classType.ClassLabel = objectType.ClassLabel; //scope.GetSafeName(`classtype${this.Name!.Name}`);
    objectType.Name = this.Name!.Name;
    classType.Name = `type${this.Name!.Name}`;
    objectType.TypeType = classType;
    objectType.Wide = this.Wide;
    if (this.Wide){
      objectType.Size = 0;
    }else{
      objectType.Size = 1;
    }
    classType.Size = 1;
    //objectType.Children["class"] = [VarType.Type, 0, classType.ClassLabel];
    classType.Children["new"] = [VarType.Void, 0, "0"];
    for (let i = 0; i < this.StaticMembers.length; i++) {
      let member = this.StaticMembers[i];
      if (member instanceof FunctionDefinition) {
        let funcType = member.GetTypes(scope)[0] as FuncType;
        member.Label = scope.GetSafeName(
          "function_" + funcType.RetTypes + "_" + funcType.ArgTypes
        );
      }
      let name: Identifier =
        member instanceof FunctionDefinition
          ? (member.Target as Identifier)
          : (member as VariableDecleration).Identifier!;
      let type: VarType;
      if (member instanceof FunctionDefinition) {
        type = member.GetTypes(scope)[0];
      } else {
        type = member.Type!;
      }
      classType.Children[name.Name] = [
        type,
        classType.Size,
        member instanceof FunctionDefinition ? member.Label : "0",
      ];
      classType.Size+=((type?.IsDefined()??false) && type.GetDefinition()?.Wide) ? type.GetDefinition().Size : 1;
      // Check for a Assignment baring this name, that assigns to a Reserve
      if (member instanceof VariableDecleration) {
        this.StaticAssignments.filter(
          (c) => (c.Left as VariableDecleration) === member
        )
          .filter((c) => c.Right instanceof Reserve)
          .forEach((c) => {
            let reserve = c.Right as Reserve;
            // Try to get the size of the reserve
            let size = reserve.GetSize(scope);
            if (size === null)
              throw new Error("Cannot determine size of reserve");
            // Increase the size of the object to fit it
            classType.Size += size;
            reserve.ClassMember = true;
          });
      }
    }
    // Save virtual members statically too
    for (let i = 0; i < this.VirtualMembers.length; i++) {
      let member = this.VirtualMembers[i];
      if (member instanceof FunctionDefinition) {
        let funcType = member.GetTypes(scope)[0] as FuncType;
        member.Label = scope.GetSafeName(
          "function_" + funcType.RetTypes + "_" + funcType.ArgTypes
        );
      }
      let name: Identifier =
        member instanceof FunctionDefinition
          ? (member.Target as Identifier)
          : (member as VariableDecleration).Identifier!;
      let type: VarType;
      if (member instanceof FunctionDefinition) {
        type = member.GetTypes(scope)[0];
      } else {
        type = member.Type!;
      }
      classType.Children[name.Name] = [
        type,
        classType.Size,
        member instanceof FunctionDefinition ? member.Label : "0",
      ];
      objectType.VirtualChildren[name.Name] = [
        type,
        classType,
        classType.Size,
        member instanceof FunctionDefinition ? member.Label : "0",
      ];
      classType.Size+=((type?.IsDefined()??false) && type.GetDefinition()?.Wide) ? type.GetDefinition().Size : 1;
    }
    for (let i = 0; i < this.Members.length; i++) {
      let member = this.Members[i];
      if (member instanceof FunctionDefinition) {
        let funcType = member.GetTypes(scope)[0] as FuncType;
        member.Label = scope.GetSafeName(
          "function_" + funcType.RetTypes + "_" + funcType.ArgTypes
        );
      }
      let name: Identifier =
        member instanceof FunctionDefinition
          ? (member.Target as Identifier)
          : (member as VariableDecleration).Identifier!;
      let type: VarType;
      if (member instanceof FunctionDefinition) {
        type = member.GetTypes(scope)[0];
      } else {
        type = member.Type!;
      }
      if (objectType.Children[name.Name]) {
        objectType.Children[name.Name] = [
          type,
          objectType.Children[name.Name][1],
          member instanceof FunctionDefinition ? member.Label : "0",
        ];
      } else {
        objectType.Children[name.Name] = [
          type,
          objectType.Size,
          member instanceof FunctionDefinition ? member.Label : "0",
        ];
        objectType.Size+=((type?.IsDefined()??false) && type.GetDefinition()?.Wide) ? type.GetDefinition().Size : 1;
      }
      // Check for a Assignment baring this name, that assigns to a Reserve
      if (member instanceof VariableDecleration) {
        this.Assignments.filter(
          (c) => (c.Left as VariableDecleration) === member
        )
          .filter((c) => c.Right instanceof Reserve)
          .forEach((c) => {
            let reserve = c.Right as Reserve;
            // Try to get the size of the reserve
            let size = reserve.GetSize(scope);
            if (size === null)
              throw new Error("Cannot determine size of reserve");
            // Increase the size of the object to fit it
            objectType.Size += size;
            reserve.ClassMember = true;
          });
      }
      if (member instanceof FunctionDefinition) {
        if (classType.Children[name.Name]) {
          classType.Children[name.Name] = [
            type,
            classType.Children[name.Name][1],
            member.Label,
          ];
        } else {
          classType.Children[name.Name] = [
            type,
            classType.Size++,
            member.Label,
          ];
        }
      }
    }

    // Find all const values and set them up.
    for (let i = 0; i < this.Constants.length; i++) {
      let c = this.Constants[i];
      objectType.ConstantChildren[c.Identifier!.Name] = [
        c.GetTypes(scope)[0],
        0,
      ];
    }
    for (let i = 0; i < this.StaticConstants.length; i++) {
      let c = this.StaticConstants[i];
      classType.ConstantChildren[c.Identifier!.Name] = [
        c.GetTypes(scope)[0],
        0,
      ];
    }
    objectType.Assignments = this.Assignments;
    scope.UserTypes[this.Name!.Name] = objectType;
    scope.UserTypes["type" + this.Name!.Name] = classType;
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
    asm.push(this.GetLine());
    var falseClaimer = new Claimer("");
    var falseFlag = falseClaimer.Flag();
    var t = new VarType(falseClaimer, falseFlag);
    t.TypeName = "type" + this.Name!.Name;
    var typeVarLabel = scope.GetSafeName(`vartype${this.Name!.Name}`);
    scope.Vars[this.Name!.Name] = [t, typeVarLabel, null];
    scope.AllVars[typeVarLabel] = [
      t,
      this.Name!.Name,
      scope.CurrentFile,
      scope.CurrentFunction,
    ];
    scope.Assembly.push(`${typeVarLabel}: db ${classDef.ClassLabel}`);
    asm.push(`${classDef.ClassLabel}:`);
    for (var i = 0; i < this.StaticMembers.length; i++) {
      let member = this.StaticMembers[i];
      if (member instanceof FunctionDefinition) {
        member.IsMeta = true;
        member.TryEvaluate(scope);
      }
    }
    // Load Virtual members into the class as well
    for (let i = 0; i < this.VirtualMembers.length; i++) {
      let member = this.VirtualMembers[i];
      if (member instanceof FunctionDefinition) {
        member.IsMeta = true;
        member.TryEvaluate(scope);
      }
    }
    // Evaluate constructors
    for (let i = 0; i < this.Constructors.length; i++) {
      var constructor = this.Constructors[i];
      constructor.TryEvaluate(scope);
    }
    for (let i = 0; i < this.Members.length; i++) {
      var member = this.Members[i];
      if (member instanceof FunctionDefinition) member.TryEvaluate(scope);
    }
    if (!this.IsAbstract) {
      var newMethod = this.GenerateNewMethod(scope);
      classDef.Children["new"][2] = newMethod;
    }
    var vars: string[] = ["0"];
    for (var id in classDef.Children) {
      var child = classDef.Children[id];
      vars[child[1]] = child[2];
    }
    let varsOrZeros = [];
    for(let i=0; i<classDef.Size; i++){
      varsOrZeros.push(vars[i] ?? "0");
    }
    asm.push(`db ${varsOrZeros.join(",")}`);
    scope.Assembly.push(...asm);
    // Execute all static assignments
    asm = [];
    for (let i = 0; i < this.StaticAssignments.length; i++) {
      let assignment = this.StaticAssignments[i];
      let declr = assignment.Left as VariableDecleration;
      if (declr.IsConstant) {
        // Conveniently also handle constant assignment.
        if (!IsSimplifyable(assignment.Right))
          throw new Error("Cannot assign non-constant value to constant");
        let val = (assignment.Right)!.TrySimplify(scope);
        if (val === null)
          throw new Error("Cannot assign non-constant value to constant");
        classDef.ConstantChildren[declr.Identifier!.Name] = [
          declr.GetTypes(scope)[0],
          val,
        ];
        continue;
      }
      // Find which static-child this belongs to.
      let child = classDef.Children[declr.Identifier!.Name];
      let res = assignment.Right!.TryEvaluate(scope);
      asm.push(`setb ${classDef.ClassLabel}`, `addb ${child[1]}`, `apushb`);
      asm.push(...res[1]);
      asm.push(...(VarType.Coax([child[0]], res[0])[0]))
      //for (let spare = 1; spare < res[0].length; spare++) asm.push(...res[0][spare].APop());
      asm.push(`apopa`, `apopb`, `putaptrb`);
    }
    // Also perform non-static constant assignments
    for (let i = 0; i < this.Assignments.length; i++) {
      let assignment = this.Assignments[i];
      let declr = assignment.Left as VariableDecleration;
      if (!declr.IsConstant) continue;
      if (!IsSimplifyable(assignment.Right))
        throw new Error("Cannot assign non-constant value to constant");
      let val = (assignment.Right)!.TrySimplify(scope);
      if (val === null)
        throw new Error("Cannot assign non-constant value to constant");
      objectDef.ConstantChildren[declr.Identifier!.Name] = [
        declr.GetTypes(scope)[0],
        val,
      ];
    }
    return asm;
  }

  DefinitelyReturns(): boolean {
    return false;
  }
}
Statement.RegisterTopLevel(Class.Claim);
