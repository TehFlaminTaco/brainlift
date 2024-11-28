import { Scope } from "./Scope";
import { IsSimplifyable, Simplifyable } from "./Simplifyable";
import { Assignment } from "./assignment";
import { Claimer } from "./brainchild";
import { Expression } from "./expression";
import { VariableDecleration } from "./variabledefinition";
import { VarType } from "./vartype";

export class Const extends Expression implements Simplifyable {
  Child: Expression | null = null;

  static Claim(claimer: Claimer): Const | null {
    let ret = claimer.Claim(/const\b/);
    if (!ret.Success) return null;
    let child = Expression.Claim(claimer);
    if (
      !child ||
      !IsSimplifyable(child) ||
      child instanceof VariableDecleration ||
      (child instanceof Assignment &&
        (child.Left as Assignment) instanceof VariableDecleration)
    ) {
      ret.Fail();
      return null;
    }
    let c = new Const(claimer, ret);
    c.Child = child;
    return c;
  }

  Simplify(scope: Scope): number | null {
    let res = (this.Child as any as Simplifyable).Simplify(scope);
    if (res === null)
      throw new Error("Could not resolve expression as constant");
    return res;
  }
  Evaluate(scope: Scope): [stack: VarType[], body: string[]] {
    let res = (this.Child as any as Simplifyable).Simplify(scope);
    if (res === null)
      throw new Error("Could not resolve expression as constant");
    return [this.GetTypes(scope), [`xpush ${(res & 0xffffffff) >>> 0}`]];
  }
  GetTypes(scope: Scope): VarType[] {
    return this.Child!.GetTypes(scope);
  }
}

Expression.Register(Const.Claim);
