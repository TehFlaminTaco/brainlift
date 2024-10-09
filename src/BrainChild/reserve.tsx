/*
    reserve (length)
    reserve (type)(arguments...)

    Reserves either a set number of ints, or an object
    If it's an object, it runs the respective constructor with the arguments

    (If you MUST reserve an object without constructing, use reserve sizeof type)
*/

import { Claim, Claimer } from "./brainchild";
import { Expression } from "./expression";
import { Scope } from "./Scope";
import { VarType } from "./vartype";
import { Simplifyable, IsSimplifyable } from "./Simplifyable";
import { VariableDecleration } from "./variabledefinition";

export class Reserve extends Expression {
  // Will be one of Length, or Type + Arguments
  Length: Simplifyable | null = null;
  Type: VarType | null = null;
  Arguments: Expression[] = [];
  Label: string | null = null;
  ClassMember: boolean = false;

  static Claim(claimer: Claimer): Reserve | null {
    var ret = claimer.Claim(/reserve\b/);
    if (!ret.Success) return null;
    // Try to claim a vartype followed by arguments
    let r =
      Reserve.ClaimType(claimer, ret) ?? Reserve.ClaimLength(claimer, ret);
    if (r === null) {
      ret.Fail();
      return null;
    }
    return r;
  }

  static ClaimType(claimer: Claimer, start: Claim): Reserve | null {
    let flag = claimer.Flag();
    let vt = VarType.Claim(claimer);
    if (vt === null) {
      flag.Fail();
      return null;
    }
    if (!claimer.Claim(/\(/).Success) {
      flag.Fail();
      return null;
    }
    let args: Expression[] = [];
    let c = Expression.Claim(claimer);
    while (c !== null) {
      args.push(c);
      if (!claimer.Claim(/,/).Success) break;
      c = Expression.Claim(claimer);
    }
    if (!claimer.Claim(/\)/).Success) {
      flag.Fail();
      return null;
    }
    let r = new Reserve(claimer, start);
    r.Type = vt;
    r.Arguments = args;
    return r;
  }

  static ClaimLength(claimer: Claimer, start: Claim): Reserve | null {
    let flag = claimer.Flag();
    let len = Expression.Claim(claimer);
    if (len === null || !IsSimplifyable(len)) {
      flag.Fail();
      return null;
    }
    let r = new Reserve(claimer, start);
    r.Length = len as any as Simplifyable;
    return r;
  }

  GetLabel(scope: Scope) {
    if (this.Label === null) {
      this.Label = scope.GetSafeName(`reserve`);
    }
    return this.Label;
  }

  GetSize(scope: Scope): number | null {
    if (this.Length !== null) {
      let n = (this.Length as any as Expression).TrySimplify(scope);
      if (n === null) {
        throw new Error("Reserve length must be a constant value");
      }
      return n;
    }
    let typeDef = this.Type!.GetDefinition();
    return typeDef.Size;
  }

  Evaluate(scope: Scope): [stack: VarType[], body: string[]] {
    if (this.Length !== null) {
      if (this.ClassMember)
        return [
          [VarType.VoidPtr],
          [this.GetLine(), `apopb`, `apushb`, `incb`, `apushb`],
        ];
      // Simple reserve style
      let n = (this.Length as any as Expression).TrySimplify(scope);
      if (n === null) {
        throw new Error("Reserve length must be a constant value");
      }
      scope.Assembly.push(this.GetLabel(scope) + ":");
      // DB n 0's
      scope.Assembly.push(`db ${Array(n).fill(0).join(",")}`);
      return [[VarType.VoidPtr], [this.GetLine(), `apush ${this.Label}`]];
    }

    // Object reserve style
    let asm = [this.GetLine()];
    let typeDef = this.Type!.GetDefinition();
    let label = this.GetLabel(scope);
    if (!this.ClassMember) {
      scope.Assembly.push(label + ":");
      // Reserve space for the object
      scope.Assembly.push(`db ${Array(typeDef.Size).fill(0).join(",")}`);
    } else {
      // We're going to copy the top of the A stack to the B stack, which contains a pointer to this, so we can access once all the arguments are resolved.
      // (Because the A stack contains a reference to where we are editing, that we must preserve)
      asm.push(`apopb`, `apushb`, `bpushb`);
    }
    // Push the arguments to the stack
    let argTypes: VarType[] = [];
    for (let i = 0; i < this.Arguments.length; i++) {
      let arg = this.Arguments[i].TryEvaluate(scope);
      asm.push(...arg[1]);
      argTypes.push(...arg[0]);
    }
    argTypes.push(this.Type!);
    let constructorMetamethod = scope.GetMetamethod(
      this.Type!.TypeName,
      argTypes
    );
    if (constructorMetamethod === null) {
      throw new Error(`Cannot find constructor for ${this.Type!.TypeName}`);
    }
    if (this.ClassMember) {
      // Pop the B stack and put it back unto the A stack
      // And push it back onto the B stack so we can restore it later
      asm.push(`bpopb`, `bpushb`); // We also incb, because we start writing 1 int after this, because this is the reference to this. Confusing I know.
    } else {
      // Push the label to the stack
      asm.push(`setb ${label}`);
    }
    // Put the class label in
    // asm.push(`seta ${typeDef.ClassLabel}`, `putaptrb`, `incb`);
    // Manually set up children
    var childrenByOffset = [];
    for (let id in typeDef.Children) {
      let child = typeDef.Children[id];
      childrenByOffset[child[1]] = [id, child];
    }
    for (let i = 0; i < childrenByOffset.length; i++) {
      let child = childrenByOffset[i];
      if (child) {
        // Check if there's a non-static assignment for this child.
        let possibleAssignments = typeDef.Assignments.filter(
          (c) => (c.Left as VariableDecleration).Identifier!.Name === child[0]
        );
        if (possibleAssignments.length > 0) {
          if (possibleAssignments.length > 1)
            throw new Error(`Ambiguous default value for ${child[0]}`);
          asm.push(`  apushb`);
          let res = possibleAssignments[0].Right!.TryEvaluate(scope);
          asm.push(...res[1]);
          for (let spare = 1; spare < res[0].length; spare++)
            asm.push(`    apop`);
          asm.push(`    apopa`, `    apopb`, `    putaptrb`);
        } else {
          asm.push(`  seta ${child[1][2]}`, `  putaptrb`);
        }
      }
      if (i < childrenByOffset.length - 1) asm.push(`  incb`);
    }
    if (this.ClassMember) {
      asm.push(`bpopb`, `apushb`, `bpushb`);
    } else {
      asm.push(`apush ${label}`);
    }
    asm.push(...constructorMetamethod[2]);
    if (this.ClassMember) {
      asm.push(`bpopb`, `apushb`);
    } else {
      asm.push(`apush ${label}`);
    }
    return [[this.Type!], asm];
  }
  GetTypes(scope: Scope): VarType[] {
    if (this.Length !== null) return [VarType.VoidPtr];
    return [this.Type!];
  }
}

Expression.Register(Reserve.Claim);
