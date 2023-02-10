import { Claimer } from "./brainchild";
import { Expression } from "./expression";
import { Scope } from "./Scope";
import { VarType } from "./vartype";

export class While extends Expression {
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
    var o: string[] = [this.GetLine()];
    var condition = scope.GetSafeName(`whlcond${this.Condition!.toString()}`);
    var whileTrue = scope.GetSafeName(`whltrue${this.Condition!.toString()}`);
    var afterTrue = scope.GetSafeName(`whldone${this.Condition!.toString()}`);
    var valueRes = this.Condition!.TryEvaluate(scope);
    o.push(`${condition}:`);
    o.push(...valueRes[1]);
    for (var i = 1; i < valueRes[0].length; i++) {
      o.push(`apop`);
    }
    var resType = valueRes[0][0];
    var meta = resType.GetDefinition().GetMetamethod("truthy", [resType]);
    if (meta === null) {
      throw new Error(`Type ${resType} has no truth method`);
    }
    if (!VarType.CanCoax([VarType.Int], meta[0])[0]) {
      throw new Error("Condition's truthy method must resolve to an int");
    }
    o.push(...meta[2]);
    o.push(...VarType.Coax([VarType.Int], meta[0])[0]);
    o.push(`apopa`, `jnza ${whileTrue}`);
    o.push(`jmp ${afterTrue}`, `${whileTrue}:`);
    let res = this.Body!.TryEvaluate(scope);
    o.push(...res[1].map((c) => `  ${c}`));
    for (let i = 0; i < res[0].length; i++) o.push(`apop`);
    o.push(`jmp ${condition}`, `${afterTrue}:`);
    return [[], o];
  }
  DefinitelyReturns(): boolean {
    return false;
  }
  GetTypes(): VarType[] {
    return [];
  }
}
Expression.Register(While.Claim);
