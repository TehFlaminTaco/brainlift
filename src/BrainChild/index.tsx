import { Claimer } from "./brainchild";
import { Expression, LeftDonor } from "./expression";
import { Identifier } from "./identifier";
import { Scope } from "./Scope";
import { ReadWritable, Referenceable, Variable } from "./variable";
import { VarType } from "./vartype";

export class Index
  extends Expression
  implements LeftDonor, ReadWritable, Referenceable
{
  Left: Expression | null = null;
  Target: Identifier | null = null;
  Precedence: number = 17;
  LeftRightAssociative: boolean = true;
  Curry: boolean = false;

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
    var dot = claimer.Claim(/\./);
    if (!dot.Success) return null;
    var name = Identifier.Claim(claimer);
    var indx = new Index(claimer, left.Claim);
    indx.Left = left;
    indx.Target = name;
    return indx;
  }

  CurryType: VarType | null = null;
  Evaluate(scope: Scope): [stack: VarType[], body: string[]] {
    var o: string[] = [];
    var valRes = this.Left!.Evaluate(scope);
    if (valRes[0].length === 0)
      throw new Error(`Cannot index expression that does not resolve in value`);
    o.push(...valRes[1]);
    for (var i = 1; i < valRes[0].length; i++) {
      o.push(`apop`);
    }
    if (this.Curry) {
      o.push(`apopa`, `apusha`, `apusha`);
      this.CurryType = valRes[0][0];
    }
    var vType = valRes[0][0];
    var typeDef = vType.GetDefinition();
    var targetName = this.Target!.Name;
    var child = typeDef.Children[targetName];
    if (!child) throw new Error(`Value does not have member ${targetName}`);
    o.push(`apopa`, `adda ${child[1]}`, `ptra`, `apusha`);
    return [[child[0]], o];
  }

  Assign(scope: Scope, anyType: VarType): string[] {
    var o: string[] = [];
    var valRes = this.Left!.Evaluate(scope);
    if (valRes[0].length === 0)
      throw new Error(`Cannot index expression that does not resolve in value`);
    o.push(...valRes[1]);
    for (var i = 1; i < valRes[0].length; i++) {
      o.push(`apop`);
    }
    var vType = valRes[0][0];
    var typeDef = vType.GetDefinition();
    var targetName = this.Target!.Name;
    var child = typeDef.Children[targetName];
    if (!child) throw new Error(`Value does not have member ${targetName}`);
    o.push(`apopa`, `apopb`, `adda ${child[1]}`, `putbptra`);
    return o;
  }
  Read(scope: Scope): string[] {
    var o: string[] = [];
    var valRes = this.Left!.Evaluate(scope);
    if (valRes[0].length === 0)
      throw new Error(`Cannot index expression that does not resolve in value`);
    o.push(...valRes[1]);
    for (var i = 1; i < valRes[0].length; i++) {
      o.push(`apop`);
    }
    var vType = valRes[0][0];
    var typeDef = vType.GetDefinition();
    var targetName = this.Target!.Name;
    var child = typeDef.Children[targetName];
    if (!child) throw new Error(`Value does not have member ${targetName}`);
    o.push(`apopa`, `adda ${child[1]}`, `ptra`, `apusha`);
    return o;
  }
  GetType(scope: Scope): VarType {
    var valRes = this.Left!.Evaluate(scope);
    if (valRes[0].length === 0)
      throw new Error(`Cannot index expression that does not resolve in value`);
    var vType = valRes[0][0];
    var typeDef = vType.GetDefinition();
    var targetName = this.Target!.Name;
    var child = typeDef.Children[targetName];
    if (!child) throw new Error(`Value does not have member ${targetName}`);
    return child[0];
  }
  GetPointer(scope: Scope): string[] {
    var o: string[] = [];
    var valRes = this.Left!.Evaluate(scope);
    if (valRes[0].length === 0)
      throw new Error(`Cannot index expression that does not resolve in value`);
    o.push(...valRes[1]);
    for (var i = 1; i < valRes[0].length; i++) {
      o.push(`apop`);
    }
    var vType = valRes[0][0];
    var typeDef = vType.GetDefinition();
    var targetName = this.Target!.Name;
    var child = typeDef.Children[targetName];
    if (!child) throw new Error(`Value does not have member ${targetName}`);
    o.push(`apopa`, `adda ${child[1]}`, `apusha`);
    return o;
  }
  GetReferenceType(scope: Scope): VarType {
    var t = this.GetType(scope).Clone();
    t.PointerDepth++;
    return t;
  }

  TryCurry(scope: Scope) {
    if (this.Left instanceof Identifier) {
      if (scope.UserTypes[this.Left.Name]) return; // Static method
    }
    this.Curry = true;
  }
}
Variable.RegisterReadWritable(Index.Claim);
Variable.RegisterReferenceable(Index.Claim);
Expression.RegisterRight(Index.RightClaim);
