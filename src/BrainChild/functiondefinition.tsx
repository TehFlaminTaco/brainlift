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
import { Return } from "./return";

export class FunctionDefinition extends Expression {
  Args: VariableDecleration[] = [];
  RetTypes: VarType[] | null = [];
  GenericArgs: string[] = [];
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

    if (!claimer.Claim(/\(/).Success) {
      fnc.Fail();
      return null;
    }
    var args: VariableDecleration[] = [];
    // Horrifying manual hack for params.
    var c =
      claimer.Claim(/params\b/).Success || VariableDecleration.Claim(claimer);
    while (c !== null) {
      if (c === true) {
        // parmas int[] j
        let typ = VarType.Claim(claimer);
        if (typ === null) {
          fnc.Fail();
          return null;
        }
        if (!claimer.Claim(/\[/).Success) {
          fnc.Fail();
          return null;
        }
        let lenIdentifier = Identifier.Claim(claimer);
        if (lenIdentifier === null) {
          fnc.Fail();
          return null;
        }
        if (!claimer.Claim(/\]/).Success) {
          fnc.Fail();
          return null;
        }
        let arrayIdentifier = Identifier.Claim(claimer);
        if (arrayIdentifier === null) {
          fnc.Fail();
          return null;
        }
        let fakeClaimer = new Claimer("", "");
        let fakeClaim = fakeClaimer.Flag();
        let lengthVD = new VariableDecleration(fakeClaimer, fakeClaim);
        lengthVD.Type = VarType.Int;
        lengthVD.Identifier = lenIdentifier;
        let arrayVD = new VariableDecleration(fakeClaimer, fakeClaim);
        arrayVD.Type = typ.WithDeltaPointerDepth(1);
        arrayVD.Identifier = arrayIdentifier;
        args.push(lengthVD, arrayVD);
        break;
      }
      args.push(c);
      if (!claimer.Claim(/,/).Success) break;
      c =
        claimer.Claim(/params\b/).Success || VariableDecleration.Claim(claimer);
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
      let fakeClaimer = new Claimer("", "");
      let fakeClaim = fakeClaimer.Flag();
      let fakeBlock = new Block(fakeClaimer, fakeClaim);
      body = fakeBlock;
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
        generics.push("$$" + genArgNum);
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
      let fakeClaimer = new Claimer("", "");
      let fakeClaim = fakeClaimer.Flag();
      let fakeBlock = new Block(fakeClaimer, fakeClaim);
      body = fakeBlock;
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
    funct.GenericArgs = generics;
    return funct;
  }

  // Like ClaimMetamethod, but has an implied name of "ofClass" and the args get an extra argument appended
  static ClaimConstructor(claimer: Claimer, ofClass: Identifier) {
    let fnc = claimer.Flag();
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
        generics.push("$$" + genArgNum);
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
    let fakeClaimer = new Claimer("");
    let fakeClaim = fakeClaimer.Flag();
    let fakeArg = new VariableDecleration(fakeClaimer, fakeClaim);
    fakeArg.Type = new VarType(fakeClaimer, fakeClaim);
    fakeArg.Type.TypeName = ofClass.Name;
    fakeArg.Identifier = new Identifier(fakeClaimer, fakeClaim);
    fakeArg.Identifier.Name = "this";
    args.push(fakeArg);
    if (!claimer.Claim(/\)/).Success) {
      fnc.Fail();
      VarType.CurrentGenericArgs = oldGenericTypes;
      return null;
    }
    var retTypes = [fakeArg.Type];

    var body = Expression.Claim(claimer);
    VarType.CurrentGenericArgs = oldGenericTypes;
    if (body === null) {
      let fakeBlock = new Block(fakeClaimer, fakeClaim);
      body = fakeBlock;
    }
    if (!(body instanceof Block)) {
      // Wrap the body in a fake block for constructors
      let fakeBlock = new Block(fakeClaimer, fakeClaim);
      fakeBlock.Expressions.push(body);
      body = fakeBlock;
    }
    // Add a return statement to the end of the block
    let fakeReturn = new Return(fakeClaimer, fakeClaim);
    // "this" identifier
    let thisIdentifier = new Identifier(fakeClaimer, fakeClaim);
    thisIdentifier.Name = "this";
    fakeReturn.Values = [thisIdentifier];
    (body as Block).Expressions.push(fakeReturn);

    var funct = new FunctionDefinition(claimer, fnc);
    funct.Args = args;
    funct.RetTypes = retTypes;
    funct.Target = ofClass;
    funct.Body = body;
    funct.IsMeta = true;
    funct.GenericArgs = generics;
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
    let simpleName = "function";
    if (this.Target instanceof Identifier) {
      simpleName = this.Target.Name;
    }
    var label: string =
      this.Label.length > 0
        ? this.Label
        : scope.GetSafeName(
            simpleName +
              "_" +
              funcType.RetTypes.join("_") +
              "_" +
              funcType.ArgTypes.join("_")
          );
    if (this.Target instanceof Identifier && !this.IsMeta) {
      scope.Set(this.Target.Name, funcType);
    }
    var paddingScope = scope.Sub();
    paddingScope.IsFunctionScope = false;
    var bodyScope = paddingScope.Sub();
    bodyScope.CurrentFunction = label;
    bodyScope.IsFunctionScope = true;
    bodyScope.SetRequiredReturns(this.RetTypes?.concat() ?? null);
    var o = [this.GetLine(), `${label}:`];
    for (let i = 0; i < this.Args.length; i++) {
      this.Args[i].TryEvaluate(bodyScope)[1].map((c) => "  " + c);
    }
    for (let i = this.Args.length - 1; i >= 0; i--) {
      o.push(`  seta ${this.Args[i].Label}`, ...this.Args[i].Type!.Put("a", "a"));
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
    if (this.IsMeta) {
      scope.MetaMethods[name] = scope.MetaMethods[name] ?? [];
      // Check if any metamethod already exists with this signature
      for (let i = 0; i < scope.MetaMethods[name].length; i++) {
        if (
          VarType.AllEquals(scope.MetaMethods[name][i][1], funcType.ArgTypes) &&
          (name === "cast"
            ? VarType.AllEquals(scope.MetaMethods[name][i][0], this.RetTypes)
            : true)
        ) {
          throw new Error(
            `Metamethod ${name} already exists with signature ${funcType.ArgTypes} -> ${scope.MetaMethods[name][i][0]}`
          );
        }
      }
      scope.MetaMethods[name].push([
        this.RetTypes!,
        this.Args.map((c) => c.Type!),
        [`call ${label}`],
        this.GenericArgs,
        scope.CurrentFile
      ]);
      return [[], []];
    }
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
Expression.Register(FunctionDefinition.ClaimMetamethod);
