import { Claimer } from "./brainchild";
import { Expression } from "./expression";
import { Scope } from "./Scope";
import { Simplifyable } from "./Simplifyable";
import { VarType } from "./vartype";

export class SizeOf extends Expression implements Simplifyable {
    Type: VarType|null = null;
    
    Simplify(scope: Scope): number | null {
        let t = this.Type!.GetDefinition();
        return t.Size;
    }
    
    static Claim(claimer: Claimer): SizeOf | null {
        var ret = claimer.Claim(/sizeof\b/);
        if (!ret.Success) return null;
        var t = VarType.Claim(claimer);
        if (t === null) return null;
        var s = new SizeOf(claimer, ret);
        s.Type = t;
        return s;
    }
    
    Evaluate(scope: Scope): [VarType[], string[]] {
        let t = this.Type!.GetDefinition();
        return [ [VarType.Int], [this.GetLine(), `apush ${t.Size}`] ];
    }

    GetTypes(scope: Scope): VarType[] {
        return [VarType.Int];
    }
}
Expression.Register(SizeOf.Claim);