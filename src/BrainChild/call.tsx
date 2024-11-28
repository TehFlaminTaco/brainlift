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

  RemapGenerics(inargs: VarType[], args: VarType[], rets: VarType[]): [args: VarType[], rets: VarType[]]{
    var genericifiedMap: { [generic: string]: VarType } = {};
    let failed: boolean = false;
    let argTypes: VarType[] = [];
    let returnTypes: VarType[] = [];
    let fakeClaimer = new Claimer("");
    let fakeClaim = fakeClaimer.Flag();// Iterate through inTypes, if the metamethod ArgTypes is a generic, and the inType is a specific type, replace the generic with the specific type and add it to the map
    let exactly = false;
    // If it's already in the map, check that one coaxes into the other, and simplify if possible
    // If they don't coax, fail.
    // Recurse through the generic arguments of each type as well.
    // Finally, apply the same mapping to the metamethod's ReturnTypes
    // And return the modified metamethod.
    let trySwap = function (inMM: VarType, inType: VarType): VarType {
      if (failed) return inMM;
      if (inMM.TypeName.startsWith("functiongeneric$")) {
        // If inMM pointerDepth is greater than 0, then this will 'mess' with our mapping. So we have to adjust the map according.
        // Check if it's already in the map
        if (inMM.TypeName in genericifiedMap) {
          let mapped = genericifiedMap[inMM.TypeName].WithDeltaPointerDepth(
            inMM.PointerDepth
          );
          // If we can coax/equal to directly to what's in the map, return that
          if (
            exactly
              ? mapped.Equals(inType)
              : VarType.CanCoax([mapped], [inType])
          ) {
            return mapped;
          }
          // If what's in the map can coax/equal to what we have, update the map and return the new type
          // Frustratingly, I think we have to do 2 passes to ensure all the casts are called correctly later.
          if (
            exactly
              ? inType.Equals(mapped)
              : VarType.CanCoax([inType], [mapped])
          ) {
            genericifiedMap[inMM.TypeName] = inType.WithDeltaPointerDepth(
              -inMM.PointerDepth
            );
            return inType;
          }
          failed = true;
          return inMM;
        }
        // Otherwise, we're adding it to the map
        genericifiedMap[inMM.TypeName] = inType.WithDeltaPointerDepth(
          -inMM.PointerDepth
        );
        return inType;
      }
      // If a and b are functypes, recurse through their return types and argTypes.
      if(inMM instanceof FuncType && inType instanceof FuncType){
        let inMMFunc = inMM as FuncType;
        let inTypeFunc = inType as FuncType;
        if(inMMFunc.ArgTypes.length !== inTypeFunc.ArgTypes.length || inMMFunc.RetTypes.length !== inTypeFunc.RetTypes.length){
          failed = true;
          return inMM;
        }
        let newFncType = new FuncType(fakeClaimer, fakeClaim);
        newFncType.ArgTypes = [];
        newFncType.RetTypes = [];
        let oldExact = exactly;
        exactly = true;
        for(let i=0; i < inMMFunc.ArgTypes.length; i++){
          newFncType.ArgTypes.push(trySwap(inMMFunc.ArgTypes[i], inTypeFunc.ArgTypes[i]))
        }
        for(let i=0; i < inMMFunc.RetTypes.length; i++){
          newFncType.RetTypes.push(trySwap(inMMFunc.RetTypes[i], inTypeFunc.RetTypes[i]))
        }
        exactly = oldExact;
        if(failed)return inMM;
        return newFncType;
      }
      // Check that a is b to the precision of exactly
      if (
        !(exactly ? inMM.Equals(inType) : VarType.CanCoax([inMM], [inType]))
      ) {
        failed = true;
        return inMM;
      }
      // Recurse through the generic arguments of each type as well.
      if (inMM.Generics.length > 0) {
        let newGenericArgs: VarType[] = [];
        for (
          let i = 0;
          i < Math.min(inMM.Generics.length, inType.Generics.length);
          i++
        ) {
          newGenericArgs.push(trySwap(inMM.Generics[i], inType.Generics[i]));
        }
        for(let i=inType.Generics.length; i < inMM.Generics.length; i++){ // If there are more EXPECTED generic args then real generic args, just use $i
          let fakeClaimer = new Claimer("","");
          let fakeClaim = fakeClaimer.Flag();
          let vt: VarType = new VarType(fakeClaimer, fakeClaim);
          vt.PointerDepth = 0;
          vt.TypeName = "functiongeneric$"+i;
          vt.Generics = [];
          newGenericArgs.push(trySwap(inMM.Generics[i], vt));
        }
        return inMM.WithGenerics(newGenericArgs);
      }
      return inMM;
    };
    // Used to modify returnTypes after the fact
    let forceSwap = function (inMM: VarType): VarType {
      if (inMM.TypeName.startsWith("functiongeneric$")) {
        if (inMM.TypeName in genericifiedMap) {
          return genericifiedMap[inMM.TypeName].WithDeltaPointerDepth(
            inMM.PointerDepth
          );
        }
      }
      if (inMM.Generics.length > 0) {
        let newGenericArgs: VarType[] = [];
        for (let i = 0; i < inMM.Generics.length; i++) {
          newGenericArgs.push(forceSwap(inMM.Generics[i]));
        }
        return inMM.WithGenerics(newGenericArgs);
      }
      return inMM;
    };
    if (args.length !== inargs.length) {
      failed = true;
      return [args,rets];
    }
    // The first loop is done to ensure all types are mapped to their least-generic form.
    for (let i = 0; i < args.length; i++) {
      trySwap(args[i], inargs[i]);
      if (failed) return [args,rets];
    }
    // This loop generates argTypes
    for (let i = 0; i < args.length; i++) {
      argTypes.push(trySwap(args[i], inargs[i]));
      if (failed)
        // Impossible?
        return [args,rets];
    }
    // This loop generates returnTypes
    for (let i = 0; i < rets.length; i++) {
      returnTypes.push(forceSwap(rets[i]));
    }
    return [argTypes, returnTypes];
  }

  GetTypes(scope: Scope): VarType[] {
    var callArgumentTypes: VarType[] = [];
    let curried: VarType|null = null;
    if (this.Left! instanceof Index) {
      this.Left.TryCurry(scope);
      if(this.Left.Curry)curried = this.Left.Left!.GetTypes(scope)[0]
    }
    var resolveTarget = this.Left!.GetTypes(scope);
    for (var i = 0; i < this.Arguments.length; i++) {
      var resolveArgument = this.Arguments[i].GetTypes(scope);
      callArgumentTypes.push(...resolveArgument);
    }
    let args = [...resolveTarget, ...callArgumentTypes];
    if(curried !== null)
        args.push(curried);
    let meta = scope.GetMetamethod("call", args, {strictTo: resolveTarget.length});
    if(meta){
      return meta[0];
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
    let curried: VarType|null = null;
    if (this.Left! instanceof Index) {
      this.Left.TryCurry(scope);
      if(this.Left.Curry)curried = this.Left.Left!.GetTypes(scope)[0]
    }
    var resolveTarget = this.Left!.TryEvaluate(scope);
    for (var i = 0; i < this.Arguments.length; i++) {
      var resolveArgument = this.Arguments[i].TryEvaluate(scope);
      o.push(...resolveArgument[1]);
      callArgumentTypes.push(...resolveArgument[0]);
    }

    let args = [...resolveTarget[0], ...callArgumentTypes];
    if(curried !== null)
        args.push(curried);
    let meta = scope.GetMetamethod("call", args, {strictTo: resolveTarget[0].length});
    if(meta){
      let [metaargs, metarets] = this.RemapGenerics(args,meta[1],meta[0]);
      let prefix: string[] = resolveTarget[1];
      if(curried !== null)
        prefix.push(...curried!.FlipXY())
      o = prefix.concat(o);
      if(curried !== null)
        o.push(...curried!.FlipYX());
      o.push(...VarType.Coax(metaargs, args)[0])
      o.push(...meta[2]);
      return [metarets, o];
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
      let mapped = c.ArgTypes;//.map((c) => c.WithFunctionGenerics(this.Generics));
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
    var funcType = functionMatchesTypes[0];
    let [funcArgs, funcRets] = this.RemapGenerics(callArgumentTypes,funcType.ArgTypes,funcType.RetTypes);
    let mapped = funcType.Clone();
    mapped.ArgTypes = funcArgs;
    mapped.RetTypes = funcRets;
    funcType = mapped;
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
      let def = targetType.GetDefinition();
      let elementCount = spareSize;
      let size = 1;
      if(def.Wide)
        size = def.Size;
      spareSize *= size;
      o.push(...VarType.Coax(mapped, callArgumentTypes)[0]);
      // Push the spare values to a reserved array
      let paramsName = scope.GetSafeName(`params${targetType.TypeName}`);
      scope.Assembly.push(`${paramsName}:`, `db ${Array(spareSize).fill(0)}`);
      // We're going to set every value in the array to the values off the top of the stack, casted to the target type.
      // Because it's on a stack, we're doing this in reverse.
      for (let i = elementCount - 1; i >= 0; i--) {
        // First, Coax
        // o.push(...VarType.Coax([targetType], [callArgumentTypes[i]])[0]);
        // Then, store
        o.push(`setb ${paramsName}`, `addb ${i * size}`, ...targetType.Put("x","b"));
      }
      // Then, add the length of the array, and the array itself
      o.push(`xpush ${elementCount}`, `xpush ${paramsName}`);
    } else {
      o.push(...VarType.Coax(funcType.ArgTypes, callArgumentTypes)[0]);
    }
    o.push(...resolveTarget[1]);
    o.push(
      ...VarType.Coax(
        [funcType],
        resolveTarget[0].map((c) => c/*.WithFunctionGenerics(this.Generics)*/)
      )[0]
    );
    if (!this.IsFinalExpression && !this.TailCall)
      o.push(...scope.DumpFunctionVariables());
    o.push(`xpopa`, this.TailCall ? `jmpa` : `calla`);
    if (!this.IsFinalExpression && !this.TailCall)
      o.push(...scope.LoadFunctionVariables());

    return [functionMatchesTypes[0].RetTypes, o];
  }

  DefinitelyReturns(scope: Scope): false|VarType[] {
    let c = this.Left!.DefinitelyReturns(scope);
    if(c)return c;
    for (let i = 0; i < this.Arguments.length; i++) {
      c = this.Arguments[i].DefinitelyReturns(scope);
      if (c) return c;
    }
    return false;
  }

  PotentiallyReturns(scope: Scope): false|VarType[] {
    let res = this.Left!.DefinitelyReturns(scope);
    if(res)return res;
    res = this.Left!.PotentiallyReturns(scope);
    for (let i = 0; i < this.Arguments.length; i++) {
      let c = this.Arguments[i].DefinitelyReturns(scope);
      if (c) return c;
      res = VarType.MostSimilar(res, this.Arguments[i].PotentiallyReturns(scope), true)
      if(res && !res.length)
        return res;
    }
    return res;
  }
}

Expression.RegisterRight(Call.RightClaim);
