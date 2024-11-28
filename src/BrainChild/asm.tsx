import { Claim, Claimer } from "./brainchild";
import { Scope } from "./Scope";
import { Expression } from "./expression";
import { FuncType, VarType } from "./vartype";
import { Identifier } from "./identifier";

export class ASM extends Expression {
  Instructions: string[] = [];
  RetTypes: VarType[] = [];

  // Used souly in the form: asm function i(){}
  IsFunction: boolean = false;
  ArgTypes: VarType[] = [];
  Target: Identifier|null = null;

  static ClaimASMFunction(claimer: Claimer, asm: Claim): ASM|null {
    let flag = claimer.Claim(/function\b/);
    if(!flag.Success)
      return null;
    
    let target = Identifier.Claim(claimer);
    let oldGenericTypes = VarType.CurrentGenericArgs;
    VarType.CurrentGenericArgs = {};
    for (let o in oldGenericTypes) {
      VarType.CurrentGenericArgs[o] = oldGenericTypes[o];
    }

    let generics: string[] = [];
    let genArgNum = 0;
    if (claimer.Claim(/</).Success) {
      let arg = Identifier.Claim(claimer);
      while (arg !== null) {
        generics.push("functiongeneric$" + genArgNum);
        VarType.CurrentGenericArgs[arg.Name] = "functiongeneric$" + genArgNum++;
        if (!claimer.Claim(/,/).Success) break;
        arg = Identifier.Claim(claimer);
      }
      if (!claimer.Claim(/>/).Success) {
        VarType.CurrentGenericArgs = oldGenericTypes;
        flag.Fail();
        return null;
      }
    }
    if (!claimer.Claim(/\(/).Success) {
      flag.Fail();
      VarType.CurrentGenericArgs = oldGenericTypes;
      return null;
    }
    var args: VarType[] = [];
    var c = VarType.Claim(claimer);
    while (c !== null) {
      args.push(c);
      if (!claimer.Claim(/,/).Success) break;
      c = VarType.Claim(claimer);
    }
    if (!claimer.Claim(/\)/).Success) {
      flag.Fail();
      
      return null;
    }
    var retTypes: VarType[]|null = null;

    if (claimer.Claim(/->/).Success) {
      retTypes = [];
      var retType = VarType.Claim(claimer);
      while (retType !== null) {
        retTypes.push(retType);
        if (!claimer.Claim(/,/).Success) break;
        retType = VarType.Claim(claimer);
      }
    }

    VarType.CurrentGenericArgs = oldGenericTypes;

    if (!claimer.Claim(/\{/).Success) {
      flag.Fail();
      return null;
    }
    var theRest = claimer.Claim(/([^}]*)\}/);
    if (!theRest.Success) {
      flag.Fail();
      return null;
    }
    var as = new ASM(claimer, asm);
    as.Instructions = theRest
      .Body![1].split("\n")
      .map((c) => c.replace(/^\s+/, ""));
    as.RetTypes = retTypes || [];
    as.IsFunction = true;
    as.ArgTypes = args;
    as.Target = target;

    return as;
  }

  static Claim(claimer: Claimer) {
    var asm = claimer.Claim(/asm\b/);
    if (!asm.Success) {
      return null;
    }
    let asmFunc = ASM.ClaimASMFunction(claimer, asm);
    if (asmFunc !== null) return asmFunc;
    var retTypes = [];
    if (claimer.Claim(/->/).Success) {
      var retType = VarType.Claim(claimer);
      while (retType !== null) {
        retTypes.push(retType);
        if (!claimer.Claim(/,/).Success) break;
        retType = VarType.Claim(claimer);
      }
    }
    if (!claimer.Claim(/\{/).Success) {
      asm.Fail();
      return null;
    }
    var theRest = claimer.Claim(/([^}]*)\}/);
    if (!theRest.Success) {
      asm.Fail();
      return null;
    }
    var as = new ASM(claimer, asm);
    as.Instructions = theRest
      .Body![1].split("\n")
      .map((c) => c.replace(/^\s+/, ""));
    as.RetTypes = retTypes;
    return as;
  }
  FuncLabel?: string;
  Evaluate(scope: Scope): [VarType[], string[]] {
    if(this.IsFunction){
      if(!this.FuncLabel){
        this.FuncLabel = scope.GetSafeName(`asmfunction_${this.ArgTypes?.join('_')??''}_${this.RetTypes?.join('_')??''}`);
        scope.Assembly.push(this.GetLine(), ...[`${this.FuncLabel}:`, ...this.Instructions.map((c) =>
          c.replace(/\[([a-zA-Z_]\w*\b)\]/, (_, a) => scope.Get(a)[1])
        )]);
      }
      let o: string[] = [];
      if(this.Target !== null){
        scope.Set(this.Target.Name, this.GetTypes()[0], true);
        o.push(`xpush ${this.FuncLabel}`);
        o.push(...this.Target.Assign(scope));
      }
      o.push(`xpush ${this.FuncLabel}`);
      return [this.GetTypes(), o]
    }
    return [
      this.RetTypes,
      [
        this.GetLine(),
        ...this.Instructions.map((c) =>
          c.replace(/\[([a-zA-Z_]\w*\b)\]/, (_, a) => scope.Get(a)[1])
        ),
      ],
    ];
  }

  GetTypes(): VarType[] {
    if(this.IsFunction){
      let fakeClaimer = new Claimer("", "");
      let fakeClaim = fakeClaimer.Flag();
      let funcType = new FuncType(fakeClaimer, fakeClaim);
      funcType.ArgTypes = this.ArgTypes;
      funcType.RetTypes = this.RetTypes;
      return [funcType];
    }
    return this.RetTypes;
  }

  DefinitelyReturns(): false {
    return false;
  }
}
Expression.Register(ASM.Claim);
