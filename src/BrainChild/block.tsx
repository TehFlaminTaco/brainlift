import { Claimer } from "./brainchild";
import { Statement } from "./statement";
import { Scope } from "./Scope";

export class Block extends Statement {
  Statements: Statement[] = [];
  static Claim(claimer: Claimer): Block | null {
    var blk = claimer.Claim(/\{/);
    if (!blk.Success) {
      return null;
    }
    var statements = [];
    var s = Statement.Claim(claimer);
    while (s !== null) {
      statements.push(s);
      claimer.Claim(/;/);
      s = Statement.Claim(claimer);
    }
    if (!claimer.Claim(/}/).Success) {
      blk.Fail();
      return null;
    }
    var block = new Block(claimer, blk);
    block.Statements = statements;
    return block;
  }

  Evaluate(scope: Scope): string[] {
    var subScope = scope.Sub();
    var o = [];
    for (var i = 0; i < this.Statements.length; i++) {
      o.push(...this.Statements[i].Evaluate(subScope));
    }
    return o;
  }

  DefinitelyReturns(): boolean {
    for (let i = 0; i < this.Statements.length; i++) {
      if (this.Statements[i].DefinitelyReturns()) return true;
    }
    return false;
  }
}
Statement.Register(Block.Claim);
