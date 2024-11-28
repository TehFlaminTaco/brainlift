import { Claimer } from "./brainchild";
import { Expression } from "./expression";
import { Identifier } from "./identifier";
import { Scope } from "./Scope";
import { VarType } from "./vartype";

export class New extends Expression {
  Type: Identifier | null = null;
  Arguments: Expression[] = [];
  static Claim(claimer: Claimer): Expression | null {
    var nw = claimer.Claim(/new\b/);
    if (!nw.Success) {
      return null;
    }
    var type = Identifier.Claim(claimer);
    if (type === null) {
      nw.Fail();
      return null;
    }
    if (!claimer.Claim(/\(/)) {
      nw.Fail();
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
      nw.Fail();
      return null;
    }
    var NewE = new New(claimer, nw);
    NewE.Type = type;
    NewE.Arguments = args;
    return NewE;
  }

  Evaluate(scope: Scope): [stack: VarType[], body: string[]] {
    let o: string[] = [this.GetLine()];
    let falseClaimer = new Claimer("");
    let falseFlag = falseClaimer.Flag();
    let vType = new VarType(falseClaimer, falseFlag);
    let objectType = scope.UserTypes[this.Type!.Name];
    if (objectType === undefined)
      throw new Error(`Cannot find type ${this.Type!.Name}`);
    let classType = objectType.TypeType;
    if (!classType)
      throw new Error(`Cannot find type type for ${this.Type!.Name}`);
    let targTypeNewMethod = classType.Children["new"];
    if (targTypeNewMethod === undefined)
      throw new Error(`Cannot find new method for type ${this.Type!.Name}`);
    vType.TypeName = this.Type!.Name;
    let argTypes: VarType[] = [];
    for (let i = 0; i < this.Arguments.length; i++) {
      let arg = this.Arguments[i].TryEvaluate(scope);
      o.push(...arg[1]);
      argTypes.push(...arg[0]);
    }
    argTypes.push(vType);
    let constructorMetamethod = scope.GetMetamethod(
      this.Type!.Name,
      argTypes
    );
    if (!constructorMetamethod)
      throw new Error(`Cannot find constructor new ${argTypes}`);
    o.push(...VarType.Coax(constructorMetamethod[1], argTypes)[0]);
    o.push(
      `seta ${classType.ClassLabel}`,
      `adda ${targTypeNewMethod[1]}`,
      `ptra`,
      `calla`
    );
    o.push(...constructorMetamethod[2]);
    return [constructorMetamethod[0], o];
  }

  DefinitelyReturns(scope: Scope): false|VarType[] {
    for (let i = 0; i < this.Arguments.length; i++) {
      let c = this.Arguments[i].DefinitelyReturns(scope);
      if (c) return c;
    }
    return false;
  }

  PotentiallyReturns(scope: Scope): false|VarType[] {
    let res: false|VarType[] = false;
    for (let i = 0; i < this.Arguments.length; i++) {
      let c = this.Arguments[i].DefinitelyReturns(scope);
      if (c) return c;
      res = VarType.MostSimilar(res, this.Arguments[i].PotentiallyReturns(scope), true)
      if(res && !res.length)
        return res;
    }
    return res;
  }
  
  GetTypes(scope: Scope): VarType[] {
    let falseClaimer = new Claimer("");
    let falseFlag = falseClaimer.Flag();
    let vType = new VarType(falseClaimer, falseFlag);
    let objectType = scope.UserTypes[this.Type!.Name];
    if (objectType === undefined)
      throw new Error(`Cannot find type ${this.Type!.Name}`);
    let classType = objectType.TypeType;
    if (!classType)
      throw new Error(`Cannot find type type for ${this.Type!.Name}`);
    let targTypeNewMethod = classType.Children["new"];
    if (targTypeNewMethod === undefined)
      throw new Error(`Cannot find new method for type ${this.Type!.Name}`);
    vType.TypeName = this.Type!.Name;
    let argTypes: VarType[] = [];
    for (let i = 0; i < this.Arguments.length; i++) {
      let arg = this.Arguments[i].TryEvaluate(scope);
      argTypes.push(...arg[0]);
    }
    argTypes.push(vType);
    let constructorMetamethod = scope.GetMetamethod(
      this.Type!.Name,
      argTypes
    );
    if (!constructorMetamethod)
      throw new Error(`Cannot find constructor new ${argTypes}`);
    return constructorMetamethod[0];
  }
}
Expression.Register(New.Claim);
