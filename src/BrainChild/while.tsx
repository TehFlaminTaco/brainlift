import { Guid } from "js-guid";
import { Claimer } from "./brainchild";
import { Expression } from "./expression";
import { Scope } from "./Scope";
import { IsSimplifyable, Simplifyable } from "./Simplifyable";
import { VarType } from "./vartype";

export class While extends Expression implements Simplifyable {
  static SimpleHash: string = new Guid().toString();
  static HashStack: string[] = [];
  HashName: string = new Guid().toString();
  SimplifiesTo: Map<string, number> = new Map();
  Simplify(scope: Scope): number | null {
    if (
      this.SimplifiesTo.has(While.SimpleHash) &&
      this.SimplifiesTo.get(While.SimpleHash) !== null
    )
      return this.SimplifiesTo.get(While.SimpleHash)!;
    if (!IsSimplifyable(this.Condition)) return null;
    let loops = 0;
    let lastRes: number | null = 0;
    while (loops++ < 1000) {
      While.HashStack.push(While.SimpleHash);
      While.SimpleHash = this.HashName + "." + loops;
      try {
        let c = (this.Condition as any as Simplifyable).Simplify(scope);
        if (c === null) return null;
        if (c === 0) {
          this.SimplifiesTo.set(
            While.HashStack[While.HashStack.length - 1],
            lastRes
          );
          return lastRes;
        } else {
          if (!IsSimplifyable(this.Body)) return null;
          lastRes = (this.Body as any as Simplifyable).Simplify(scope);
          if (lastRes === null) return null;
        }
      } finally {
        While.SimpleHash = While.HashStack.pop()!;
      }
    }
    return null;
  }
  Condition: Expression | null = null;
  Body: Expression | null = null;

  static Claim(claimer: Claimer): While | null {
    var f = claimer.Claim(/while\b/);
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
    var outF = new While(claimer, f);
    outF.Condition = cond;
    outF.Body = body;
    return outF;
  }

  Evaluate(scope: Scope): [VarType[], string[]] {
    let simpleRes = this.Simplify(scope);
    if (simpleRes !== null)
      return [[VarType.Int], [`xpush ${(simpleRes & 0xffffffff) >>> 0}`]];
    var o: string[] = [this.GetLine()];
    var condition = scope.GetSafeName(`whlcond${this.Condition!.toString()}`);
    var whileTrue = scope.GetSafeName(`whltrue${this.Condition!.toString()}`);
    var afterTrue = scope.GetSafeName(`whldone${this.Condition!.toString()}`);
    var valueRes = this.Condition!.TryEvaluate(scope);
    o.push(`${condition}:`);
    o.push(...valueRes[1]);
    for (var i = 1; i < valueRes[0].length; i++) {
      o.push(...valueRes[0][i].XPop());
    }
    var resType = valueRes[0][0];
    var meta = scope.GetMetamethod("truthy", [resType]);
    if (meta === null) {
      throw new Error(`Type ${resType} has no truth method`);
    }
    if (!VarType.CanCoax([VarType.Int], meta[0])[0]) {
      throw new Error("Condition's truthy method must resolve to an int");
    }
    o.push(...meta[2]);
    o.push(...VarType.Coax([VarType.Int], meta[0])[0]);
    o.push(`xpopa`, `jnza ${whileTrue}`);
    o.push(`jmp ${afterTrue}`, `${whileTrue}:`);
    let res = this.Body!.TryEvaluate(scope);
    o.push(...res[1].map((c) => `  ${c}`));
    for (let i = 0; i < res[0].length; i++) o.push(`xpop`);
    o.push(`jmp ${condition}`, `${afterTrue}:`);
    return [[], o];
  }
  DefinitelyReturns(scope: Scope): false|VarType[] {
    let c = this.Condition!.DefinitelyReturns(scope);
    if(c)return c;
    this.Body!.DefinitelyReturns(scope);
    return false;
  }
  PotentiallyReturns(scope: Scope): false|VarType[] {
    return this.Condition!.DefinitelyReturns(scope) || VarType.MostSimilar(this.Condition!.PotentiallyReturns(scope),this.Body!.PotentiallyReturns(scope),true);
  }
  GetTypes(scope: Scope): VarType[] {
    if (this.Simplify(scope) !== null) return [VarType.Int];
    else return [];
  }
}
Expression.Register(While.Claim);
