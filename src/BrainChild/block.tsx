import { Claimer } from "./brainchild";
import { Expression } from "./expression";
import { Scope } from "./Scope";
import { VarType } from "./vartype";

export class Block extends Expression {
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
    var subScope = scope.Sub();
    var o = [];
    var lastTypes: VarType[] = [];
    for (var i = 0; i < this.Expressions.length; i++) {
      var res = this.Expressions[i].TryEvaluate(subScope);
      o.push(...res[1]);
      if(i < (this.Expressions.length - 1)){
        for(let j=0; j < res[0].length; j++)o.push(`apop`);
      }else{
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
  
  GetTypes(scope: Scope): VarType[] {
    var subScope = scope.Sub();
    if(this.Expressions.length === 0)return [];
    var res = this.Expressions[this.Expressions.length-1].GetTypes(subScope);
    return res;
  }
}
Expression.Register(Block.Claim);
