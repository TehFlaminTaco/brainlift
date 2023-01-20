import { Claimer } from "./brainchild";
import { Identifier } from "./identifier";
import { Statement } from "./statement";
import { Scope } from "./Scope";
import { VarType } from "./vartype";
import { Assignable, Variable } from "./variable";

export class VariableDecleration extends Statement implements Assignable {
  Type: VarType | null = null;
  Identifier: Identifier | null = null;
  Label: string = "";
  static Claim(
    claimer: Claimer,
    allowAny: boolean = false
  ): VariableDecleration | null {
    var flag = claimer.Flag();
    var typ: VarType | null;
    if (claimer.Claim(/any\b/).Success) {
      if (!allowAny) {
        throw new Error(
          "Variable defintion must include known type if not provided when defined."
        );
      }
      typ = VarType.Any;
    } else {
      typ = VarType.Claim(claimer);
      if (typ === null) {
        flag.Fail();
        return null;
      }
    }
    var ident = Identifier.Claim(claimer);
    if (ident === null) {
      flag.Fail();
      return null;
    }
    var vd = new VariableDecleration(claimer, flag);
    vd.Type = typ;
    vd.Identifier = ident;
    return vd;
  }

  Evaluate(scope: Scope): string[] {
    if (this.Type !== VarType.Any)
      this.Label = scope.Set(this.Identifier!.Name, this.Type!);
    return [];
  }

  Assign(scope: Scope, anyType: VarType): string[] {
    this.Label ||= scope.Set(
      this.Identifier!.Name,
      this.Type!.TypeName === "var" ? anyType : this.Type!
    );
    return [`apopb`, `seta ${this.Label}`, `putbptra`];
  }

  GetType(scope: Scope): VarType {
    return this.Type!;
  }
  DefinitelyReturns(): boolean {
    return false;
  }
}

Statement.Register(VariableDecleration.Claim);
Variable.RegisterAssignable(VariableDecleration.Claim);
