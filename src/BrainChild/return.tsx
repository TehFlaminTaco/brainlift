import { Claimer } from "./brainchild";
import { Expression } from "./expression";
import { Scope } from "./Scope";
import { VarType } from "./vartype";
import { Call } from "./call";

export class Return extends Expression {
  Values: Expression[] = [];
  static Claim(claimer: Claimer): Return | null {
    var ret = claimer.Claim(/return\b/);
    if (!ret.Success) return null;
    var vals: Expression[] = [];
    var c = Expression.Claim(claimer);
    while (c !== null) {
      vals.push(c);
      if (!claimer.Claim(/,/).Success) break;
      c = Expression.Claim(claimer);
    }
    var Ret = new Return(claimer, ret);
    Ret.Values = vals;
    return Ret;
  }

  Evaluate(scope: Scope): [VarType[], string[]] {
    if (!scope.IsFunctionScope) {
      throw new Error("Cannot return outside of function.");
    }
    var tStack: VarType[] = [];
    var o: string[] = [this.GetLine()];
    var tailCall = false;
    for (var i = 0; i < this.Values.length; i++) {
      var v = this.Values[i];
      if (i === this.Values.length - 1 && v instanceof Call) {
        var callRes = v.GetTypes(scope);
        if (scope.GetRequiredReturns() === null) {
          scope.SetRequiredReturns(callRes);
        }
        if (
          VarType.AllEquals(scope.GetRequiredReturns()!, tStack.concat(callRes))
        ) {
          tailCall = true;
          v.TailCall = true;
        }
      }
      var res = v.TryEvaluate(scope);
      tStack.push(...res[0]);
      o.push(...res[1]);
    }
    if (scope.GetRequiredReturns() === null) {
      scope.SetRequiredReturns(tStack);
    }
    if (!VarType.CanCoax(scope.GetRequiredReturns()!, tStack)[0]) {
      throw new Error(
        `Unable to return value type: ${tStack} expected ${scope.GetRequiredReturns()}`
      );
    }
    o.push(...VarType.Coax(scope.GetRequiredReturns()!, tStack)[0]);
    if (!tailCall) o.push(`ret`);
    return [[], o];
  }
  DefinitelyReturns(): boolean {
    return true;
  }
  GetTypes(): VarType[] {
    return [];
  }
}
Expression.Register(Return.Claim);
