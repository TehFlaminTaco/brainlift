import { Claimer } from "./brainchild";
import { Scope } from "./Scope";
import { Expression } from "./expression";
import { VarType } from "./vartype";

export class ASM extends Expression {
  Instructions: string[] = [];
  RetTypes: VarType[] = [];
  static Claim(claimer: Claimer) {
    var asm = claimer.Claim(/asm\b/);
    if (!asm.Success) {
      return null;
    }
    var retTypes = [];
    if (claimer.Claim(/->/).Success) {
      var retType = VarType.Claim(claimer);
      while (retType !== null) {
        retTypes.push(retType);
        if (!claimer.Claim(/,/).Success) break;
        retType = VarType.Claim(claimer);
      }
    }
    if (!claimer.Claim(/\{/).Success) {
      asm.Fail();
      return null;
    }
    var theRest = claimer.Claim(/([^}]*)\}/);
    if (!theRest.Success) {
      asm.Fail();
      return null;
    }
    var as = new ASM(claimer, asm);
    as.Instructions = theRest
      .Body![1].split("\n")
      .map((c) => c.replace(/^\s+/, ""));
    as.RetTypes = retTypes;
    return as;
  }
  Evaluate(scope: Scope): [VarType[], string[]] {
    return [
      this.RetTypes,
      [
        this.GetLine(),
        ...this.Instructions.map((c) =>
          c.replace(/\[([a-zA-Z_]\w*\b)\]/, (_, a) => scope.Get(a)[1])
        ),
      ],
    ];
  }

  GetTypes(): VarType[] {
    return this.RetTypes;
  }

  DefinitelyReturns(): false {
    return false;
  }
}
Expression.Register(ASM.Claim);
