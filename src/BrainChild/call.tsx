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
  Generics: VarType[] = [];
  static RightClaim(left: Expression, claimer: Claimer): Call | null {
    let generics: VarType[] = [];
    let f = claimer.Flag();
    if (claimer.Claim(/</).Success) {
      while (true) {
        let t = VarType.Claim(claimer);
        if (t === null) {
          generics = [];
          f.Fail();
          break;
        }
        generics.push(t);
        if (!claimer.Claim(/,/).Success) {
          break;
        }
      }
      if (!claimer.Claim(/>/).Success) {
        generics = [];
        f.Fail();
      }
    }
    var lbrack = claimer.Claim(/\(/);
    if (!lbrack.Success) {
      f.Fail();
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
    call.Generics = generics;
    return call;
  }

  GetTypes(scope: Scope): VarType[] {
    var callArgumentTypes: VarType[] = [];
    if (this.Left! instanceof Index) {
      this.Left.TryCurry(scope);
    }
    var resolveTarget = this.Left!.GetTypes(scope);
    for (var i = 0; i < this.Arguments.length; i++) {
      var resolveArgument = this.Arguments[i].GetTypes(scope);
      callArgumentTypes.push(...resolveArgument);
    }
    var functionTypes: FuncType[] = resolveTarget.filter(
      (c) => c instanceof FuncType
    ) as FuncType[];
    if (functionTypes.length === 0)
      throw new Error(`Attempted to call non-callable: ${resolveTarget[0]}`);
    if (this.Left! instanceof Index && this.Left.Curry) {
      callArgumentTypes.push(this.Left.CurryType!);
    }
    var functionMatchesTypes: FuncType[] = functionTypes.filter(
      (c) => VarType.CanCoax(c.ArgTypes, callArgumentTypes)[0]
    );
    if (functionMatchesTypes.length === 0)
      throw new Error(
        `Cannot call, argument mismatch. Expected: ${functionTypes[0].ArgTypes} Got: ${callArgumentTypes}`
      );
    return functionMatchesTypes[0].RetTypes;
  }

  Evaluate(scope: Scope): [stack: VarType[], body: string[]] {
    var o: string[] = [this.GetLine()];
    var callArgumentTypes: VarType[] = [];
    if (this.Left! instanceof Index) {
      this.Left.TryCurry(scope);
    }
    var resolveTarget = this.Left!.TryEvaluate(scope);
    for (var i = 0; i < this.Arguments.length; i++) {
      var resolveArgument = this.Arguments[i].TryEvaluate(scope);
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
    var functionMatchesTypes: FuncType[] = functionTypes.filter((c) => {
      let mapped = c.ArgTypes.map((c) => c.WithFunctionGenerics(this.Generics));
      if (VarType.CanCoax(mapped, callArgumentTypes)[0]) return true;
      // All of this is just checking if the last two arguments of a callable are an int then a pointer.
      // There's gotta be an easier way to do that... ;-;
      if (
        mapped.length >= 2 &&
        mapped[mapped.length - 1].PointerDepth > 0 &&
        mapped[mapped.length - 2].TypeName === "int" &&
        mapped[mapped.length - 2].PointerDepth === 0
      ) {
        // Try to coax a partial chunk
        let tried = VarType.CanCoax(
          mapped.slice(0, mapped.length - 2),
          callArgumentTypes
        );
        if (tried[0]) {
          return true;
        }
      }
      return false;
    });
    if (functionMatchesTypes.length === 0)
      throw new Error(
        `Cannot call, argument mismatch. Expected: ${functionTypes[0].ArgTypes} Got: ${callArgumentTypes}`
      );
    var funcType = functionMatchesTypes[0].WithFunctionGenerics(
      this.Generics
    ) as FuncType;
    // If we CAN use Paramaterized form, use Paramaterized form.
    let paramCoax;
    if (
      !VarType.CanCoax(funcType.ArgTypes, callArgumentTypes)[0] &&
      funcType.ArgTypes.length >= 2 &&
      funcType.ArgTypes[funcType.ArgTypes.length - 1].PointerDepth > 0 &&
      funcType.ArgTypes[funcType.ArgTypes.length - 2].TypeName === "int" &&
      funcType.ArgTypes[funcType.ArgTypes.length - 2].PointerDepth === 0 &&
      (paramCoax = VarType.CanCoax(
        funcType.ArgTypes.slice(0, funcType.ArgTypes.length - 2),
        callArgumentTypes
      ))[0]
    ) {
      // Add the next N types to a fake argument target, and then coax to.
      let mapped = funcType.ArgTypes.slice(0, funcType.ArgTypes.length - 2);
      let targetType =
        funcType.ArgTypes[funcType.ArgTypes.length - 1].WithDeltaPointerDepth(
          -1
        );
      let spareSize = 0;
      for (let i = paramCoax[1]!; i < callArgumentTypes.length; i++) {
        if (!VarType.CanCoax([targetType], [callArgumentTypes[i]])) {
          break;
        }
        mapped.push(targetType);
        spareSize++;
      }
      o.push(...VarType.Coax(mapped, callArgumentTypes)[0]);
      // Push the spare values to a reserved array
      let paramsName = scope.GetSafeName(`params${targetType.TypeName}`);
      scope.Assembly.push(`${paramsName}:`, `db ${Array(spareSize).fill(0)}`);
      // We're going to set every value in the array to the values off the top of the stack, casted to the target type.
      // Because it's on a stack, we're doing this in reverse.
      for (let i = spareSize - 1; i >= 0; i--) {
        // First, Coax
        // o.push(...VarType.Coax([targetType], [callArgumentTypes[i]])[0]);
        // Then, store
        o.push(`setb ${paramsName}`, `addb ${i}`, `apopa`, `putaptrb`);
      }
      // Then, add the length of the array, and the array itself
      o.push(`apush ${spareSize}`, `apush ${paramsName}`);
    } else {
      o.push(...VarType.Coax(funcType.ArgTypes, callArgumentTypes)[0]);
    }
    o.push(...resolveTarget[1]);
    o.push(
      ...VarType.Coax(
        [funcType],
        resolveTarget[0].map((c) => c.WithFunctionGenerics(this.Generics))
      )[0]
    );
    if (!this.IsFinalExpression && !this.TailCall)
      o.push(...scope.DumpFunctionVariables());
    o.push(`apopa`, this.TailCall ? `jmpa` : `calla`);
    if (!this.IsFinalExpression && !this.TailCall)
      o.push(...scope.LoadFunctionVariables());

    return [functionMatchesTypes[0].RetTypes, o];
  }
}

Expression.RegisterRight(Call.RightClaim);
