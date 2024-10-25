import { Claimer } from "./brainchild";
import { Expression, LeftDonor } from "./expression";
import { Identifier } from "./identifier";
import { Scope } from "./Scope";
import { Simplifyable } from "./Simplifyable";
import {
  Assignable,
  IsAssignable,
  IsReferenceable,
  ReadWritable,
  Referenceable,
  SimpleAssignable,
  Variable,
} from "./variable";
import { VarType } from "./vartype";

export class Index
  extends Expression
  implements
    LeftDonor,
    ReadWritable,
    Referenceable,
    Simplifyable,
    SimpleAssignable
{
  Simplify(scope: Scope): number | null {
    let valRes = this.Left!.GetTypes(scope);
    if (valRes.length === 0)
      throw new Error(`Cannot index expression that does not resolve in value`);
    let vType = valRes[0];
    let typeDef = this.Generics.length
      ? vType.GetDefinition().WithGenerics(this.Generics)
      : vType.GetDefinition();
    if (!(this.Target instanceof Identifier)) return null;
    let targetName = this.Target!.Name;
    let constChild = typeDef.ConstantChildren[targetName];
    if (constChild) {
      return constChild[1];
    }
    return null;
  }
  AssignSimple(scope: Scope, value: number): boolean {
    let valRes = this.Left!.GetTypes(scope);
    if (valRes.length === 0)
      throw new Error(`Cannot index expression that does not resolve in value`);
    let vType = valRes[0];
    let typeDef = this.Generics.length
      ? vType.GetDefinition().WithGenerics(this.Generics)
      : vType.GetDefinition();
    if (!(this.Target instanceof Identifier)) return false;
    let targetName = this.Target!.Name;
    let constChild = typeDef.ConstantChildren[targetName];
    if (constChild) {
      constChild[1] = value;
      return true;
    }
    return false;
  }
  Left: Expression | null = null;
  Target: Identifier | Expression[] | null = null;
  Precedence: number = 17;
  LeftRightAssociative: boolean = true;
  Curry: boolean = false;
  Generics: VarType[] = [];

  static Claim(claimer: Claimer): Index | null {
    var flg = claimer.Flag();
    var exp = Expression.Claim(claimer);
    if (!(exp instanceof Index)) {
      flg.Fail();
      return null;
    }
    return exp;
  }

  static RightClaim(left: Expression, claimer: Claimer): Index | null {
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
    var dot = claimer.Claim(/\./);
    if (!dot.Success) {
      f.Fail();
      return null;
    }
    var name = Identifier.Claim(claimer);
    if(name === null){
      f.Fail();
      return null;
    }
    var indx = new Index(claimer, left.Claim);
    indx.Left = left;
    indx.Target = name;
    indx.Generics = generics;
    return indx;
  }

  static RightClaimBrack(left: Expression, claimer: Claimer): Index | null {
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
    var lbrack = claimer.Claim(/\[/);
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
    if (!claimer.Claim(/\]/).Success) {
      lbrack.Fail();
      return null;
    }
    var indx = new Index(claimer, lbrack);
    indx.Left = left;
    indx.Target = args;
    indx.Generics = generics;
    return indx;
  }

  CurryType: VarType | null = null;
  Evaluate(scope: Scope): [stack: VarType[], body: string[]] {
    var o: string[] = [this.GetLine()];
    var valRes = this.Left!.TryEvaluate(scope);
    if (valRes[0].length === 0)
      throw new Error(`Cannot index expression that does not resolve in value`);
    o.push(...valRes[1]);
    for (var i = 1; i < valRes[0].length; i++) {
      o.push(...valRes[0][i].APop());
    }
    var vType = valRes[0][0];
    var typeDef = this.Generics.length
      ? vType.GetDefinition().WithGenerics(this.Generics)
      : vType.GetDefinition();
    if (this.Target instanceof Identifier) {
      if (this.Curry) {
        o.push(...valRes[0][0].CloneA());
        this.CurryType = valRes[0][0];
      }
      var targetName = this.Target!.Name;
      let meta = scope.GetMetamethod("get_" + targetName, [vType]);
      if (meta) {
        o.push(...VarType.Coax(meta[1], [vType])[0]);
        o.push(...meta[2]);
        return [meta[0], o];
      }
      var virtualChild = typeDef.VirtualChildren[targetName];
      if (virtualChild) {
        o.push(
          ...valRes[0][0].APop(),
          `seta ${virtualChild[1].ClassLabel}`,
          `adda ${virtualChild[2]}`,
          ...virtualChild[0].Get("a","a")
        );
        return [[virtualChild[0]], o];
      }
      let constChild = typeDef.ConstantChildren[targetName];
      if (constChild) {
        o.push(...valRes[0][0].APop(), `apush ${(constChild[1] & 0xffffffff) >>> 0}`);
        return [[constChild[0]], o];
      }
      var child = typeDef.Children[targetName];
      if (!child) throw new Error(`Value does not have member ${targetName}`);
      if(typeDef.Wide){ // if it's wide, convert to a reference to it.
        o.push(`setb ${scope.GetScratch(typeDef.Size)}`, ...vType.Put("a","b"), `apush ${scope.GetScratch(typeDef.Size)}`);
      }
      o.push(`apopa`, `adda ${child[1]}`, ...child[0].Get("a","a"));
      return [[child[0]], o];
    } else {
      var indexTypes: VarType[] = [vType];
      for (let i = 0; i < this.Target!.length; i++) {
        var res = this.Target![i].TryEvaluate(scope);
        indexTypes.push(...res[0]);
        o.push(...res[1]);
      }
      let meta = scope.GetMetamethod("getindex", indexTypes);
      if (meta === null) {
        throw new Error(
          `Cannot index Type ${vType} with types (${indexTypes}).`
        );
      }
      o.push(...VarType.Coax(meta[1], indexTypes)[0]);
      o.push(...meta[2]);
      return [meta[0], o];
    }
  }

  AssignWide(scope: Scope, anyType: VarType, value: VarType): string[] {
    let ptrType = value.WithDeltaPointerDepth(1);
    if (this.Target instanceof Identifier){
      // Check for a set_ metamethod
      var targetName = this.Target!.Name;
      var meta = scope.GetMetamethod("set_" + targetName, [ptrType, anyType]);
      if (meta) {
        // If there IS a meta, call it with a pointer to the Left value.
        if (!IsReferenceable(this.Left!)) throw new Error("Cannot assign to a struct on the stack.");
        return [
          ...anyType.FlipAB(),
          ...(this.Left as any as Referenceable).GetPointer(scope),
          ...anyType.FlipBA(),
          ...VarType.Coax(meta[1], [ptrType, anyType])[0],
          ...meta[2]
        ];
      }
      // If there is no meta, check for a virtual child.
      let virtualChild = value.GetDefinition().VirtualChildren[targetName];
      if(virtualChild){
        return [
          `seta ${virtualChild[1].ClassLabel}`,
          `adda ${virtualChild[2]}`,
          ...virtualChild[0].Put("a","a")
        ];
      }

      // If there is no virtual child, check for a constant child.
      let constChild = value.GetDefinition().ConstantChildren[targetName];
      if(constChild){
        throw new Error("Cannot assign to a constant value.");
      }

      // If there is no constant child, check for a regular child.
      let child = value.GetDefinition().Children[targetName];
      if(!child) throw new Error(`Value does not have member ${targetName}`);
      if (!IsAssignable(this.Left!)) throw new Error("Cannot assign to a struct on the stack.");
      // Load the current value unto the stack
      let leftRes = this.Left!.TryEvaluate(scope);
      let o = [...leftRes[1]];
      for (let i=1; i<leftRes[0].length; i++){
        o.push(...leftRes[0][i].APop());
      }
      // Write the current value unto scratch
      o.push(`setb ${scope.GetScratch(value.GetDefinition().Size)}`);
      o.push(...leftRes[0][0].Put("a","b"));
      // Add the offset of the child
      o.push(`seta ${scope.GetScratch(value.GetDefinition().Size)}`);
      o.push(`adda ${child[1]}`);
      // Write the new value
      o.push(...child[0].Put("a","a"));
      // Read the new value back into the scratch
      o.push(`seta ${scope.GetScratch(value.GetDefinition().Size)}`);
      o.push(...leftRes[0][0].Get("a","a"));
      // Assign the new value
      o.push(...(this.Left as any as Assignable).Assign(scope, leftRes[0][0]));
      return o;
    }else{
      // If the target is not an identifier, we're indexing.
      let indexTypes: VarType[] = [value];
      let pushAllIndexables: string[] = [];
      for (let i = 0; i < this.Target!.length; i++) {
        let res = this.Target![i].TryEvaluate(scope);
        indexTypes.push(...res[0]);
        pushAllIndexables.push(...res[1]);
      }
      let meta = scope.GetMetamethod("setindex", indexTypes);
      if (meta === null) {
        throw new Error(
          `Cannot set index Type ${value} with types (${indexTypes.slice(
            0,
            indexTypes.length - 1
          )}).`
        );
      }
      return [
        ...(this.Left as any as Referenceable).GetPointer(scope),
        ...pushAllIndexables,
        ...VarType.Coax(meta[1], indexTypes)[0],
        ...meta[2]
      ];
    }
  }

  Assign(scope: Scope, anyType: VarType): string[] {
    var o: string[] = [this.GetLine()];
    var valRes = this.Left!.TryEvaluate(scope);
    if (valRes[0].length === 0)
      throw new Error(`Cannot index expression that does not resolve in value`);
    if (valRes[0][0].GetDefinition().Wide) {
      // Wide types get special treatment.
      // Going to pull this into its own function
      return this.AssignWide(scope, anyType, valRes[0][0]);
    }
    var vType = valRes[0][0];
    var typeDef = this.Generics.length
      ? vType.GetDefinition().WithGenerics(this.Generics)
      : vType.GetDefinition();
    if (this.Target instanceof Identifier) {
      var targetName = this.Target!.Name;
      var meta = scope.GetMetamethod("set_" + targetName, [vType, anyType]);
      if (meta) {
        o.push(...anyType.FlipAB());
        o.push(...valRes[1]);
        for (let i = 1; i < valRes[0].length; i++) {
          o.push(...valRes[0][i].APop());
        }
        o.push(...anyType.FlipBA());
        o.push(...VarType.Coax(meta[1], [vType, anyType])[0]);
        o.push(...meta[2]);
        return o;
      }
      o.push(...valRes[1]);
      for (var i = 1; i < valRes[0].length; i++) {
        o.push(...valRes[0][i].APop());
      }
      var virtualChild = typeDef.VirtualChildren[targetName];
      if (virtualChild) {
        o.push(
          ...anyType.FlipAB(),
          ...valRes[0][0].APop(),
          ...anyType.FlipBA(),
          `seta ${virtualChild[1].ClassLabel}`,
          `adda ${virtualChild[2]}`,
          ...anyType.Put("a","a")
        );
        return o;
      }
      let constChild = typeDef.ConstantChildren[targetName];
      if (constChild) {
        throw new Error(
          `Cannon assign non-constant value to constant variable ${targetName}`
        );
      }
      var child = typeDef.Children[targetName];
      if (!child) throw new Error(`Value does not have member ${targetName}`);
      o.push(`apopa`, `adda ${child[1]}`, ...child[0].Put("a","a"));
      return o;
    } else {
      o.push(...anyType.FlipAB());
      o.push(...valRes[1]);
      for (let i = 1; i < valRes[0].length; i++) {
        o.push(...valRes[0][i].APop());
      }
      var indexTypes: VarType[] = [vType];
      for (let i = 0; i < this.Target!.length; i++) {
        let res = this.Target![i].TryEvaluate(scope);
        indexTypes.push(...res[0]);
        o.push(...res[1]);
      }
      indexTypes.push(anyType);
      let meta = scope.GetMetamethod("setindex", indexTypes);
      if (meta === null) {
        throw new Error(
          `Cannot set index Type ${vType} with types (${indexTypes.slice(
            0,
            indexTypes.length - 1
          )}).`
        );
      }
      o.push(...anyType.FlipBA());
      o.push(...VarType.Coax(meta[1], indexTypes)[0]);
      o.push(...meta[2]);
      return o;
    }
  }
  Read(scope: Scope): string[] {
    var o: string[] = [this.GetLine()];
    var valRes = this.Left!.TryEvaluate(scope);
    if (valRes[0].length === 0)
      throw new Error(`Cannot index expression that does not resolve in value`);
    o.push(...valRes[1]);
    for (var i = 1; i < valRes[0].length; i++) {
      o.push(...valRes[0][i].APop());
    }
    var vType = valRes[0][0];
    var typeDef = this.Generics.length
      ? vType.GetDefinition().WithGenerics(this.Generics)
      : vType.GetDefinition();
    if (this.Target instanceof Identifier) {
      if (this.Curry) {
        o.push(...valRes[0][0].CloneA());
        this.CurryType = valRes[0][0];
      }
      var targetName = this.Target!.Name;
      let meta = scope.GetMetamethod("get_" + targetName, [vType]);
      if (meta) {
        o.push(...VarType.Coax(meta[1], [vType])[0]);
        o.push(...meta[2]);
        return o;
      }
      var virtualChild = typeDef.VirtualChildren[targetName];
      if (virtualChild) {
        o.push(
          ...valRes[0][0].APop(),
          `seta ${virtualChild[1].ClassLabel}`,
          `adda ${virtualChild[2]}`,
          ...virtualChild[0].Get("a","a")
        );
        return o;
      }
      let constChild = typeDef.ConstantChildren[targetName];
      if (constChild) {
        o.push(...valRes[0][0].APop(), `apush ${(constChild[1] & 0xffffffff) >>> 0}`);
        return o;
      }
      var child = typeDef.Children[targetName];
      if (!child) throw new Error(`Value does not have member ${targetName}`);
      if(typeDef.Wide){ // if it's wide, convert to a reference to it.
        o.push(`setb ${scope.GetScratch(typeDef.Size)}`, ...vType.Put("a","b"), `apush ${scope.GetScratch(typeDef.Size)}`);
      }
      o.push(`apopa`, `adda ${child[1]}`, ...child[0].Get("a","a"));
      return o;
    } else {
      var indexTypes: VarType[] = [vType];
      for (let i = 0; i < this.Target!.length; i++) {
        var res = this.Target![i].TryEvaluate(scope);
        indexTypes.push(...res[0]);
        o.push(...res[1]);
      }
      let meta = scope.GetMetamethod("getindex", indexTypes);
      if (meta === null) {
        throw new Error(
          `Cannot index Type ${vType} with types (${indexTypes}).`
        );
      }
      o.push(...VarType.Coax([vType], meta[1])[0]);
      o.push(...meta[2]);
      return o;
    }
  }

  GetPointerWide(scope: Scope): string[] {
    // SPECIAL behaviour for wide types.
    // We have to get a pointer to wherever it's stored, instead of the value itself.
    if (!IsReferenceable(this.Left))
      throw new Error("Cannot get a pointer to a struct on the stack.");
    let o: string[] = [];
    // Push the pointer to the stack, because all things need this.
    o.push(...(this.Left as any as Referenceable).GetPointer(scope));
    let pointerType = (this.Left as any as Referenceable).GetReferenceTypes(scope)[0];

    // If the target is an identifier, we're accessing a property.
    if (this.Target instanceof Identifier) {
      // Check for a set_ metamethod
      var targetName = this.Target!.Name;
      var meta = scope.GetMetamethod("ptr_" + targetName, [pointerType]);
      if (meta) {
        // If there IS a meta, call it with a pointer to the Left value.
        o.push(...VarType.Coax([pointerType], meta[1])[0]);
        o.push(...meta[2]);
        return o;
      }

      // If there is no meta, check for a virtual child.
      let virtualChild = pointerType.GetDefinition().VirtualChildren[targetName];
      if(virtualChild){
        o.push(
          ...pointerType.APop(),
          `seta ${virtualChild[1].ClassLabel}`,
          `adda ${virtualChild[2]}`,
          `apusha`
        );
        return o;
      }

      // If there is no virtual child, check for a constant child.
      let constChild = pointerType.GetDefinition().ConstantChildren[targetName];
      if(constChild){
        throw new Error("Cannot get pointer to a constant value.");
      }

      // If there is no constant child, check for a regular child.
      let child = pointerType.GetDefinition().Children[targetName];
      if(!child) throw new Error(`Value does not have member ${targetName}`);
      o.push(`apopa`, `adda ${child[1]}`, `apusha`);
      return o;
    }else{
      // If the target is not an identifier, we're indexing.
      let indexTypes: VarType[] = [pointerType];
      for (let i = 0; i < this.Target!.length; i++) {
        let res = this.Target![i].TryEvaluate(scope);
        indexTypes.push(...res[0]);
        o.push(...res[1]);
      }
      let meta = scope.GetMetamethod("ptrindex", indexTypes);
      if (meta === null) {
        throw new Error(
          `Cannot derefence Type ${pointerType} with types (${indexTypes}).`
        );
      }
      o.push(...VarType.Coax(indexTypes, meta[1])[0]);
      o.push(...meta[2]);
      return o;
    }
  }

  GetPointer(scope: Scope): string[] {
    var o: string[] = [this.GetLine()];
    var valRes = this.Left!.TryEvaluate(scope);
    if (valRes[0].length === 0)
      throw new Error(`Cannot index expression that does not resolve in value`);
    if(valRes[0][0].GetDefinition().Wide){
      return this.GetPointerWide(scope);
    }
    o.push(...valRes[1]);
    for (var i = 1; i < valRes[0].length; i++) {
      o.push(...valRes[0][i].APop());
    }
    var vType = valRes[0][0];
    var typeDef = this.Generics.length
      ? vType.GetDefinition().WithGenerics(this.Generics)
      : vType.GetDefinition();
    if (!(this.Target instanceof Identifier)) {
      var indexTypes: VarType[] = [vType];
      for (let i = 0; i < this.Target!.length; i++) {
        var res = this.Target![i].TryEvaluate(scope);
        indexTypes.push(...res[0]);
        o.push(...res[1]);
      }
      let meta = scope.GetMetamethod("ptrindex", indexTypes);
      if (meta === null) {
        throw new Error(
          `Cannot derefence Type ${vType} with types (${indexTypes}).`
        );
      }
      o.push(...VarType.Coax([vType], meta[1])[0]);
      o.push(...meta[2]);
      return o;
    }
    var targetName = this.Target!.Name;
    var meta = scope.GetMetamethod("ptr_" + targetName, [vType]);
    if (meta) {
      throw new Error("Cannot dereference property.");
    }
    var virtualChild = typeDef.VirtualChildren[targetName];
    if (virtualChild) {
      o.push(
        ...valRes[0][0].APop(),
        `seta ${virtualChild[1].ClassLabel}`,
        `adda ${virtualChild[2]}`,
        `apusha`
      );
      return o;
    }
    let constChild = typeDef.ConstantChildren[targetName];
    if (constChild) {
      throw new Error(`Cannot get pointer to a constant value ${targetName}`);
    }
    var child = typeDef.Children[targetName];
    if (!child) throw new Error(`Value does not have member ${targetName}`);
    o.push(`apopa`, `adda ${child[1]}`, `apusha`);
    return o;
  }
  GetReferenceTypes(scope: Scope): VarType[] {
    if (!(this.Target instanceof Identifier)) {
      var vType = this.Left!.GetTypes(scope)[0];
      var indexTypes: VarType[] =  [vType.GetDefinition().Wide ? vType.WithDeltaPointerDepth(1) : vType];
      for (let i = 0; i < this.Target!.length; i++) {
        indexTypes.push(...this.Target![i].GetTypes(scope));
      }
      let meta = scope.GetMetamethod("ptrindex", indexTypes);
      if (meta === null) {
        throw new Error(
          `Cannot derefence Type ${vType} with types (${indexTypes}).`
        );
      }
      return meta[0];
    }
    var ts = this.GetTypes(scope);
    var oTypes: VarType[] = [];
    ts.forEach((r) => {
      let dereferenced = r.Clone();
      dereferenced.PointerDepth++;
      oTypes.push(dereferenced);
    });
    return oTypes;
  }

  TryCurry(scope: Scope) {
    if (this.Left instanceof Identifier) {
      if (scope.UserTypes[this.Left.Name]) return; // Static method
    }
    if (this.Target instanceof Identifier) this.Curry = true;
  }

  GetTypes(scope: Scope): VarType[] {
    var valRes = this.Left!.GetTypes(scope);
    if (valRes.length === 0)
      throw new Error(`Cannot index expression that does not resolve in value`);
    if (this.Curry) {
      this.CurryType = valRes[0];
    }
    var vType = valRes[0];
    var typeDef = vType.GetDefinition();
    if (this.Target instanceof Identifier) {
      var targetName = this.Target!.Name;
      var meta = scope.GetMetamethod("get_" + targetName, [vType.GetDefinition().Wide ? vType.WithDeltaPointerDepth(1) : vType]);
      if (meta) {
        return meta[0];
      }
      var virtualChild = typeDef.VirtualChildren[targetName];
      if (virtualChild) {
        return [virtualChild[0]];
      }
      let constChild = typeDef.ConstantChildren[targetName];
      if (constChild) {
        return [constChild[0]];
      }
      var child = typeDef.Children[targetName];
      if (!child) throw new Error(`Value does not have member ${targetName}`);
      return [child[0]];
    } else {
      var indexTypes: VarType[] = [vType.GetDefinition().Wide ? vType.WithDeltaPointerDepth(1) : vType];
      for (let i = 0; i < this.Target!.length; i++) {
        indexTypes.push(...this.Target![i].GetTypes(scope));
      }
      let meta = scope.GetMetamethod("getindex", indexTypes);
      if (meta === null) {
        throw new Error(
          `Cannot index Type ${vType} with types (${indexTypes}).`
        );
      }
      return meta[0];
    }
  }
}
Variable.RegisterReadWritable(Index.Claim);
Variable.RegisterReferenceable(Index.Claim);
Expression.RegisterRight(Index.RightClaim);
Expression.RegisterRight(Index.RightClaimBrack);
