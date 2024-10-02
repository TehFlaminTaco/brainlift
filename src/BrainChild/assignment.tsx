import { Claimer } from "./brainchild";
import { Expression, LeftDonor, RightDonor } from "./expression";
import { Scope } from "./Scope";
import { VarType } from "./vartype";
import {
  Variable,
  Assignable,
  IsAssignable,
  IsSimpleAssignable,
  SimpleAssignable,
} from "./variable";
import { IsSimplifyable, Simplifyable } from "./Simplifyable";

export class Assignment
  extends Expression
  implements LeftDonor, RightDonor, Simplifyable
{
  Left: Expression | null = null;
  Targets: Assignable[] = [];
  Right: Expression | null = null;
  Precedence = 2;
  LeftRightAssociative = false;
  static RightClaim(left: Expression, claimer: Claimer): Assignment | null {
    var flag = claimer.Flag();
    if (!IsAssignable(left)) {
      flag.Fail();
      return null;
    }
    var targets: Assignable[] = [];
    while (true) {
      if (!claimer.Claim(/,/).Success) break;
      var target: Assignable | null = Variable.ClaimAssignable(claimer, true);
      if (target === null) {
        flag.Fail();
        return null;
      }
      targets.push(target);
      target = Variable.ClaimAssignable(claimer, true);
    }
    /* TODO: Add operator here */
    if (!claimer.Claim(/=/).Success) {
      flag.Fail();
      return null;
    }
    var val = Expression.Claim(claimer);
    if (val === null) {
      flag.Fail();
      return null;
    }
    var ass = new Assignment(claimer, left.Claim);
    ass.Targets = targets;
    ass.Left = left;
    ass.Right = val;
    return ass;
  }

  Simplify(scope: Scope): number | null {
    if (IsSimpleAssignable(this.Left) && IsSimplifyable(this.Right)) {
      let n = (this.Right as any as Simplifyable).Simplify(scope);
      if (n === null) return null;
      if ((this.Left as any as SimpleAssignable).AssignSimple(scope, n))
        return n;
    }
    return null;
  }

  Evaluate(scope: Scope): [VarType[], string[]] {
    if (IsSimpleAssignable(this.Left) && IsSimplifyable(this.Right)) {
      let n = (this.Right as any as Simplifyable).Simplify(scope);
      if (n !== null) {
        if ((this.Left as any as SimpleAssignable).AssignSimple(scope, n)) {
          return [
            (this.Left as any as Assignable).GetTypes(scope),
            [`apush ${(n & 0xffffffff) >>> 0}`],
          ];
        }
      }
    }
    var o: string[] = [this.GetLine()];
    var res = this.Right!.TryEvaluate(scope);
    o.push(...res[1]);
    var targetTypes: VarType[] = [];
    let targs: Assignable[] = [
      this.Left as unknown as Assignable,
      ...this.Targets,
    ];
    for (let i = 0; i < targs.length; i++) {
      targetTypes.push(...targs[i].GetTypes(scope));
    }
    // Match targetTypes to next fit returnType.
    var coaxed = VarType.Coax(targetTypes, res[0]);
    o.push(...coaxed[0]);
    for (let i = targs.length - 1; i >= 0; i--) {
      o.push(...targs[i].Assign(scope, coaxed[2][i]));
    }
    for (let i = 0; i < targs.length; i++) {
      o.push(...(targs[i] as unknown as Expression).TryEvaluate(scope)[1]);
    }
    // Redefine them for the purse of `var a = 3`.
    targetTypes = [];
    for (let i = 0; i < targs.length; i++) {
      targetTypes.push(...targs[i].GetTypes(scope));
    }
    return [targetTypes, o];
  }

  DefinitelyReturns(): boolean {
    return false;
  }

  GetTypes(scope: Scope): VarType[] {
    let targetTypes: VarType[] = [];
    let targs: Assignable[] = [
      this.Left as unknown as Assignable,
      ...this.Targets,
    ];
    for (let i = 0; i < targs.length; i++) {
      targetTypes.push(...targs[i].GetTypes(scope));
    }
    return targetTypes;
  }
}

Expression.RegisterRight(Assignment.RightClaim);
