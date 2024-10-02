import { Claimer } from "./brainchild";
import { Expression } from "./expression";
import { Scope } from "./Scope";
import { IsSimplifyable, Simplifyable } from "./Simplifyable";
import { VarType } from "./vartype";

export class If extends Expression implements Simplifyable {
  Condition: Expression | null = null;
  Body: Expression | null = null;
  Else: Expression | null = null;

  static Claim(claimer: Claimer): If | null {
    var f = claimer.Claim(/if\b/);
    if (!f.Success) return null;
    var cond = Expression.Claim(claimer);
    if (cond === null) {
      f.Fail();
      return null;
    }
    var body = Expression.Claim(claimer);
    if (body === null) {
      f.Fail();
      return null;
    }
    var els: Expression | null = null;
    if (claimer.Claim(/else(?:\b|(?=if))/).Success) {
      els = Expression.Claim(claimer);
      if (els === null) {
        f.Fail();
        return null;
      }
    }
    var outF = new If(claimer, f);
    outF.Condition = cond;
    outF.Body = body;
    outF.Else = els;
    return outF;
  }

  GetTypes(scope: Scope): VarType[] {
    if (this.Else === null) return [];
    let mutualTypes: VarType[] = [];
    let a = this.Body!.GetTypes(scope);
    let b = this.Else.GetTypes(scope);
    for (let i = 0; i < a.length; i++) {
      if (a[i] === b[i]) mutualTypes.push(a[i]);
      else return mutualTypes;
    }
    return mutualTypes;
  }

  Evaluate(scope: Scope): [VarType[], string[]] {
    if (IsSimplifyable(this.Condition)) {
      let res = (this.Condition! as unknown as Simplifyable).Simplify(scope);
      if (res !== null) {
        res = res & 0xffffffff;
        if (res) {
          return this.Body!.TryEvaluate(scope);
        } else if (this.Else) {
          return this.Else!.TryEvaluate(scope);
        } else {
          return [[], []];
        }
      }
    }
    var o: string[] = [];
    let resTypes = this.GetTypes(scope);
    var valueRes = this.Condition!.TryEvaluate(scope);
    o.push(this.GetLine(), ...valueRes[1]);
    for (var i = 1; i < valueRes[0].length; i++) {
      o.push(`apop`);
    }
    var resType = valueRes[0][0];
    var meta = scope.GetMetamethod("truthy", [resType]);
    if (meta === null) {
      throw new Error(`Type ${resType} has no truth method`);
    }
    if (!VarType.CanCoax([VarType.Int], meta[0])[0]) {
      throw new Error("Condition's truthy method must resolve to an int");
    }
    var ifTrue = scope.GetSafeName(`iftrue${this.Condition!.toString()}`);
    var afterTrue = scope.GetSafeName(`ifdone${this.Condition!.toString()}`);
    o.push(...meta[2]);
    o.push(...VarType.Coax([VarType.Int], meta[0])[0]);
    o.push(`apopa`, `jnza ${ifTrue}`);
    if (this.Else !== null) {
      let res = this.Else.TryEvaluate(scope);
      o.push(...res[1].map((c) => `  ${c}`));
      for (let i = resTypes.length; i < res[0].length; i++) {
        o.push(`apop`);
      }
    }
    o.push(`jmp ${afterTrue}`, `${ifTrue}:`);
    let res = this.Body!.TryEvaluate(scope);
    o.push(...res[1].map((c) => `  ${c}`));
    for (let i = resTypes.length; i < res[0].length; i++) {
      o.push(`apop`);
    }
    o.push(`${afterTrue}:`);
    return [resTypes, o];
  }
  DefinitelyReturns(): boolean {
    return (
      this.Else != null &&
      this.Body!.DefinitelyReturns() &&
      this.Else!.DefinitelyReturns()
    );
  }
  Simplify(scope: Scope): number | null {
    if (this.Condition && IsSimplifyable(this.Condition)) {
      let res = (this.Condition as unknown as Simplifyable).Simplify(scope);
      if (res === null) return null;
      if (res) {
        if (!IsSimplifyable(this.Body)) return null;
        res = (this.Body as unknown as Simplifyable).Simplify(scope);
        return res;
      } else {
        if (!this.Else) return null;
        if (!IsSimplifyable(this.Else)) return null;
        res = (this.Else as unknown as Simplifyable).Simplify(scope);
        return res;
      }
    }
    return null;
  }
}
Expression.Register(If.Claim);
