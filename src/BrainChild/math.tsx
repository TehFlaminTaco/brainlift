import { Claimer } from "./brainchild";
import { Expression, RightDonor } from "./expression";
import { Scope } from "./Scope";
import { VarType } from "./vartype";

export var operators: [
  Match: RegExp,
  Meta: string,
  Precedence: number,
  LeftRightAssociative: boolean
][] = [
  [/\*/, "mul", 12, true],
  [/\/%/, "divmod", 12, true],
  [/\//, "div", 12, true],
  [/%/, "mod", 12, true],
  [/\+/, "add", 11, true],
  [/-/, "sub", 11, true],
  [/>/, "gt", 9, true],
  [/</, "lt", 9, true],
  [/<=/, "le", 9, true],
  [/>=/, "ge", 9, true],
  [/==/, "eq", 8, true],
  [/!=/, "ne", 8, true],
  [/&&/, "and", 4, true],
  [/\|\|/, "or", 3, true],
];

export class MathExp extends Expression implements RightDonor {
  Precedence: number = 0;
  LeftRightAssociative: boolean = true;
  Left: Expression | null = null;
  Right: Expression | null = null;
  Operator: string = "";

  static RightClaim(left: Expression, claimer: Claimer): MathExp | null {
    var flag = claimer.Flag();
    for (var i = 0; i < operators.length; i++) {
      var op = operators[i];
      if (claimer.Claim(op[0]).Success) {
        var right = Expression.Claim(claimer);
        if (right === null) {
          flag.Fail();
          return null;
        }

        var math = new MathExp(claimer, left.Claim);
        math.Left = left;
        math.Right = right;
        math.Operator = op[1];
        math.Precedence = op[2];
        math.LeftRightAssociative = op[3];
        return math;
      }
    }
    return null;
  }

  Evaluate(scope: Scope): [stack: VarType[], body: string[]] {
    var o: string[] = [this.GetLine()];
    if (this.Operator === "and") {
      throw new Error("TODO");
    }
    if (this.Operator === "or") {
      throw new Error("TODO");
    }
    var left = this.Left!.Evaluate(scope);
    if (left[0].length < 1)
      throw new Error(`Leftside expression does not resolve to any value.`);
    var bothArgs = [left[0][0]];
    o.push(...left[1]);
    for (var i = 1; i < left[0].length; i++) o.push(`apop`);
    var right = this.Right!.Evaluate(scope);
    o.push(...right[1]);
    bothArgs.push(...right[0]);

    var metamethod:
      | [ReturnTypes: VarType[], ArgTypes: VarType[], Code: string[]]
      | null = null;
    for (var i = 0; i < bothArgs.length; i++) {
      metamethod = bothArgs[i]
        .GetDefinition()
        .GetMetamethod(this.Operator, bothArgs);
      if (metamethod !== null) {
        break;
      }
    }
    if (metamethod === null) {
      throw new Error(
        `No method for operator '${this.Operator}' for types ${bothArgs}`
      );
    }
    o.push(...VarType.Coax(metamethod[1], bothArgs));
    o.push(...metamethod[2]);
    return [metamethod[0], o];
  }
}

Expression.RegisterRight(MathExp.RightClaim);
