import { Claimer } from "./brainchild";
import { Expression } from "./expression";
import { Scope } from "./Scope";
import { IsSimplifyable, Simplifyable } from "./Simplifyable";
import { VarType } from "./vartype";
import { While } from "./while";

export class Block extends Expression implements Simplifyable {
  SimplifiesTo: Map<string, number | null> = new Map();
  KnownScope: Scope | null = null;
  SubScope: Scope | null = null;
  Simplify(scope: Scope): number | null {
    if (
      this.SimplifiesTo.has(While.SimpleHash) &&
      this.SimplifiesTo.get(While.SimpleHash) !== null
    )
      return this.SimplifiesTo.get(While.SimpleHash)!;
    if (this.Expressions.some((c) => !IsSimplifyable(c))) return null;
    let subScope = this.GetSubScope(scope);
    let res: number | null = null;
    for (let i = 0; i < this.Expressions.length; i++) {
      res = this.Expressions[i].TrySimplify(subScope);
      if (res === null) return null;
    }
    this.SimplifiesTo.set(While.SimpleHash, res);
    return res;
  }
  Expressions: Expression[] = [];
  static Claim(claimer: Claimer): Block | null {
    var blk = claimer.Claim(/\{/);
    if (!blk.Success) {
      return null;
    }
    var expressions: Expression[] = [];
    var s = Expression.Claim(claimer);
    while (s !== null) {
      expressions.push(s);
      claimer.Claim(/;/);
      s = Expression.Claim(claimer);
    }
    if (!claimer.Claim(/}/).Success) {
      blk.Fail();
      return null;
    }
    var block = new Block(claimer, blk);
    block.Expressions = expressions;
    return block;
  }

  Evaluate(scope: Scope): [types: VarType[], body: string[]] {
    let simpleRes = this.Simplify(scope);
    if (simpleRes !== null)
      return [
        this.GetTypes(scope),
        [`apush ${(simpleRes & 0xffffffff) >>> 0}`],
      ];
    var subScope = this.GetSubScope(scope);
    var o = [];
    var lastTypes: VarType[] = [];
    for (var i = 0; i < this.Expressions.length; i++) {
      var res = this.Expressions[i].TryEvaluate(subScope);
      o.push(...res[1]);
      if (i < this.Expressions.length - 1) {
        for (let j = 0; j < res[0].length; j++) o.push(...res[0][j].APop())
      } else {
        lastTypes = res[0];
      }
    }
    return [lastTypes, o];
  }

  DefinitelyReturns(): boolean {
    for (let i = 0; i < this.Expressions.length; i++) {
      if (this.Expressions[i].DefinitelyReturns()) return true;
    }
    return false;
  }

  GetSubScope(scope: Scope): Scope {
    if (this.KnownScope !== scope) {
      this.SubScope = scope.Sub();
      this.KnownScope = scope;
    }
    return this.SubScope!;
  }

  GetTypes(scope: Scope): VarType[] {
    this.TrySimplify(scope); // Apparently, this matters :\
    var subScope = this.GetSubScope(scope);
    if (this.Expressions.length === 0) return [];
    var res = this.Expressions[this.Expressions.length - 1].GetTypes(subScope);
    return res;
  }
}
Expression.Register(Block.Claim);
