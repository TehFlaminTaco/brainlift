import { Claimer } from "./brainchild";
import { Expression } from "./expression";
import { Scope } from "./Scope";
import { IsSimplifyable, Simplifyable } from "./Simplifyable";
import { VarType } from "./vartype";

export class Cast extends Expression implements Simplifyable {
    Precedence: number = 17;
    LeftRightAssociative: boolean = false;
    Left: Expression | null = null;
    Targets: VarType[] = [];
    Simplify(scope: Scope): number | null {
        if(!IsSimplifyable(this.Left))return null;
        return this.Left!.TrySimplify(scope);
    }
    Evaluate(scope: Scope): [stack: VarType[], body: string[]] {
        let o: string[] = [];
        let res = this.Left!.TryEvaluate(scope);
        o.push(...res[1]);
        if(!VarType.CanCoax(this.Targets, res[0]))
            throw new Error(`Cannot cast ${res[0]} to ${this.Targets}`);
        o.push(...VarType.Coax(this.Targets, res[0])[0]);
        return [this.Targets, o];
    }
    GetTypes(scope: Scope): VarType[] {
        return this.Targets;
    }

    static RightClaim(left: Expression, claimer: Claimer): Cast|null {
        let l = claimer.Claim(/</);
        if(!l.Success){
            return null;
        }
        let targets: VarType[] = [];
        let t = VarType.Claim(claimer);
        while(t !== null){
            targets.push(t);
            if(!claimer.Claim(/,/).Success)
                break;
            t = VarType.Claim(claimer);
        }
        if(!claimer.Claim(/>/).Success){
            l.Fail();
            return null;
        }
        let newCast = new Cast(claimer, left.Claim);
        newCast.Left = left;
        newCast.Targets = targets;
        return newCast;
    }
}

Expression.RegisterRight(Cast.RightClaim);