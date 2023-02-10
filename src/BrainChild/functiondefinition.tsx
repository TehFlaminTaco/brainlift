import { Claimer } from "./brainchild";
import { Identifier } from "./identifier";
import { Index } from "./index";
import { Scope } from "./Scope";
import { Assignable, Variable } from "./variable";
import { VariableDecleration } from "./variabledefinition";
import { FuncType, VarType } from "./vartype";
import { Call } from "./call";
import { Block } from "./block";
import { Expression } from "./expression";

export class FunctionDefinition extends Expression {
  Args: VariableDecleration[] = [];
  RetTypes: VarType[] | null = [];
  Target: Assignable | null = null;
  Body: Expression | null = null;
  IsMeta: boolean = false;
  Label: string = "";

  static Claim(claimer: Claimer): FunctionDefinition | null {
    var fnc = claimer.Claim(/function\b/);
    if (!fnc.Success) {
      return null;
    }

    var target = Variable.ClaimAssignable(claimer, false);
    if (
      target !== null &&
      !(target instanceof Identifier) &&
      !(target instanceof Index)
    ) {
      fnc.Fail();
      return null;
    }
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
        generics.push(arg.Name);
        VarType.CurrentGenericArgs[arg.Name] = "$$" + genArgNum++;
        if (!claimer.Claim(/,/).Success) break;
        arg = Identifier.Claim(claimer);
      }
      if (!claimer.Claim(/>/).Success) {
        VarType.CurrentGenericArgs = oldGenericTypes;
        fnc.Fail();
        return null;
      }
    }

    if (!claimer.Claim(/\(/).Success) {
      fnc.Fail();
      return null;
    }
    var args: VariableDecleration[] = [];
    var c = VariableDecleration.Claim(claimer);
    while (c !== null) {
      args.push(c);
      if (!claimer.Claim(/,/).Success) break;
      c = VariableDecleration.Claim(claimer);
    }
    if (!claimer.Claim(/\)/).Success) {
      fnc.Fail();
      VarType.CurrentGenericArgs = oldGenericTypes;
      return null;
    }
    var retTypes = [];

    if (claimer.Claim(/->/).Success) {
      var retType = VarType.Claim(claimer);
      while (retType !== null) {
        retTypes.push(retType);
        if (!claimer.Claim(/,/).Success) break;
        retType = VarType.Claim(claimer);
      }
    }

    var body = Expression.Claim(claimer);
    VarType.CurrentGenericArgs = oldGenericTypes;
    if (body === null) {
      fnc.Fail();
      return null;
    }
    if (body instanceof Block) {
      if (body.Expressions.length > 0) {
        var last = body.Expressions[body.Expressions.length - 1];
        if (last instanceof Call) {
          last.IsFinalExpression = true;
        }
      }
    } else if (body instanceof Call) {
      body.IsFinalExpression = true;
    }
    var funct = new FunctionDefinition(claimer, fnc);
    funct.Args = args;
    funct.RetTypes = retTypes;
    funct.Target = target;
    funct.Body = body;
    return funct;
  }

  static ClaimArrow(claimer: Claimer): FunctionDefinition | null {
    var flg = claimer.Flag();
    var lParen = claimer.Claim(/\(/);
    var args: VariableDecleration[] = [];
    if (lParen.Success) {
      let c = VariableDecleration.Claim(claimer);
      while (c !== null) {
        args.push(c);
        if (!claimer.Claim(/,/).Success) break;
        c = VariableDecleration.Claim(claimer);
      }
    } else {
      let c = VariableDecleration.Claim(claimer);
      if (c === null) {
        flg.Fail();
        return null;
      }
      args.push(c);
    }
    if (lParen.Success && !claimer.Claim(/\)/).Success) {
      flg.Fail();
      return null;
    }
    var retTypes: VarType[] | null = null;
    if (claimer.Claim(/->/).Success) {
      retTypes = [];
      var retType = VarType.Claim(claimer);
      while (retType !== null) {
        retTypes.push(retType);
        if (!claimer.Claim(/,/).Success) break;
        retType = VarType.Claim(claimer);
      }
    }
    if (!claimer.Claim(/=>/).Success) {
      flg.Fail();
      return null;
    }
    var body = Expression.Claim(claimer);
    if (body instanceof Block) {
      if (body.Expressions.length > 0) {
        var last = body.Expressions[body.Expressions.length - 1];
        if (last instanceof Call) {
          last.IsFinalExpression = true;
        }
      }
    } else if (body instanceof Call) {
      body.IsFinalExpression = true;
    }
    var func = new FunctionDefinition(claimer, flg);
    func.Args = args;
    func.RetTypes = retTypes;
    func.Body = body;
    return func;
  }

  static ClaimMetamethod(claimer: Claimer) {
    var fnc = claimer.Claim(/metamethod\b/);
    if (!fnc.Success) {
      return null;
    }

    var target = Identifier.Claim(claimer);
    if (target === null) {
      fnc.Fail();
      return null;
    }
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
        generics.push(arg.Name);
        VarType.CurrentGenericArgs[arg.Name] = "$$" + genArgNum++;
        if (!claimer.Claim(/,/).Success) break;
        arg = Identifier.Claim(claimer);
      }
      if (!claimer.Claim(/>/).Success) {
        VarType.CurrentGenericArgs = {};
        fnc.Fail();
        return null;
      }
    }

    if (!claimer.Claim(/\(/).Success) {
      fnc.Fail();
      return null;
    }
    var args: VariableDecleration[] = [];
    var c = VariableDecleration.Claim(claimer);
    while (c !== null) {
      args.push(c);
      if (!claimer.Claim(/,/).Success) break;
      c = VariableDecleration.Claim(claimer);
    }
    if (!claimer.Claim(/\)/).Success) {
      fnc.Fail();
      VarType.CurrentGenericArgs = oldGenericTypes;
      return null;
    }
    var retTypes = [];

    if (claimer.Claim(/->/).Success) {
      var retType = VarType.Claim(claimer);
      while (retType !== null) {
        retTypes.push(retType);
        if (!claimer.Claim(/,/).Success) break;
        retType = VarType.Claim(claimer);
      }
    }

    var body = Expression.Claim(claimer);
    VarType.CurrentGenericArgs = oldGenericTypes;
    if (body === null) {
      fnc.Fail();
      return null;
    }
    if (body instanceof Block) {
      if (body.Expressions.length > 0) {
        var last = body.Expressions[body.Expressions.length - 1];
        if (last instanceof Call) {
          last.IsFinalExpression = true;
        }
      }
    } else if (body instanceof Call) {
      body.IsFinalExpression = true;
    }
    var funct = new FunctionDefinition(claimer, fnc);
    funct.Args = args;
    funct.RetTypes = retTypes;
    funct.Target = target;
    funct.Body = body;
    funct.IsMeta = true;
    return funct;
  }

  Evaluate(scope: Scope): [VarType[], string[]] {
    if (this.RetTypes === null) {
      this.RetTypes = this.Body!.GetTypes(scope);
    }
    var falseClaimer = new Claimer("");
    var falseClaim = falseClaimer.Flag();
    var funcType = new FuncType(falseClaimer, falseClaim);
    funcType.RetTypes = this.RetTypes.concat();
    funcType.ArgTypes = this.Args.map((c) => c.Type!);
    var label: string =
      this.Label.length > 0
        ? this.Label
        : scope.GetSafeName(
            "function_" + funcType.RetTypes + "_" + funcType.ArgTypes
          );
    if (this.Target instanceof Identifier && !this.IsMeta) {
      scope.Set(this.Target.Name, funcType);
    }
    var bodyScope = scope.Sub();
    bodyScope.CurrentFunction = this.Label;
    bodyScope.IsFunctionScope = true;
    bodyScope.SetRequiredReturns(this.RetTypes?.concat() ?? null);
    var o = [this.GetLine(), `${label}:`];
    for (let i = 0; i < this.Args.length; i++) {
      this.Args[i].TryEvaluate(bodyScope)[1].map((c) => "  " + c);
    }
    for (let i = this.Args.length - 1; i >= 0; i--) {
      o.push(`  seta ${this.Args[i].Label}`, `  apopb`, `  putbptra`);
    }
    var res = this.Body!.TryEvaluate(bodyScope);
    if (
      !this.Body!.DefinitelyReturns() &&
      !VarType.CanCoax(bodyScope.GetRequiredReturns()!, res[0])
    ) {
      throw new Error(
        `Function ${this.Target} must return types ${this.RetTypes}`
      );
    }
    o.push(...res[1].map((c) => "  " + c));
    if (!this.Body!.DefinitelyReturns()) {
      o.push(...VarType.Coax(bodyScope.GetRequiredReturns()!, res[0])[0]);
      o.push(`  ret`);
    }
    scope.Assembly.push(...o);
    let name = this.Target + "";
    if (this.Target instanceof Identifier) name = this.Target.Name;
    scope.AllVars[this.Label] = [
      funcType,
      name,
      scope.CurrentFile,
      scope.CurrentFunction,
    ];
    if (this.IsMeta) return [[], []];
    if (this.Target === null)
      return [[funcType], [this.GetLine(), `apush ${label}`]];
    return [
      [funcType],
      [
        this.GetLine(),
        `apush ${label}`,
        `apush ${label}`,
        ...this.Target!.Assign(scope, funcType),
      ],
    ];
  }
  DefinitelyReturns(): boolean {
    return false;
  }
  GetTypes(scope: Scope): VarType[] {
    if (this.RetTypes === null) {
      if (!(this.Body instanceof Expression)) {
        throw new Error(`Impossible`);
      }
      this.RetTypes = this.Body.GetTypes(scope);
    }
    var falseClaimer = new Claimer("");
    var falseFlag = falseClaimer.Flag();
    var funcType = new FuncType(falseClaimer, falseFlag);
    funcType.RetTypes = this.RetTypes.concat();
    funcType.ArgTypes = this.Args.map((c) => c.Type!);
    return [funcType];
  }
}

Expression.Register(FunctionDefinition.Claim);
Expression.Register(FunctionDefinition.ClaimArrow);
