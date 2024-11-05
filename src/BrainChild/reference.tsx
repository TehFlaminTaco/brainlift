import { Expression } from "./expression";
import { Scope } from "./Scope";
import { VarType } from "./vartype";
import { Referenceable, Variable } from "./variable";
import { Claimer } from "./brainchild";

export class Reference extends Expression {
  Target: Referenceable | null = null;
  static Claim(claimer: Claimer): Reference | null {
    var ref = claimer.Claim(/&/);
    if (!ref.Success) return null;
    var target = Variable.ClaimReferencable(claimer);
    if (target === null) {
      ref.Fail();
      return null;
    }
    var refer = new Reference(claimer, ref);
    refer.Target = target;
    return refer;
  }

  Evaluate(scope: Scope): [stack: VarType[], body: string[]] {
    return [
      this.Target!.GetReferenceTypes(scope),
      this.Target!.GetPointer(scope),
    ];
  }

  GetTypes(scope: Scope): VarType[] {
    return this.Target!.GetReferenceTypes(scope);
  }

  DefinitlyReturns(scope: Scope): false|VarType[] {
    return (this.Target as any as Expression).DefinitelyReturns(scope)
  }
  PotentiallyReturns(scope: Scope): false|VarType[] {
    return (this.Target as any as Expression).PotentiallyReturns(scope);
  }
}

Expression.Register(Reference.Claim);
