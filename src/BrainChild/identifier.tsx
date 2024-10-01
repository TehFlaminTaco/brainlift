import { Claimer, Keywords } from "./brainchild";
import { Expression } from "./expression";
import { Scope } from "./Scope";
import { ReadWritable, Referenceable, Variable } from "./variable";
import { VarType } from "./vartype";

const forbiddenClasses = ["int", "void"];

export class Identifier
  extends Expression
  implements ReadWritable, Referenceable
{
  Name: string = "";
  static Claim(claimer: Claimer, allowForbiddenClasses: boolean = false): Identifier | null {
    var c = claimer.Claim(/[a-zA-Z_]\w*\b/);
    if (!c.Success) return null;
    if (Keywords.includes(c.Body![0])) {
      if (!(allowForbiddenClasses && forbiddenClasses.includes(c.Body![0]))){
        c.Fail();
        return null;
      }
    }
    var ident = new Identifier(claimer, c);
    ident.Name = c.Body![0];
    return ident;
  }

  Assign(scope: Scope): string[] {
    var res = scope.Get(this.Name);
    let t = res[0].GetDefinition();
    if (t.Name.startsWith("type")) {
      throw new Error("Cannot assign over class");
    }
    return [`apopb`, `seta ${res[1]}`, `putbptra`];
  }

  Read(scope: Scope): string[] {
    var res = scope.Get(this.Name);
    return [`seta ${res[1]}`, `ptra`, `apusha`];
  }

  Evaluate(scope: Scope): [stack: VarType[], body: string[]] {
    var res = scope.Get(this.Name);
    return [[res[0]], [this.GetLine(), `seta ${res[1]}`, `ptra`, `apusha`]];
  }

  GetPointer(scope: Scope): string[] {
    var res = scope.Get(this.Name);
    return [`apush ${res[1]}`];
  }
  GetReferenceTypes(scope: Scope): VarType[] {
    var res = scope.Get(this.Name);
    var t = res[0].Clone();
    t.PointerDepth++;
    return [t];
  }

  GetTypes(scope: Scope): VarType[] {
    let res = scope.Get(this.Name);
    return [res[0]];
  }
}

Variable.RegisterReadWritable(Identifier.Claim);
Variable.RegisterReferenceable(Identifier.Claim);
Expression.Register(Identifier.Claim);
