import { Claimer } from "./brainchild";
import { Expression } from "./expression";
import { Scope } from "./Scope";
import { VarType } from "./vartype";

export class CharConstant extends Expression {
  Value: number = 0;
  static Claim(claimer: Claimer): CharConstant | null {
    var n = claimer.Claim(/'\\?.'/);
    if (!n.Success) {
      return null;
    }
    var v: number = 0;
    if (n.Body![0] === "'\"'") {
      v = 32;
    } else {
      v = JSON.parse(n.Body![0].replace(/'(\\?.)'/, '"$1"')).charCodeAt(0);
    }
    var nc = new CharConstant(claimer, n);
    nc.Value = v;
    return nc;
  }

  Evaluate(scope: Scope): [stack: VarType[], body: string[]] {
    return [[VarType.Int], [this.GetLine(), `apush ${this.Value}`]];
  }
}
Expression.Register(CharConstant.Claim);
