import { Claimer } from "./brainchild";
import { Expression } from "./expression";
import { Scope } from "./Scope";
import { Statement } from "./statement";
import { VarType } from "./vartype";

export class If extends Statement {
  Condition: Expression | null = null;
  Body: Statement | null = null;
  Else: Statement | null = null;

  static Claim(claimer: Claimer): If | null {
    var f = claimer.Claim(/if\b/);
    if (!f.Success) return null;
    var cond = Expression.Claim(claimer);
    if (cond === null) {
      f.Fail();
      return null;
    }
    var body = Statement.Claim(claimer);
    if (body === null) {
      f.Fail();
      return null;
    }
    var els: Statement | null = null;
    if (claimer.Claim(/else(?:\b|(?=if))/).Success) {
      els = Statement.Claim(claimer);
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

  Evaluate(scope: Scope): string[] {
    var o: string[] = [];
    var valueRes = this.Condition!.Evaluate(scope);
    o.push(this.GetLine(), ...valueRes[1]);
    for (var i = 1; i < valueRes[0].length; i++) {
      o.push(`apop`);
    }
    var resType = valueRes[0][0];
    var meta = resType.GetDefinition().GetMetamethod("truthy", [resType]);
    if (meta === null) {
      throw new Error(`Type ${resType} has no truth method`);
    }
    if (!VarType.CanCoax([VarType.Int], meta[0])) {
      throw new Error("Condition's truthy method must resolve to an int");
    }
    var ifTrue = scope.GetSafeName(`iftrue${this.Condition!.toString()}`);
    var afterTrue = scope.GetSafeName(`ifdone${this.Condition!.toString()}`);
    o.push(...meta[2]);
    o.push(...VarType.Coax([VarType.Int], meta[0]));
    o.push(`apopa`, `jnza ${ifTrue}`);
    if (this.Else !== null) {
      o.push(...this.Else.Evaluate(scope).map((c) => `  ${c}`));
    }
    o.push(`jmp ${afterTrue}`, `${ifTrue}:`);
    o.push(...this.Body!.Evaluate(scope).map((c) => `  ${c}`));
    o.push(`${afterTrue}:`);
    return o;
  }
  DefinitelyReturns(): boolean {
    return (
      this.Else != null &&
      this.Body!.DefinitelyReturns() &&
      this.Else!.DefinitelyReturns()
    );
  }
}
Statement.Register(If.Claim);
