import { Claimer } from "./brainchild";
import { Identifier } from "./identifier";
import { Index } from "./index";
import { Statement } from "./statement";
import { Scope } from "./Scope";
import { Assignable, Variable } from "./variable";
import { VariableDecleration } from "./variabledefinition";
import { FuncType, VarType } from "./vartype";
import { ExpressionStatement } from "./expressionstatement";
import { Call } from "./call";
import { Block } from "./block";

export class FunctionDefinition extends Statement {
  Args: VariableDecleration[] = [];
  RetTypes: VarType[] = [];
  Target: Assignable | null = null;
  Body: Statement | null = null;
  IsMeta: boolean = false;
  Label: string = "";

  static Claim(claimer: Claimer): FunctionDefinition | null {
    var fnc = claimer.Claim(/function\b/);
    if (!fnc.Success) {
      return null;
    }

    var target = Variable.ClaimAssignable(claimer);
    if (target === null) {
      fnc.Fail();
      return null;
    }
    if (!(target instanceof Identifier) && !(target instanceof Index)) {
      fnc.Fail();
      return null;
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

    var body = Statement.Claim(claimer);
    if (body === null) {
      fnc.Fail();
      return null;
    }
    if (!(body instanceof Block)) {
      fnc.Fail();
      return null;
    }
    if (body.Statements.length > 0) {
      var last = body.Statements[body.Statements.length - 1];
      if (last instanceof ExpressionStatement && last.Body instanceof Call) {
        last.Body.IsFinalExpression = true;
      }
    }
    var funct = new FunctionDefinition(claimer, fnc);
    funct.Args = args;
    funct.RetTypes = retTypes;
    funct.Target = target;
    funct.Body = body;
    return funct;
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

    var body = Statement.Claim(claimer);
    if (body === null) {
      fnc.Fail();
      return null;
    }
    if (!(body instanceof Block)) {
      fnc.Fail();
      return null;
    }
    if (body.Statements.length > 0) {
      var last = body.Statements[body.Statements.length - 1];
      if (last instanceof ExpressionStatement && last.Body instanceof Call) {
        last.Body.IsFinalExpression = true;
      }
    }
    var funct = new FunctionDefinition(claimer, fnc);
    funct.Args = args;
    funct.RetTypes = retTypes;
    funct.Target = target;
    funct.Body = body;
    funct.IsMeta = true;
    return funct;
  }

  Evaluate(scope: Scope): string[] {
    if (!this.Body!.DefinitelyReturns() && this.RetTypes.length > 0) {
      throw new Error(
        `Function ${this.Target} must return types ${this.RetTypes}`
      );
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
    bodyScope.IsFunctionScope = true;
    bodyScope.CurrentRequiredReturns = this.RetTypes.concat();
    var o = [this.GetLine(), `${label}:`];
    for (let i = 0; i < this.Args.length; i++) {
      o.push(...this.Args[i].Evaluate(bodyScope).map((c) => "  " + c));
    }
    for (let i = this.Args.length - 1; i >= 0; i--) {
      o.push(`  seta ${this.Args[i].Label}`, `  apopb`, `  putbptra`);
    }
    o.push(...this.Body!.Evaluate(bodyScope).map((c) => "  " + c));
    if (!this.Body!.DefinitelyReturns()) {
      if (this.RetTypes.length > 0) throw new Error("Impossible");
      o.push(`  ret`);
    }
    scope.Assembly.push(...o);
    if (this.IsMeta) return [];
    return [`apush ${label}`, ...this.Target!.Assign(scope, funcType)];
  }
  DefinitelyReturns(): boolean {
    return false;
  }
}

Statement.RegisterTopLevel(FunctionDefinition.Claim);
