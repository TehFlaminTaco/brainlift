import { Claimer } from "./brainchild";
import { Expression } from "./expression";
import { Scope } from "./Scope";
import { VarType } from "./vartype";
import { Simplifyable, IsSimplifyable } from "./Simplifyable";

export class Parenthetical extends Expression implements Simplifyable {
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
    if (vals.length === 0) {
      lbr.Fail();
      return null;
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
    let v = this.Simplify();
    if (v !== null)
      return [[VarType.Int], [this.GetLine(), `apush ${v & 0xffff}`]];
    var receivedTypes: VarType[] = [];
    var o: string[] = [];

    for (let i = 0; i < this.Values.length; i++) {
      let res = this.Values[i].TryEvaluate(scope);
      receivedTypes.push(...res[0]);
      o.push(...res[1]);
    }

    var outTypes: VarType[] =
      this.Types.length > 0 ? this.Types : [receivedTypes[0]];

    for (let i = 0; i < receivedTypes.length - outTypes.length; i++) {
      o.push(`apop`);
    }

    return [outTypes, o];
  }

  GetTypes(scope: Scope): VarType[] {
    var receivedTypes: VarType[] = [];
    for (let i = 0; i < this.Values.length; i++) {
      let res = this.Values[i].GetTypes(scope);
      receivedTypes.push(...res);
    }
    var outTypes: VarType[] =
      this.Types.length > 0 ? this.Types : [receivedTypes[0]];
    return outTypes;
  }

  Simplify(): number | null {
    if (
      this.Types.length > 0 &&
      (this.Types.length > 1 || !this.Types[0].Equals(VarType.Int))
    )
      return null;
    if (this.Values.length === 0) return null;
    if (IsSimplifyable(this.Values[0]))
      return (this.Values[0] as unknown as Simplifyable).Simplify();
    return null;
  }
}
Expression.Register(Parenthetical.Claim);
