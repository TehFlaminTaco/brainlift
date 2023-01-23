import { Claimer } from "./brainchild";
import { Expression } from "./expression";
import { Scope } from "./Scope";
import { VarType } from "./vartype";

export class NumberConstant extends Expression {
  Value: number = 0;
  static Claim(claimer: Claimer): NumberConstant | null {
    var n = claimer.Claim(/(?:0[xX][\\dA-Fa-f]+)|(?:0*\d+)/);
    if (!n.Success) {
      return null;
    }
    var v = +n.Body![0];
    if (v > 63553) {
      throw new Error("Number constant must be between 0 and 63553");
    }
    var nc = new NumberConstant(claimer, n);
    nc.Value = +n.Body![0];
    return nc;
  }

  Evaluate(scope: Scope): [stack: VarType[], body: string[]] {
    return [[VarType.Int], [this.GetLine(), `apush ${this.Value}`]];
  }
}
Expression.Register(NumberConstant.Claim);
