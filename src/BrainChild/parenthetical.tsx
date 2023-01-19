import { Claimer } from "./brainchild";
import { Expression } from "./expression";
import { Scope } from "./Scope";
import { VarType } from "./vartype";

export class Parenthetical extends Expression {
  Values: Expression[] = [];
  Types: VarType[] = [];
  static Claim(claimer: Claimer): Parenthetical | null {
    var lbr = claimer.Claim(/\(/);
    if (!lbr.Success) return null;
    var vals: Expression[] = [];
    let c = Expression.Claim(claimer);
    while (c !== null) {
      vals.push(c);
      if (!claimer.Claim(/,/).Success) break;
      c = Expression.Claim(claimer);
    }
    var typs: VarType[] = [];
    if (claimer.Claim(/->/).Success) {
      let t = VarType.Claim(claimer);
      while (t !== null) {
        typs.push(t);
        if (!claimer.Claim(/,/).Success) break;
        t = VarType.Claim(claimer);
      }
    }
    if (!claimer.Claim(/\)/).Success) {
      lbr.Fail();
      return null;
    }
    var paren = new Parenthetical(claimer, lbr);
    paren.Types = typs;
    paren.Values = vals;
    return paren;
  }

  Evaluate(scope: Scope): [stack: VarType[], body: string[]] {
    var receivedTypes: VarType[] = [];
    var o: string[] = [];

    for(let i=0; i < this.Values.length; i++){
      let res = this.Values[i].Evaluate(scope);
      receivedTypes.push(...res[0]);
      o.push(...res[1]);
    }

    var outTypes: VarType[] = this.Types.length > 0 ? this.Types : [receivedTypes[0]];

    for(let i=0; i < receivedTypes.length - outTypes.length; i++){
      o.push(`apop`);
    }

    return [outTypes, o];
  }
}
Expression.Register(Parenthetical.Claim);