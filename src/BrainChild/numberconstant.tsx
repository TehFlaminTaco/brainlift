import { Claimer } from "./brainchild";
import { Expression } from "./expression";
import { Scope } from "./Scope";
import { VarType } from "./vartype";
import { Simplifyable } from "./Simplifyable";

export class NumberConstant extends Expression implements Simplifyable {
  Value: number = 0;
  static Claim(claimer: Claimer): NumberConstant | null {
    var n = claimer.Claim(/(?:0[xX][0-9A-Fa-f]+)|(?:0*\d+)/);
    if (!n.Success) {
      return null;
    }
    var v = +n.Body![0];
    if (v > 0xFFFFFFFF) {
      throw new Error("Number constant must be between 0x0 and 0xFFFFFFFF");
    }
    var nc = new NumberConstant(claimer, n);
    nc.Value = +n.Body![0];
    return nc;
  }

  Evaluate(scope: Scope): [stack: VarType[], body: string[]] {
    return [[VarType.Int], [this.GetLine(), `apush ${this.Value}`]];
  }

  GetTypes(scope: Scope): VarType[] {
    return [VarType.Int];
  }

  Simplify(): number | null {
    return this.Value;
  }
}
Expression.Register(NumberConstant.Claim);
