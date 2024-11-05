import { Claimer } from "./brainchild";
import { Expression } from "./expression";
import { Statement } from "./statement";
import { Scope } from "./Scope";

export class ExpressionStatement extends Statement {
  Body: Expression | null = null;
  static Claim(claimer: Claimer): ExpressionStatement | null {
    var exp = Expression.Claim(claimer);
    if (exp === null) return null;
    var es = new ExpressionStatement(claimer, exp.Claim);
    es.Body = exp;
    return es;
  }
  Evaluate(scope: Scope): string[] {
    var o: string[] = [];
    var res = this.Body!.TryEvaluate(scope);
    o.push(...res[1]);
    for (var i = 0; i < res[0].length; i++) {
      o.push(...res[0][i].APop());
    }
    return o;
  }
  DefinitelyReturns(): false {
    return false;
  }
}
Statement.Register(ExpressionStatement.Claim);
