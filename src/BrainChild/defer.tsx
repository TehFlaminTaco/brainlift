import { Scope } from "./Scope";
import { IsSimplifyable, Simplifyable } from "./Simplifyable";
import { Claimer } from "./brainchild";
import { Expression } from "./expression";
import { VarType } from "./vartype";

export class Defer extends Expression implements Simplifyable {
    Target: Expression|null = null;
    IsTemp: boolean = false

    static Claim(claimer: Claimer): Defer | null {
        let ret = claimer.Claim(/defer\b/);
        let isTmp = false;
        if(!ret.Success){
            ret = claimer.Claim(/temp\b/);
            isTmp = true;
        }
        if(!ret.Success){
            return null;
        }
        let target = Expression.Claim(claimer);
        if(target === null){
            ret.Fail();
            return null;
        }
        let us = new Defer(claimer, ret);
        us.Target = target;
        us.IsTemp = isTmp;
        return us;
    }

    Evaluate(scope: Scope): [stack: VarType[], body: string[]] {
        if(this.IsTemp){
            let disposeLabel = scope.GetSafeName("disposable");
            let targetRes = this.Target!.TryEvaluate(scope);
            // Allocate  space in disposeLabel for each disposable type.
            let size = targetRes[0].map(c=>c.IsWide()?c.GetDefinition().Size:1).reduce((a,b)=>a+b);
            let o: string[] = [];
            let disp: string[] = [];
            o.push(...targetRes[1]);
            // Store every type into dispose memory
            o.push(`setb ${disposeLabel}`, ...new Array(size).fill([`xpopa`, `putaptrb`, `incb`]).flat())
            // Load it back from dispose memory unto the stack.
            o.push(...new Array(size).fill([`decb`, `cpyba`, `ptra`, `xpusha`]).flat())
            let everDisposable = false;
            for(let i=targetRes[0].length-1; i>=0; i--){
                let c = targetRes[0][i];
                let mm = scope.GetMetamethod("dispose", [c]);
                if(mm === null){
                    disp.push(...targetRes[0][i].XPop())
                }else{
                    everDisposable = true;
                    disp.push(...mm[2]);
                    disp.push(...mm[0].map(j=>j.XPop()).flat())
                }
            }
            if(!everDisposable)
                return targetRes;
            scope.Assembly.push(`${disposeLabel}: db ${new Array(size).fill(0).join(',')}`);
            scope.Deferred.push(`setb ${disposeLabel}`, `addb ${size}`, ...new Array(size).fill([`decb`, `cpyba`, `ptra`, `xpusha`]).flat(), ...disp);
            return [targetRes[0],o]
        }else{
            let targetRes = this.Target!.TryEvaluate(scope);
            let o: string[] = [];
            o.push(...targetRes[1]);
            for(let i=0; i < targetRes[0].length; i++)
                o.push(...targetRes[0][i].XPop());
            scope.Deferred.push(...o);
            return [[], []];
        }

    }
    GetTypes(scope: Scope): VarType[] {
        if(this.IsTemp){
            return this.Target!.GetTypes(scope);
        }
        return [];
    }
    Simplify(scope: Scope): number | null {
        if(!this.IsTemp) return null;
        if(!IsSimplifyable(this.Target))return null;
        return this.Target!.TrySimplify(scope);
    }

    DefinitelyReturns(scope: Scope): false|VarType[] {
        return this.Target!.DefinitelyReturns(scope);
    }
}

Expression.Register(Defer.Claim);