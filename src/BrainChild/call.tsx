import { Index } from ".";
import { Claimer } from "./brainchild";
import { Expression, LeftDonor } from "./expression";
import { Scope } from "./Scope";
import { FuncType, VarType } from "./vartype";

export class Call extends Expression implements LeftDonor {
  Precedence: number = 17;
  LeftRightAssociative: boolean = false;
  Left: Expression | null = null;
  Arguments: Expression[] = [];
  IsFinalExpression: boolean = false;
  TailCall: boolean = false;
  static RightClaim(left: Expression, claimer: Claimer): Call | null {
    var lbrack = claimer.Claim(/\(/);
    if (!lbrack.Success) {
      return null;
    }
    var args: Expression[] = [];
    var c = Expression.Claim(claimer);
    while (c !== null) {
      args.push(c);
      if (!claimer.Claim(/,/).Success) break;
      c = Expression.Claim(claimer);
    }
    if (!claimer.Claim(/\)/).Success) {
      lbrack.Fail();
      return null;
    }
    var call = new Call(claimer, left.Claim);
    call.Left = left;
    call.Arguments = args;
    return call;
  }

  Evaluate(scope: Scope): [stack: VarType[], body: string[]] {
    var o: string[] = [this.GetLine()];
    var callArgumentTypes: VarType[] = [];
    if (this.Left! instanceof Index) {
      this.Left.TryCurry(scope);
    }
    var resolveTarget = this.Left!.Evaluate(scope);
    for (var i = 0; i < this.Arguments.length; i++) {
      var resolveArgument = this.Arguments[i].Evaluate(scope);
      o.push(...resolveArgument[1]);
      callArgumentTypes.push(...resolveArgument[0]);
    }
    var functionTypes: FuncType[] = resolveTarget[0].filter(
      (c) => c instanceof FuncType
    ) as FuncType[];
    if (functionTypes.length === 0)
      throw new Error(`Attempted to call non-callable: ${resolveTarget[0]}`);
    if (this.Left! instanceof Index && this.Left.Curry) {
      callArgumentTypes.push(this.Left.CurryType!);
    }
    var functionMatchesTypes: FuncType[] = functionTypes.filter((c) =>
      VarType.CanCoax(c.ArgTypes, callArgumentTypes)
    );
    if (functionMatchesTypes.length === 0)
      throw new Error(
        `Cannot call, argument mismatch. Expected: ${functionTypes[0].ArgTypes} Got: ${callArgumentTypes}`
      );
    var funcType = functionMatchesTypes[0];
    o.push(...VarType.Coax(funcType.ArgTypes, callArgumentTypes));
    o.push(...resolveTarget[1]);
    o.push(...VarType.Coax([funcType], resolveTarget[0]));
    if (!this.IsFinalExpression && !this.TailCall)
      o.push(...scope.DumpFunctionVariables());
    o.push(`apopa`, this.TailCall ? `jmpa` : `calla`);
    if (!this.IsFinalExpression && !this.TailCall)
      o.push(...scope.LoadFunctionVariables());

    return [functionMatchesTypes[0].RetTypes, o];
  }
}

Expression.RegisterRight(Call.RightClaim);
