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
    var o: string[] = [this.GetLine()];
    var ts = this.Target!.GetTypes(scope);
    ts.forEach((t) => {
      o.push(...this.Target!.Read(scope));
      if (this.PostFix) {
        o.push(...t.CloneA());
      }
      var metaName = (this.Operator === "add" ? "in" : "de") + `crement`;
      var meta = scope.GetMetamethod(metaName, [t]);
      if (meta === null) {
        // Try the math operator instead
        meta = scope.GetMetamethod(this.Operator, [t, VarType.Int]);
        o.push(`xpush 1`);
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
        o.push(...t.CloneA());
      }
      o.push(...this.Target!.Assign(scope, t));
    });
    return [ts, o];
  }

  DefinitelyReturns(scope: Scope): false {
    (this.Target as Expression|null)?.DefinitelyReturns(scope);
    return false;
  }

  GetTypes(scope: Scope): VarType[] {
    return this.Target!.GetTypes(scope);
  }
}

Expression.Register(Cumulate.Claim);
Expression.RegisterRight(Cumulate.RightClaim);
