import { Claimer } from "./brainchild";
import { Expression } from "./expression";
import { Scope } from "./Scope";
import { VarType } from "./vartype";

export class StringConstant extends Expression {
  Value: string = "";
  static Claim(claimer: Claimer): StringConstant | null {
    var s = claimer.Claim(/"(\\[bfnrt"\\]|.)*?"/);
    if (!s.Success) return null;
    var str = new StringConstant(claimer, s);
    str.Value = JSON.parse(s.Body![0]);
    return str;
  }

  Evaluate(scope: Scope): [stack: VarType[], body: string[]] {
    var label = scope.GetSafeName(`str${this.Value}`);
    var stringDef = `${label}: db ${this.Value.length}, `;
    var comma = "";
    for (var i = 0; i < this.Value.length; i++) {
      stringDef += comma + this.Value.charCodeAt(i);
      comma = ", ";
    }
    scope.Assembly.push(stringDef);
    return [
      [VarType.IntPtr],
      [this.GetLine(), `apush ${label}`],
    ];
  }

  GetTypes(scope: Scope): VarType[] {
    return [VarType.IntPtr];
  }
}
Expression.Register(StringConstant.Claim);
