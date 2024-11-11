import { Claimer } from "./brainchild";
import { Expression } from "./expression";
import { Scope } from "./Scope";
import { VarType } from "./vartype";
import { Simplifyable } from "./Simplifyable";

export class NumberConstant extends Expression implements Simplifyable {
  Value: number = 0;
  static Claim(claimer: Claimer): NumberConstant | null {
    var n = claimer.Claim(/(?:0[bB][01](?:_?[01])*)|(?:0[xX][0-9A-Fa-f](?:_?[0-9A-Fa-f])*)|(?:\d(?:_?\d)*)/);
    if (!n.Success) {
      return null;
    }
    let text = n.Body![0].replace(/_/g,"");
    if(text.match(/^\s*(?:\d(?:_?\d)*)$/))
      text = text.replace(/^\s*0*/,"");
    var v = +text;
    if (v > 0xFFFFFFFF) {
      throw new Error("Number constant must be between 0x0 and 0xFFFFFFFF");
    }
    var nc = new NumberConstant(claimer, n);
    nc.Value = v;
    return nc;
  }

  Evaluate(scope: Scope): [stack: VarType[], body: string[]] {
    return [[VarType.Int], [this.GetLine(), `apush ${this.Value}`]];
  }

  GetTypes(scope: Scope): VarType[] {
    return [VarType.Int];
  }

  Simplify(): number | null {
    return this.Value;
  }
}
Expression.Register(NumberConstant.Claim);
