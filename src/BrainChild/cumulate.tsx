import { Claimer } from "./brainchild";
import { Donor, Expression } from "./expression";
import { Scope } from "./Scope";
import { IsReadWritable, ReadWritable, Variable } from "./variable";
import { VarType } from "./vartype";

var cumulativeOperators: [RegExp, string][] = [
  [/\+\+/, "add"],
  [/--/, "sub"],
];

export class Cumulate extends Expression implements Donor {
  Precedence: number = 14;
  LeftRightAssociative: boolean = true;
  PostFix: boolean = false;
  Target: ReadWritable | null = null;
  Operator: string = "";

  static Claim(claimer: Claimer): Cumulate | null {
    var flag = claimer.Flag();
    for (var i = 0; i < cumulativeOperators.length; i++) {
      let op = cumulativeOperators[i];
      if (claimer.Claim(op[0]).Success) {
        var exp = Variable.ClaimReadWritable(claimer);
        if (exp === null) {
          flag.Fail();
          return null;
        }
        var cumu = new Cumulate(claimer, flag);
        cumu.Target = exp;
        cumu.Operator = op[1];
        return cumu;
      }
    }
    return null;
  }
  static RightClaim(left: Expression, claimer: Claimer): Cumulate | null {
    if (!IsReadWritable(left)) return null;
    let l = left as unknown as ReadWritable;
    var flag = claimer.Flag();
    for (var i = 0; i < cumulativeOperators.length; i++) {
      var op = cumulativeOperators[i];
      if (claimer.Claim(op[0]).Success) {
        var cumu = new Cumulate(claimer, flag);
        cumu.Target = l;
        cumu.Operator = op[1];
        cumu.PostFix = true;
        cumu.Precedence = 15;
        return cumu;
      }
    }
    return null;
  }

  Evaluate(scope: Scope): [stack: VarType[], body: string[]] {
    var o: string[] = [];
    var t = this.Target!.GetType(scope);
    o.push(...this.Target!.Read(scope));
    if (this.PostFix) {
      o.push(`apopa`, `apusha`, `apusha`);
    }
    var metaName = (this.PostFix ? `post` : `pre`) + `crement` + this.Operator;
    var meta = t.GetDefinition().GetMetamethod(metaName, [t]);
    if (meta === null) {
      // Try the math operator instead
      meta = t.GetDefinition().GetMetamethod(this.Operator, [t, VarType.Int]);
      o.push(`apush 1`);
    }
    if (meta === null) {
      throw new Error(`Cannot ${metaName} type ${t}. No metamethod`);
    }

    if (!VarType.AllEquals([t], meta[0])) {
      throw new Error(
        `Metamethod ${metaName} for type ${t} must return the same time.`
      );
    }
    o.push(...meta[2]);
    if (!this.PostFix) {
      o.push(`apopa`, `apusha`, `apusha`);
    }
    o.push(...this.Target!.Assign(scope, t));
    return [[t], o];
  }
}

Expression.Register(Cumulate.Claim);
Expression.RegisterRight(Cumulate.RightClaim);
