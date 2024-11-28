import { Scope } from "./Scope";
import { IsSimplifyable, Simplifyable } from "./Simplifyable";
import { Claimer } from "./brainchild";
import { Expression } from "./expression";
import { VarType } from "./vartype";

export class Using extends Expression implements Simplifyable {
    Target: Expression|null = null;
    Body: Expression|null = null;

    static Claim(claimer: Claimer): Using | null {
        let ret = claimer.Claim(/using\b/);
        if(!ret.Success) return null;
        let target = Expression.Claim(claimer);
        if(target === null){
            ret.Fail();
            return null;
        }
        let body = Expression.Claim(claimer);
        if (body === null){
            ret.Fail();
            return null;
        }
        let us = new Using(claimer, ret);
        us.Target = target;
        us.Body = body;
        return us;
    }

    Evaluate(scope: Scope): [stack: VarType[], body: string[]] {
        let o: string[] = [];
        let targetRes = this.Target!.TryEvaluate(scope);
        o.push(...targetRes[1])
        o.push(...targetRes[0].map(c=>c.XPop()).flat());
        let bodyRes = this.Body!.TryEvaluate(scope);
        o.push(...bodyRes[1]);
        // Run all dispose metamethods
        for(let i=targetRes[0].length-1; i>=0; i--){
            let c = targetRes[0][i];
            let mm = scope.GetMetamethod("dispose", [c]);
            if(mm === null){
                o.push(...targetRes[0][i].XPop())
            }else{
                o.push(...mm[2]);
                o.push(...mm[0].map(j=>j.XPop()).flat())
            }
        }
        return [bodyRes[0], o];
    }
    GetTypes(scope: Scope): VarType[] {
        return this.Body!.GetTypes(scope);
    }
    Simplify(scope: Scope): number | null {
        if(!IsSimplifyable(this.Target))return null;
        if(!IsSimplifyable(this.Body))return null;
        if(this.Target!.TrySimplify(scope) === null)return null;
        return this.Body!.TrySimplify(scope);        
    }

    DefinitelyReturns(scope: Scope): false|VarType[] {
        return this.Target!.DefinitelyReturns(scope) || this.Body!.DefinitelyReturns(scope);
    }

    PotentiallyReturns(scope: Scope): false|VarType[] {
        return this.Target!.PotentiallyReturns(scope) || this.Body!.PotentiallyReturns(scope);
    }

}

Expression.Register(Using.Claim);