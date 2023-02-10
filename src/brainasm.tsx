import { GetStackIndex, MetaInterpreter } from "./brainmeta";

/*
REG = A..B
HEAP = C..D
STACK1 = E
STACK2 = F

HEAPPOINTER = REG[0], REG[1]
HEAPTARGET = REG[2], REG[3]

INSTRUCTIONPOINTER = REG[4], REG[5]
INSTRUCTION = REG[6], .., REG[8], REG[9]

UNUSED = REG[7], REG[15]

ACC_A = REG[10], REG[11]
ACC_B = REG[12], REG[13]

HALTLOOP = REG[14],...

TEMPA = REG[16],REG[17]
TEMPB = REG[18],REG[19]

; REG should ALWAYS return to 0 after an action performed on it

NOP:
Do nothing

HALT:
Stop execution

SETA:
Set Register A to the argument

SETB:
Set Register B to the argument

CPYAB:
Copy the value of Register A to Register B

CPYBA:
Copy the value of Register B to Register A

PTRA:
Derefence the value of Register A and set it to the value stored at the address

PTRB:
Deference the value of Register B and set it to the value stored at the address

PUTBPTRA:
Load the value of Register B into the address stored in Register A

PUTAPTRB:
Load the value of Register A into the address stored in Register B

JMP:
Jump to the argument

JMPA:
Jump to the address stored in Register A

JMPB:
Jump to the address stored in Register B

JNZA:
If Register A is not zero, jump to the argument

JNZB:
If Register B is not zero, jump to the argument

JBNZA:
If Register A is not zero, jump to the address stored in Register B

JANZB:
If Register B is not zero, jump to the address stored in Register A

CALL:
Jump to the argument whilst pushing the current instruction pointer onto the B stack

CALLA:
Jump to the address stored in Register A whilst pushing the current instruction pointer onto the B stack

CALLB:
Jump to the address stored in Register B whilst pushing the current instruction pointer onto the B stack

RET:
Pop the top of the B stack and jump to it

INCA:
Increment Register A by 1

INCB:
Increment Register B by 1

DECA:
Decrement Register A by 1

DECB:
Decrement Register B by 1

ADDA:
Add the argument to Register A

ADDB:
Add the argument to Register B

ADDAB:
Add the value of Register A to Register B into Register B. Sets Register A to 0

ADDBA:
Add the value of Register B to Register A into Register A. Sets Register B to 0

SUBA:
Subtract the argument from Register A

SUBB:
Subtract the argument from Register B

SUBAB:
Subtract the value of Register A from Register B into Register B. Sets Register A to 0

SUBBA:
Subtract the value of Register B from Register A into Register A. Sets Register B to 0

MULAB:
Multiply the value of Register A by Register B into Regsiter B. Sets Register A to 0

MULBA:
Multiply the value of Register B by Register A into Register A. Sets Register B to 0

DIVAB:
Divide the value of Register A by Register B. Sets the remainder to Register B and the quotient to Register A

DIVBA:
Divide the value of Register B by Register A. Sets the remainder to Register A and the quotient to Register B

READA:
Read a value from the input stream and store it in Register A

READB:
Read a value from the input stream and store it in Register B

WRITEA:
Write the value of Register A to the output stream

WRITEB:
Write the value of Register B to the output stream

CMP:
Decrement both Registers untill either is Zero.
  A>B: Set Register A to non-zero, Register B to 0
  A<B: Set Register A to 0, Register B to non-zero
  A=B: Set both Registers to 0

APUSH:
Push the argument onto the A stack

BPUSH:
Push the argument onto the B stack

APUSHA:
Push the value of Register A onto the A stack

APUSHB:
Push the value of Register B onto the A stack

BPUSHA:
Push the value of Register A onto the B stack

BPUSHB:
Push the value of Register B onto the B stack

APOP:
Pop the top of the A stack

BPOP:
Pop the top of the B stack

APOPA:
Pop the top of the A stack and store it in Register A

APOPB:
Pop the top of the A stack and store it in Register B

BPOPA:
Pop the top of the B stack and store it in Register A

BPOPB:
Pop the top of the B stack and store it in Register B


*/
const STACK1 = "E";
const STACK2 = "F";

export class Tape {
  LeftStack: string;
  RightStack: string;
  constructor(leftStack: string, rightStack: string) {
    this.LeftStack = leftStack;
    this.RightStack = rightStack;
  }

  RotateRight() {
    return `MOV ${this.RightStack} ${this.LeftStack}\n`;
  }
  RotateLeft() {
    return `MOV ${this.LeftStack} ${this.RightStack}\n`;
  }

  Left() {
    return this.RotateLeft() + this.RotateLeft();
  }
  Right() {
    return this.RotateRight() + this.RotateRight();
  }

  IncShort() {
    return (
      `INC ${this.LeftStack} 1\n` +
      `CPY ${this.LeftStack} ${STACK2}\n` +
      `PUT ${STACK1} 1\n` +
      `WHL ${STACK2}\n` +
      `ZER ${STACK1}\n` +
      `ZER ${STACK2}\n` +
      `END\n` +
      `POP ${STACK2}\n` +
      `WHL ${STACK1}\n` +
      `INC ${this.RightStack}\n` +
      `ZER ${STACK1}\n` +
      `END\n` +
      `POP ${STACK1}\n`
    );
  }
  DecShort() {
    return (
      `CPY ${this.LeftStack} ${STACK2}\n` +
      `PUT ${STACK1} 1\n` +
      `WHL ${STACK2}\n` +
      `ZER ${STACK1}\n` +
      `ZER ${STACK2}\n` +
      `END\n` +
      `POP ${STACK2}\n` +
      `WHL ${STACK1}\n` +
      `DEC ${this.RightStack}\n` +
      `ZER ${STACK1}\n` +
      `END\n` +
      `POP ${STACK1}\n` +
      `DEC ${this.LeftStack} 1\n`
    );
  }
  AddShort(gotoB: string, gotoA: string) {
    return `WHL ${this.LeftStack}
${this.DecShort()}
${gotoB}
${this.IncShort()}
${gotoA}
END
${this.RotateRight()}
WHL ${this.LeftStack}
DEC ${this.LeftStack}
${gotoB}
INC ${this.LeftStack}
${gotoA}
END
${this.RotateLeft()}`;
  }
  SubShort(gotoB: string, gotoA: string) {
    return `WHL ${this.LeftStack}
${this.DecShort()}
${gotoB}
${this.DecShort()}
${gotoA}
END
${this.RotateRight()}
WHL ${this.LeftStack}
DEC ${this.LeftStack}
${gotoB}
DEC ${this.LeftStack}
${gotoA}
END
${this.RotateLeft()}`;
  }
  CpyShort(gotoB: string, gotoA: string) {
    return (
      `CPY ${this.LeftStack} ${STACK1}\n` +
      `CPY ${this.RightStack} ${STACK1}\n` +
      gotoB +
      `ZER ${this.LeftStack}\n` +
      `ZER ${this.RightStack}\n` +
      `ADD ${STACK1} ${this.RightStack}\n` +
      `ADD ${STACK1} ${this.LeftStack}\n` +
      gotoA
    );
  }
  ZerShort() {
    return `ZER ${this.LeftStack}\nZER ${this.RightStack}\n`;
  }
}

const REG = new Tape("A", "B");
const HEAP = new Tape("C", "D");

let IF = function (conditionStack: string, truthy: string) {
  return `CPY ${conditionStack} ${STACK1}
WHL ${STACK1}
  POP ${STACK1}
  ${truthy}
  PUT ${STACK1} 0
END
POP ${STACK1}
`;
};

let IFSHORT = function (tape: Tape, truthy: string) {
  return `PUT ${STACK1} 0
${IF(tape.LeftStack, `INC ${STACK1}`)}
${IF(tape.RightStack, `INC ${STACK1}`)}
${IF(
  STACK1,
  `POP ${STACK1}
${truthy}
PUT ${STACK1} 0`
)}
POP ${STACK1}
`;
};

let WHILESHORT = function (tape: Tape, body: string) {
  return `PUT ${STACK2} 0
${IFSHORT(tape, `INC ${STACK2}`)}
WHL ${STACK2}
  POP ${STACK2}
  ${body}
  PUT ${STACK2} 0
  ${IFSHORT(tape, `INC ${STACK2}`)}
END
POP ${STACK2}
`;
};

let HEAP_MOVE = function () {
  return `${WHILESHORT(REG, REG.DecShort() + HEAP.Left())}
${REG.Right()}
${WHILESHORT(
  REG,
  REG.DecShort() + REG.Left() + REG.IncShort() + REG.Right() + HEAP.Right()
)}
${REG.Left()}
`;
};

let GOTO_IP = function () {
  return `${REG.Right()}
${REG.Right()}
CPY ${REG.LeftStack} ${STACK1}
CPY ${REG.RightStack} ${STACK1}
${REG.Left()}
ZER ${REG.RightStack}
ADD ${STACK1} ${REG.RightStack}
ZER ${REG.LeftStack}
ADD ${STACK1} ${REG.LeftStack}
${REG.Left()}
${HEAP_MOVE()}
`;
};

let LOAD_INSTRUCTION = function () {
  return `${GOTO_IP()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.ZerShort()}
CPY ${HEAP.LeftStack} ${HEAP.LeftStack}
ADD ${HEAP.LeftStack} ${REG.LeftStack}
CPY ${HEAP.RightStack} ${HEAP.RightStack}
ADD ${HEAP.RightStack} ${REG.RightStack}
${REG.Right()}
${REG.ZerShort()}
${HEAP.Right()}
CPY ${HEAP.LeftStack} ${HEAP.LeftStack}
ADD ${HEAP.LeftStack} ${REG.LeftStack}
CPY ${HEAP.RightStack} ${HEAP.RightStack}
ADD ${HEAP.RightStack} ${REG.RightStack}
${HEAP.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
};

function HALT() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
ZER ${REG.LeftStack}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function SETA() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.CpyShort(REG.Right(), REG.Left())}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
`;
}
function SETB() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.CpyShort(REG.Right() + REG.Right(), REG.Left() + REG.Left())}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
`;
}
function CPYAB() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.ZerShort()}
${REG.Left()}
CPY ${REG.LeftStack} ${STACK1}
CPY ${REG.RightStack} ${STACK1}
${REG.Right()}
ADD ${STACK1} ${REG.RightStack}
ADD ${STACK1} ${REG.LeftStack}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function CPYBA() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.ZerShort()}
${REG.Right()}
CPY ${REG.LeftStack} ${STACK1}
CPY ${REG.RightStack} ${STACK1}
${REG.Left()}
ADD ${STACK1} ${REG.RightStack}
ADD ${STACK1} ${REG.LeftStack}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
// Read A into A
function PTRA() {
  return `${REG.Right()}
${REG.ZerShort()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.AddShort(
  REG.Left() + REG.Left() + REG.Left() + REG.Left(),
  REG.Right() + REG.Right() + REG.Right() + REG.Right()
)}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${HEAP_MOVE()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
CPY ${HEAP.LeftStack} ${STACK1}
CPY ${HEAP.RightStack} ${STACK1}
ADD ${STACK1} ${REG.RightStack}
ADD ${STACK1} ${REG.LeftStack}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
`;
}
// Read B into B
function PTRB() {
  return `${REG.Right()}
${REG.ZerShort()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.AddShort(
  REG.Left() + REG.Left() + REG.Left() + REG.Left() + REG.Left(),
  REG.Right() + REG.Right() + REG.Right() + REG.Right() + REG.Right()
)}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${HEAP_MOVE()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
CPY ${HEAP.LeftStack} ${STACK1}
CPY ${HEAP.RightStack} ${STACK1}
ADD ${STACK1} ${REG.RightStack}
ADD ${STACK1} ${REG.LeftStack}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
`;
}
function PUTBPTRA() {
  return `${REG.Right()}
${REG.ZerShort()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
CPY ${REG.LeftStack} ${STACK1}
CPY ${REG.RightStack} ${STACK1}
${REG.Left()}
${REG.AddShort(
  REG.Left() + REG.Left() + REG.Left() + REG.Left(),
  REG.Right() + REG.Right() + REG.Right() + REG.Right()
)}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${HEAP_MOVE()}
ZER ${HEAP.LeftStack}
ZER ${HEAP.RightStack}
ADD ${STACK1} ${HEAP.RightStack}
ADD ${STACK1} ${HEAP.LeftStack}
`;
}
function PUTAPTRB() {
  return `${REG.Right()}
${REG.ZerShort()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
CPY ${REG.LeftStack} ${STACK1}
CPY ${REG.RightStack} ${STACK1}
${REG.Right()}
${REG.AddShort(
  REG.Left() + REG.Left() + REG.Left() + REG.Left() + REG.Left(),
  REG.Right() + REG.Right() + REG.Right() + REG.Right() + REG.Right()
)}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${HEAP_MOVE()}
ZER ${HEAP.LeftStack}
ZER ${HEAP.RightStack}
ADD ${STACK1} ${HEAP.RightStack}
ADD ${STACK1} ${HEAP.LeftStack}
`;
}
function JMP() {
  return `${REG.Right()}
${REG.Right()}
${REG.ZerShort()}
${REG.Right()}
${REG.Right()}
${REG.AddShort(REG.Left() + REG.Left(), REG.Right() + REG.Right())}
${REG.Left()}
${REG.Left()}
${REG.DecShort()}
${REG.DecShort()}
${REG.Left()}
${REG.Left()}`;
}
function JMPA() {
  return `${REG.Right()}
${REG.Right()}
${REG.ZerShort()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.AddShort(
  REG.Left() + REG.Left() + REG.Left(),
  REG.Right() + REG.Right() + REG.Right()
)}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.DecShort()}
${REG.DecShort()}
${REG.Left()}
${REG.Left()}`;
}
function JMPB() {
  return `${REG.Right()}
${REG.Right()}
${REG.ZerShort()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.AddShort(
  REG.Left() + REG.Left() + REG.Left() + REG.Left(),
  REG.Right() + REG.Right() + REG.Right() + REG.Right()
)}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.DecShort()}
${REG.DecShort()}
${REG.Left()}
${REG.Left()}`;
}
function JNZA() {
  return `PUT ${STACK2} 0
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${IFSHORT(REG, `INC ${STACK2}`)}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${IF(STACK2, JMP())}
POP ${STACK2}`;
}
function JNZB() {
  return `PUT ${STACK2} 0
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${IFSHORT(REG, `INC ${STACK2}`)}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${IF(STACK2, JMP())}
POP ${STACK2}`;
}
function JBNZA() {
  return `PUT ${STACK2} 0
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${IFSHORT(REG, `INC ${STACK2}`)}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${IF(STACK2, JMPB())}
POP ${STACK2}`;
}
function JANZB() {
  return `PUT ${STACK2} 0
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${IFSHORT(REG, `INC ${STACK2}`)}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${IF(STACK2, JMPA())}
POP ${STACK2}`;
}
function CALL() {
  return `${REG.Right()}
${REG.Right()}
${REG.IncShort()}
${REG.IncShort()}
CPY ${REG.LeftStack} ${STACK2}
CPY ${REG.RightStack} ${STACK2}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
CPY ${REG.LeftStack} ${STACK2}
CPY ${REG.RightStack} ${STACK2}
${REG.Left()}
CPY ${REG.LeftStack} ${STACK2}
CPY ${REG.RightStack} ${STACK2}
${REG.Left()}
${REG.CpyShort(REG.Left() + REG.Left(), REG.Right() + REG.Right())}
${REG.Left()}
${REG.Left()}
${REG.DecShort()}
${REG.DecShort()}
${REG.Left()}
${REG.Left()}`;
}
function CALLA() {
  return `${REG.Right()}
${REG.Right()}
${REG.IncShort()}
${REG.IncShort()}
CPY ${REG.LeftStack} ${STACK2}
CPY ${REG.RightStack} ${STACK2}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.CpyShort(
  REG.Left() + REG.Left() + REG.Left(),
  REG.Right() + REG.Right() + REG.Right()
)}
${REG.Right()}
CPY ${REG.LeftStack} ${STACK2}
CPY ${REG.RightStack} ${STACK2}
${REG.Left()}
CPY ${REG.LeftStack} ${STACK2}
CPY ${REG.RightStack} ${STACK2}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.DecShort()}
${REG.DecShort()}
${REG.Left()}
${REG.Left()}`;
}
function CALLB() {
  return `${REG.Right()}
${REG.Right()}
${REG.IncShort()}
${REG.IncShort()}
CPY ${REG.LeftStack} ${STACK2}
CPY ${REG.RightStack} ${STACK2}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.CpyShort(
  REG.Left() + REG.Left() + REG.Left() + REG.Left(),
  REG.Right() + REG.Right() + REG.Right() + REG.Right()
)}
CPY ${REG.LeftStack} ${STACK2}
CPY ${REG.RightStack} ${STACK2}
${REG.Left()}
CPY ${REG.LeftStack} ${STACK2}
CPY ${REG.RightStack} ${STACK2}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.DecShort()}
${REG.DecShort()}
${REG.Left()}
${REG.Left()}`;
}
function RET() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.ZerShort()}
ADD ${STACK2} ${REG.RightStack}
ADD ${STACK2} ${REG.LeftStack}
${REG.Right()}
${REG.ZerShort()}
ADD ${STACK2} ${REG.RightStack}
ADD ${STACK2} ${REG.LeftStack}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.ZerShort()}
ADD ${STACK2} ${REG.RightStack}
ADD ${STACK2} ${REG.LeftStack}
${REG.DecShort()}
${REG.DecShort()}
${REG.Left()}
${REG.Left()}
`;
}
function INCA() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.IncShort()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function INCB() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.IncShort()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function DECA() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.IncShort()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function DECB() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.IncShort()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function ADDA() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.AddShort(REG.Right(), REG.Left())}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function ADDB() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.AddShort(REG.Right() + REG.Right(), REG.Left() + REG.Left())}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function ADDAB() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.AddShort(REG.Right(), REG.Left())}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function ADDBA() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.AddShort(REG.Left(), REG.Right())}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function SUBA() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.SubShort(REG.Right(), REG.Left())}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function SUBB() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.SubShort(REG.Right() + REG.Right(), REG.Left() + REG.Left())}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function SUBAB() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.SubShort(REG.Right(), REG.Left())}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function SUBBA() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.SubShort(REG.Left(), REG.Right())}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function MULAB() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.CpyShort(REG.Left(), REG.Right())}
ZER ${REG.LeftStack}
ZER ${REG.RightStack}
${REG.Right()}
CPY ${REG.LeftStack} ${STACK1}
CPY ${REG.RightStack} ${STACK1}
ZER ${REG.LeftStack}
ZER ${REG.RightStack}
${REG.Left()}
${REG.Left()}
${WHILESHORT(
  REG,
  `${REG.DecShort()}
  ${REG.Right()}
  ADD ${STACK1} ${REG.RightStack}
  ADD ${STACK1} ${REG.LeftStack}
  CPY ${REG.LeftStack} ${STACK1}
  CPY ${REG.RightStack} ${STACK1}
  ${REG.AddShort(REG.Right(), REG.Left())}
  ${REG.Left()}
`
)}
POP ${STACK1}
POP ${STACK1}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
`;
}
function MULBA() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.CpyShort(REG.Left() + REG.Left(), REG.Right() + REG.Right())}
ZER ${REG.LeftStack}
ZER ${REG.RightStack}
${REG.Left()}
CPY ${REG.LeftStack} ${STACK1}
CPY ${REG.RightStack} ${STACK1}
ZER ${REG.LeftStack}
ZER ${REG.RightStack}
${REG.Left()}
${WHILESHORT(
  REG,
  `${REG.DecShort()}
  ${REG.Right()}
  ${REG.Right()}
  ADD ${STACK1} ${REG.RightStack}
  ADD ${STACK1} ${REG.LeftStack}
  CPY ${REG.LeftStack} ${STACK1}
  CPY ${REG.RightStack} ${STACK1}
  ${REG.AddShort(REG.Left(), REG.Right())}
  ${REG.Left()}
  ${REG.Left()}
`
)}
POP ${STACK1}
POP ${STACK1}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
`;
}
function DIVAB() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.CpyShort(REG.Left() + REG.Left(), REG.Right() + REG.Right())}
${REG.Left()}
${WHILESHORT(
  REG,
  `${REG.DecShort()}
  ${REG.Right()}
  ${REG.Right()}
  ${REG.Right()}
  ${REG.IncShort()}
  ${REG.Left()}
  ${REG.Left()}
  ${REG.DecShort()}
  PUT ${STACK2} 1
  ${IFSHORT(REG, `ZER ${STACK2}`)}
  WHL ${STACK2}
    ${REG.Left()}
    ${REG.Left()}
    ${REG.CpyShort(REG.Right() + REG.Right(), REG.Left() + REG.Left())}
    ${REG.Right()}
    ${REG.Right()}
    ${REG.Right()}
    ${REG.Right()}
    ${REG.ZerShort()}
    ${REG.Right()}
    ${REG.IncShort()}
    ${REG.Left()}
    ${REG.Left()}
    ${REG.Left()}
    ZER ${STACK2}
  END
  POP ${STACK2}
  ${REG.Left()}`
)}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.CpyShort(REG.Left() + REG.Left(), REG.Right() + REG.Right())}
${REG.ZerShort()}
${REG.Right()}
${REG.CpyShort(
  REG.Left() + REG.Left() + REG.Left() + REG.Left(),
  REG.Right() + REG.Right() + REG.Right() + REG.Right()
)}
${REG.ZerShort()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function DIVBA() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.CpyShort(REG.Left(), REG.Right())}
${REG.Right()}
${WHILESHORT(
  REG,
  `${REG.DecShort()}
  ${REG.Right()}
  ${REG.Right()}
  ${REG.IncShort()}
  ${REG.Left()}
  ${REG.Left()}
  ${REG.Left()}
  ${REG.DecShort()}
  PUT ${STACK2} 1
  ${IFSHORT(REG, `ZER ${STACK2}`)}
  WHL ${STACK2}
    ${REG.Left()}
    ${REG.CpyShort(REG.Right(), REG.Left())}
    ${REG.Right()}
    ${REG.Right()}
    ${REG.Right()}
    ${REG.Right()}
    ${REG.ZerShort()}
    ${REG.Right()}
    ${REG.IncShort()}
    ${REG.Left()}
    ${REG.Left()}
    ${REG.Left()}
    ${REG.Left()}
    ZER ${STACK2}
  END
  POP ${STACK2}
  ${REG.Right()}`
)}
${REG.Right()}
${REG.Right()}
${REG.CpyShort(
  REG.Left() + REG.Left() + REG.Left(),
  REG.Right() + REG.Right() + REG.Right()
)}
${REG.ZerShort()}
${REG.Right()}
${REG.CpyShort(
  REG.Left() + REG.Left() + REG.Left(),
  REG.Right() + REG.Right() + REG.Right()
)}
${REG.ZerShort()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function NOTA() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
PUT ${STACK2} 1
${IFSHORT(REG, `ZER ${STACK2}`)}
${REG.ZerShort()}
ADD ${STACK2} ${REG.LeftStack}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
`;
}
function NOTB() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
PUT ${STACK2} 1
${IFSHORT(REG, `ZER ${STACK2}`)}
${REG.ZerShort()}
ADD ${STACK2} ${REG.LeftStack}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
`;
}
function READA() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
POP ${REG.LeftStack}
INP ${REG.LeftStack}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function READB() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
POP ${REG.LeftStack}
INP ${REG.LeftStack}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function WRITEA() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
OUT ${REG.LeftStack}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function WRITEB() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
OUT ${REG.LeftStack}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function CMP() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
PUT ${STACK2} 1
PUT ${STACK2} 254
${IFSHORT(REG, `INC ${STACK2}`)}
${REG.Right()}
${IFSHORT(REG, `INC ${STACK2}`)}
WHL ${STACK2}
  POP ${STACK2}
  ZER ${STACK2}
  PUT ${STACK2} 0
END
POP ${STACK2}
WHL ${STACK2}
  POP ${STACK2}
  ${REG.DecShort()}
  ${REG.Left()}
  ${REG.DecShort()}
  PUT ${STACK2} 1
  PUT ${STACK2} 254
  ${IFSHORT(REG, `INC ${STACK2}`)}
  ${REG.Right()}
  ${IFSHORT(REG, `INC ${STACK2}`)}
  WHL ${STACK2}
    POP ${STACK2}
    ZER ${STACK2}
    PUT ${STACK2} 0
  END
  POP ${STACK2}
END
POP ${STACK2}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function APUSH() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
CPY ${REG.LeftStack} ${STACK1}
CPY ${REG.RightStack} ${STACK1}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function APUSHA() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
CPY ${REG.LeftStack} ${STACK1}
CPY ${REG.RightStack} ${STACK1}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function APUSHB() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
CPY ${REG.LeftStack} ${STACK1}
CPY ${REG.RightStack} ${STACK1}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function BPUSH() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
CPY ${REG.LeftStack} ${STACK2}
CPY ${REG.RightStack} ${STACK2}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function BPUSHA() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
CPY ${REG.LeftStack} ${STACK2}
CPY ${REG.RightStack} ${STACK2}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function BPUSHB() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
CPY ${REG.LeftStack} ${STACK2}
CPY ${REG.RightStack} ${STACK2}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function APOP() {
  return `POP ${STACK1}
POP ${STACK1}`;
}
function APOPA() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
POP ${REG.LeftStack}
POP ${REG.RightStack}
MOV ${STACK1} ${REG.RightStack}
MOV ${STACK1} ${REG.LeftStack} 
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function APOPB() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
POP ${REG.LeftStack}
POP ${REG.RightStack}
MOV ${STACK1} ${REG.RightStack}
MOV ${STACK1} ${REG.LeftStack} 
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function BPOP() {
  return `POP ${STACK2}
POP ${STACK2}`;
}
function BPOPA() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
POP ${REG.LeftStack}
POP ${REG.RightStack}
MOV ${STACK2} ${REG.RightStack}
MOV ${STACK2} ${REG.LeftStack} 
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}
function BPOPB() {
  return `${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
POP ${REG.LeftStack}
POP ${REG.RightStack}
MOV ${STACK2} ${REG.RightStack}
MOV ${STACK2} ${REG.LeftStack} 
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}`;
}

export let INSTRUCTIONS: [string, string, Function][] = [
  ["NOP", "", (interp: ASMInterpreter, arg: number) => {}],
  [
    "HALT",
    HALT(),
    (interp: ASMInterpreter, arg: number) => {
      interp.running = false;
    },
  ],
  [
    "SETA",
    SETA(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA = arg;
    },
  ],
  [
    "SETB",
    SETB(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB = arg;
    },
  ],
  [
    "CPYAB",
    CPYAB(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB = interp.RegA;
    },
  ],
  [
    "CPYBA",
    CPYBA(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA = interp.RegB;
    },
  ],
  [
    "PTRA",
    PTRA(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA = interp.Heap[interp.RegA] ?? 0;
    },
  ],
  [
    "PTRB",
    PTRB(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB = interp.Heap[interp.RegB] ?? 0;
    },
  ],
  [
    "PUTBPTRA",
    PUTBPTRA(),
    (interp: ASMInterpreter, arg: number) => {
      interp.Heap[interp.RegA] = interp.RegB;
    },
  ],
  [
    "PUTAPTRB",
    PUTAPTRB(),
    (interp: ASMInterpreter, arg: number) => {
      interp.Heap[interp.RegB] = interp.RegA;
    },
  ],
  [
    "JMP",
    JMP(),
    (interp: ASMInterpreter, arg: number) => {
      interp.IP = arg;
    },
  ],
  [
    "JMPA",
    JMPA(),
    (interp: ASMInterpreter, arg: number) => {
      interp.IP = interp.RegA;
    },
  ],
  [
    "JMPB",
    JMPB(),
    (interp: ASMInterpreter, arg: number) => {
      interp.IP = interp.RegB;
    },
  ],
  [
    "JNZA",
    JNZA(),
    (interp: ASMInterpreter, arg: number) => {
      if (interp.RegA) interp.IP = arg;
    },
  ],
  [
    "JNZB",
    JNZB(),
    (interp: ASMInterpreter, arg: number) => {
      if (interp.RegB) interp.IP = arg;
    },
  ],
  [
    "JBNZA",
    JBNZA(),
    (interp: ASMInterpreter, arg: number) => {
      if (interp.RegA) interp.IP = interp.RegB;
    },
  ],
  [
    "JANZB",
    JANZB(),
    (interp: ASMInterpreter, arg: number) => {
      if (interp.RegB) interp.IP = interp.RegA;
    },
  ],
  [
    "CALL",
    CALL(),
    (interp: ASMInterpreter, arg: number) => {
      interp.StackB.push(interp.IP);
      interp.StackB.push(interp.RegB);
      interp.StackB.push(interp.RegA);
      interp.IP = arg;
    },
  ],
  [
    "CALLA",
    CALLA(),
    (interp: ASMInterpreter, arg: number) => {
      interp.StackB.push(interp.IP);
      interp.StackB.push(interp.RegB);
      interp.StackB.push(interp.RegA);
      interp.IP = interp.RegA;
    },
  ],
  [
    "CALLB",
    CALLB(),
    (interp: ASMInterpreter, arg: number) => {
      interp.StackB.push(interp.IP);
      interp.StackB.push(interp.RegB);
      interp.StackB.push(interp.RegA);
      interp.IP = interp.RegB;
    },
  ],
  [
    "RET",
    RET(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA = interp.StackB.pop() ?? 0;
      interp.RegB = interp.StackB.pop() ?? 0;
      interp.IP = interp.StackB.pop() ?? 0;
    },
  ],
  [
    "INCA",
    INCA(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA++;
      if (interp.RegA > 0xffffffff) interp.RegA = 0;
    },
  ],
  [
    "INCB",
    INCB(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB++;
      if (interp.RegB > 0xffffffff) interp.RegB = 0;
    },
  ],
  [
    "DECA",
    DECA(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA--;
      if (interp.RegA < 0) interp.RegA = 0xffffffff;
    },
  ],
  [
    "DECB",
    DECB(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB--;
      if (interp.RegB < 0) interp.RegB = 0xffffffff;
    },
  ],
  [
    "ADDA",
    ADDA(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA += arg;
      interp.RegA &= 0xffffffff;
      interp.RegA >>>= 0;
    },
  ],
  [
    "ADDB",
    ADDB(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB += arg;
      interp.RegB &= 0xffffffff;
      interp.RegB >>>= 0;
    },
  ],
  [
    "ADDAB",
    ADDAB(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB += interp.RegA;
      interp.RegB &= 0xffffffff;
      interp.RegB >>>= 0;
      interp.RegA = 0;
    },
  ],
  [
    "ADDBA",
    ADDBA(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA += interp.RegB;
      interp.RegA &= 0xffffffff;
      interp.RegA >>>= 0;
      interp.RegB = 0;
    },
  ],
  [
    "SUBA",
    SUBA(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA -= arg;
      interp.RegA &= 0xffffffff;
      interp.RegA >>>= 0;
    },
  ],
  [
    "SUBB",
    SUBB(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB -= arg;
      interp.RegB &= 0xffffffff;
      interp.RegB >>>= 0;
    },
  ],
  [
    "SUBAB",
    SUBAB(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB -= interp.RegA;
      interp.RegB &= 0xffffffff;
      interp.RegB >>>= 0;
      interp.RegA = 0;
    },
  ],
  [
    "SUBBA",
    SUBBA(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA -= interp.RegB;
      interp.RegA &= 0xffffffff;
      interp.RegA >>>= 0;
      interp.RegB = 0;
    },
  ],
  [
    "MULAB",
    MULAB(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB *= interp.RegA;
      interp.RegB &= 0xffffffff;
      interp.RegB >>>= 0;
      interp.RegA = 0;
    },
  ],
  [
    "MULBA",
    MULBA(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA *= interp.RegB;
      interp.RegA &= 0xffffffff;
      interp.RegA >>>= 0;
      interp.RegB = 0;
    },
  ],
  [
    "DIVAB",
    DIVAB(),
    (interp: ASMInterpreter, arg: number) => {
      if (interp.RegB === 0) {
        interp.RegA = 0;
        interp.RegB = 0;
      } else {
        let quotient = Math.floor(interp.RegA / interp.RegB);
        let remainder = interp.RegA % interp.RegB;
        interp.RegB = remainder;
        interp.RegA = quotient;
      }
    },
  ],
  [
    "DIVBA",
    DIVBA(),
    (interp: ASMInterpreter, arg: number) => {
      if (interp.RegA === 0) {
        interp.RegA = 0;
        interp.RegB = 0;
      } else {
        let quotient = Math.floor(interp.RegB / interp.RegA);
        let remainder = interp.RegB % interp.RegA;
        interp.RegA = remainder;
        interp.RegB = quotient;
      }
    },
  ],
  [
    "NOTA",
    NOTA(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA = interp.RegA ? 0 : 1;
    },
  ],
  [
    "NOTB",
    NOTB(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB = interp.RegB ? 0 : 1;
    },
  ],
  [
    "READA",
    READA(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA = interp.Input.charCodeAt(interp.InputPointer++);
      if (interp.InputPointer > interp.Input.length) interp.RegA = 0;
    },
  ],
  [
    "READB",
    READB(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB = interp.Input.charCodeAt(interp.InputPointer++);
      if (interp.InputPointer > interp.Input.length) interp.RegB = 0;
    },
  ],
  [
    "WRITEA",
    WRITEA(),
    (interp: ASMInterpreter, arg: number) => {
      interp.Output += String.fromCharCode(interp.RegA);
    },
  ],
  [
    "WRITEB",
    WRITEB(),
    (interp: ASMInterpreter, arg: number) => {
      interp.Output += String.fromCharCode(interp.RegB);
    },
  ],
  [
    "CMP",
    CMP(),
    (interp: ASMInterpreter, arg: number) => {
      if (interp.RegA > interp.RegB) {
        interp.RegA -= interp.RegB;
        interp.RegB = 0;
      } else if (interp.RegA < interp.RegB) {
        interp.RegB -= interp.RegA;
        interp.RegA = 0;
      } else {
        interp.RegA = 0;
        interp.RegB = 0;
      }
    },
  ],
  [
    "APUSH",
    APUSH(),
    (interp: ASMInterpreter, arg: number) => {
      interp.StackA.push(arg);
    },
  ],
  [
    "BPUSH",
    BPUSH(),
    (interp: ASMInterpreter, arg: number) => {
      interp.StackB.push(arg);
    },
  ],
  [
    "APUSHA",
    APUSHA(),
    (interp: ASMInterpreter, arg: number) => {
      interp.StackA.push(interp.RegA);
    },
  ],
  [
    "APUSHB",
    APUSHB(),
    (interp: ASMInterpreter, arg: number) => {
      interp.StackA.push(interp.RegB);
    },
  ],
  [
    "BPUSHA",
    BPUSHA(),
    (interp: ASMInterpreter, arg: number) => {
      interp.StackB.push(interp.RegA);
    },
  ],
  [
    "BPUSHB",
    BPUSHB(),
    (interp: ASMInterpreter, arg: number) => {
      interp.StackB.push(interp.RegB);
    },
  ],
  [
    "APOP",
    APOP(),
    (interp: ASMInterpreter, arg: number) => {
      interp.StackA.pop();
    },
  ],
  [
    "BPOP",
    BPOP(),
    (interp: ASMInterpreter, arg: number) => {
      interp.StackB.pop();
    },
  ],
  [
    "APOPA",
    APOPA(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA = interp.StackA.pop() ?? 0;
    },
  ],
  [
    "APOPB",
    APOPB(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB = interp.StackA.pop() ?? 0;
    },
  ],
  [
    "BPOPA",
    BPOPA(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegA = interp.StackB.pop() ?? 0;
    },
  ],
  [
    "BPOPB",
    BPOPB(),
    (interp: ASMInterpreter, arg: number) => {
      interp.RegB = interp.StackB.pop() ?? 0;
    },
  ],
];

// Assumes instruction is in INSTRUCTION
let DO_INSTRUCTION = function () {
  let s = `${REG.Right()}
${REG.Right()}
${REG.Right()}`;
  for (let id in INSTRUCTIONS) {
    let instr = INSTRUCTIONS[id];
    s += `
PUT ${STACK1} 1
${IF(REG.LeftStack, `ZER ${STACK1}`)}
${IF(
  STACK1,
  `${REG.Left()}
${REG.Left()}
${REG.Left()}
POP ${STACK1}
${instr[1]}
PUT ${STACK1} 0
${REG.Right()}
${REG.Right()}
${REG.Right()}`
)}
POP ${STACK1}
DEC ${REG.LeftStack}`;
  }
  s += `${REG.Left()}
${REG.Left()}
${REG.Left()}`;
  return s;
};

export let MAIN_LOOP = function () {
  return `
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
INC ${REG.LeftStack}
WHL ${REG.LeftStack}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
${REG.Left()}
CDE 0
${LOAD_INSTRUCTION()}
${DO_INSTRUCTION()}
${REG.Right()}
${REG.Right()}
${REG.IncShort()}
${REG.IncShort()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
${REG.Right()}
END
`;
};

export function ASMTranspile(code: string) {
  let oldInstrs = INSTRUCTIONS;
  let commands = code.matchAll(
    /^[ \t]*?(?:\n|$)|^\s*(?:([a-z_]\w*):)?[ \t]*(?:(?:db[ \t]*((?:(?:"[^"]*?"|0x[a-f0-9]{1,8}|\d{1,10}|'\\?.'|[a-z_]\w*),?\s*)*))|(rem\s*.*)|(?:(NOP|HALT|SETA|SETB|CPYAB|CPYBA|PTRA|PTRB|PUTBPTRA|PUTAPTRB|JMP|JMPA|JMPB|JNZA|JNZB|JBNZA|JANZB|CALL|CALLA|CALLB|RET|INCA|INCB|DECA|DECB|ADDA|ADDB|ADDAB|ADDBA|SUBA|SUBB|SUBAB|SUBBA|MULAB|MULBA|DIVAB|DIVBA|NOTA|NOTB|READA|READB|WRITEA|WRITEB|CMP|APUSH|APUSHA|APUSHB|BPUSH|BPUSHA|BPUSHB|APOP|BPOP|APOPA|APOPB|BPOPA|BPOPB)(?:[ \t]+(?:(\d{0,10})|([a-z_]\w*)|('\\?.')|(0x[a-f0-9]{1,8})))?))?$/gim
  );
  let usedInstructions: string[] = [];
  for (let c of commands) {
    let command = c[4] ?? "";
    if (command.length > 0 && !usedInstructions.includes(command)) {
      usedInstructions.push(command);
    }
  }
  INSTRUCTIONS = [];
  for (let i = 0; i < oldInstrs.length; i++) {
    let old = oldInstrs[i];
    INSTRUCTIONS[i] = [old[0], "", old[2]];
  }

  commands = code.matchAll(
    /^[ \t]*?(?:\n|$)|^\s*(?:([a-z_]\w*):)?[ \t]*(?:(?:db[ \t]*((?:(?:"[^"]*?"|0x[a-f0-9]{1,8}|\d{1,10}|'\\?.'|[a-z_]\w*),?\s*)*))|(rem\s*.*)|(?:(NOP|HALT|SETA|SETB|CPYAB|CPYBA|PTRA|PTRB|PUTBPTRA|PUTAPTRB|JMP|JMPA|JMPB|JNZA|JNZB|JBNZA|JANZB|CALL|CALLA|CALLB|RET|INCA|INCB|DECA|DECB|ADDA|ADDB|ADDAB|ADDBA|SUBA|SUBB|SUBAB|SUBBA|MULAB|MULBA|DIVAB|DIVBA|NOTA|NOTB|READA|READB|WRITEA|WRITEB|CMP|APUSH|APUSHA|APUSHB|BPUSH|BPUSHA|BPUSHB|APOP|BPOP|APOPA|APOPB|BPOPA|BPOPB)(?:[ \t]+(?:(\d{0,10})|([a-z_]\w*)|('\\?.')|(0x[a-f0-9]{1,8})))?))?$/gim
  );
  let heap: number[] = [];
  let labels: { [label: string]: number } = {};
  let waitingLabels: any = {};
  let ptr = 0;
  for (let c of commands) {
    let label = c[1] ?? "";
    let dbArgs = c[2] ?? "";
    let command = c[4] ?? "";
    let argNumber = c[5] ?? "";
    let argLabel = c[6] ?? "";
    let argChar = c[7] ?? "";
    let argHex = c[8] ?? "";

    if (label.length > 0) {
      let l = Math.floor(ptr / 2);
      labels[label] = l;
      if (waitingLabels[label]) {
        waitingLabels[label].forEach((i: number) => {
          heap[i] = l & 255;
          heap[i + 1] = (l >> 8) & 255;
        });
        delete waitingLabels[label];
      }
    }

    if (dbArgs.length > 0) {
      let parsedArgs = dbArgs.matchAll(
        /(?:(?:"([^"]*?)"|(0x[a-f0-9]{1,8})|(\d{1,10})|('\\?.')|([a-z_]\w*)),?\s*)/gim
      );
      for (let a of parsedArgs) {
        let stringBody = a[1] ?? "";
        let hexBody = a[2] ?? "";
        let numberBody = a[3] ?? "";
        let charBody = a[4] ?? "";
        let labelBody = a[5] ?? "";
        if (numberBody.length > 0) {
          let v = +numberBody;
          heap[ptr++] = v & 255;
          heap[ptr++] = (v >> 8) & 255;
        } else if (hexBody.length > 2) {
          let v = +hexBody;
          heap[ptr++] = v & 255;
          heap[ptr++] = (v >> 8) & 255;
        } else if (charBody.length > 2) {
          let v = 0;
          if (charBody === "'\"'") {
            v = 32;
          } else {
            v = JSON.parse(charBody.replace(/'(\\?.)'/, '"$1"')).charCodeAt(0);
          }
          heap[ptr++] = v & 255;
          heap[ptr++] = (v >> 8) & 255;
        } else if (labelBody.length > 0) {
          if (labels[labelBody]) {
            let v = labels[labelBody];
            heap[ptr++] = v & 255;
            heap[ptr++] = (v >> 8) & 255;
          } else {
            if (!waitingLabels[labelBody]) waitingLabels[labelBody] = [];
            waitingLabels[labelBody].push(ptr);
            ptr += 2;
          }
        } else {
          for (let i = 0; i < stringBody.length; i++) {
            heap[ptr++] = stringBody.charCodeAt(i);
            heap[ptr++] = 0;
          }
        }
      }
    } else if (command.length > 0) {
      let commandIndex = INSTRUCTIONS.findIndex(
        (i) => i[0] === command.toUpperCase()
      );
      if (commandIndex < 0) {
        console.log(`UNKNOWN COMMAND: ${command}`);
      }
      heap[ptr++] = commandIndex;
      heap[ptr++] = 0;
      let argV = 0;
      if (argNumber.length > 0) argV = +argNumber;
      else if (argHex.length > 2) argV = +argHex;
      else if (argChar.length > 2) {
        if (argChar === "'\"'") {
          argV = 32;
        } else {
          argV = JSON.parse(argChar.replace(/'(\\?.)'/, '"$1"')).charCodeAt(0);
        }
      } else if (argLabel.length > 0) {
        if (argLabel.toUpperCase() === "_IP")
          labels[argLabel] = Math.floor(ptr / 2);
        if (labels[argLabel] !== undefined) {
          argV = labels[argLabel];
        } else {
          if (waitingLabels[argLabel] === undefined)
            waitingLabels[argLabel] = [];
          waitingLabels[argLabel].push(ptr);
        }
      }
      heap[ptr++] = argV & 255;
      heap[ptr++] = (argV >> 8) & 255;
    }
  }

  for (let name in waitingLabels) {
    console.log("MISSING LABEL: " + name);
  }

  let s = "";
  for (let i = ptr - 1; i >= 0; i--) {
    if (i > 0) s += `PUT ${HEAP.RightStack} ${heap[i]}\n`;
    else s += `INC ${HEAP.LeftStack} ${heap[0]}`;
  }
  s += MAIN_LOOP();
  INSTRUCTIONS = oldInstrs;
  return s;
}

function hexPad(value: number, amount: number = 2) {
  return ("0".repeat(amount) + value.toString(16).toUpperCase()).slice(-amount);
}

export class ASMInterpreter {
  Code: string;
  Heap: number[] = [];
  IP: number = 0;
  RegA: number = 0;
  RegB: number = 0;
  StackA: number[] = [];
  StackB: number[] = [];
  running: boolean = true;
  Input: string = "";
  InputPointer: number = 0;
  Output: string = "";
  Labels: { [label: string]: number } = {};
  ASMMap: number[] = [];
  CodeLines: string[] = [];

  constructor(code: string | string[]) {
    if (typeof code === "string") {
      this.Code = code;
      let t = Date.now();
      let commands = code.matchAll(
        /^[ \t]*?(?:\n|$)|^\s*(?:([a-z_]\w*):)?[ \t]*(?:(?:db[ \t]*((?:(?:"[^"]*?"|0x[a-f0-9]{1,8}|\d{1,10}|'\\?.'|[a-z_]\w*),?\s*)*))|(rem\s*.*)|(?:(NOP|HALT|SETA|SETB|CPYAB|CPYBA|PTRA|PTRB|PUTBPTRA|PUTAPTRB|JMP|JMPA|JMPB|JNZA|JNZB|JBNZA|JANZB|CALL|CALLA|CALLB|RET|INCA|INCB|DECA|DECB|ADDA|ADDB|ADDAB|ADDBA|SUBA|SUBB|SUBAB|SUBBA|MULAB|MULBA|DIVAB|DIVBA|NOTA|NOTB|READA|READB|WRITEA|WRITEB|CMP|APUSH|APUSHA|APUSHB|BPUSH|BPUSHA|BPUSHB|APOP|BPOP|APOPA|APOPB|BPOPA|BPOPB)(?:[ \t]+(?:(\d{0,10})|([a-z_]\w*)|('\\?.')|(0x[a-f0-9]{1,8})))?))?$/gim
      );

      let heap: number[] = [];
      let labels: any = {};
      let waitingLabels: any = {};
      let commandTimes: number[] = [];
      let ptr = 0;
      for (let c of commands) {
        let commandT = Date.now();
        let label = c[1] ?? "";
        let dbArgs = c[2] ?? "";
        let command = c[4] ?? "";
        let argNumber = c[5] ?? "";
        let argLabel = c[6] ?? "";
        let argChar = c[7] ?? "";
        let argHex = c[8] ?? "";

        if (label.length > 0) {
          let l = ptr;
          labels[label] = l;
          if (waitingLabels[label]) {
            waitingLabels[label].forEach((i: number) => {
              heap[i] = (l & 0xffffffff) >>> 0;
            });
            delete waitingLabels[label];
          }
        }

        if (dbArgs.length > 0) {
          let parsedArgs = dbArgs.matchAll(
            /(?:(?:"([^"]*?)"|(0x[a-f0-9]{1,8})|(\d{1,10})|('\\?.')|([a-z_]\w*)),?\s*)/gim
          );
          for (let a of parsedArgs) {
            let stringBody = a[1] ?? "";
            let hexBody = a[2] ?? "";
            let numberBody = a[3] ?? "";
            let charBody = a[4] ?? "";
            let labelBody = a[5] ?? "";
            if (numberBody.length > 0) {
              heap[ptr++] = +numberBody;
            } else if (hexBody.length > 2) {
              let v = +hexBody;
              heap[ptr++] = v;
            } else if (charBody.length > 2) {
              let v = 0;
              if (charBody === "'\"'") {
                v = 32;
              } else {
                v = JSON.parse(charBody.replace(/'(\\?.)'/, '"$1"')).charCodeAt(
                  0
                );
              }
              heap[ptr++] = v;
            } else if (labelBody.length > 0) {
              if (labels[labelBody] !== undefined) {
                heap[ptr++] = labels[labelBody];
              } else {
                if (waitingLabels[labelBody] === undefined)
                  waitingLabels[labelBody] = [];
                waitingLabels[labelBody].push(ptr);
                ptr++;
              }
            } else {
              for (let i = 0; i < stringBody.length; i++) {
                heap[ptr++] = stringBody.charCodeAt(i);
              }
            }
          }
        } else if (command.length > 0) {
          let commandIndex = INSTRUCTIONS.findIndex(
            (i) => i[0] === command.toUpperCase()
          );
          if (commandIndex < 0) {
            console.log(`UNKNOWN COMMAND: ${command}`);
          }
          heap[ptr++] = commandIndex;
          let argV = 0;
          if (argNumber.length > 0) argV = +argNumber;
          else if (argHex.length > 2) argV = +argHex;
          else if (argChar.length > 2) {
            if (argChar === "'\"'") {
              argV = 32;
            } else {
              argV = JSON.parse(argChar.replace(/'(\\?.)'/, '"$1"')).charCodeAt(
                0
              );
            }
          } else if (argLabel.length > 0) {
            if (argLabel.toUpperCase() === "_IP") labels[argLabel] = ptr;
            if (labels[argLabel] !== undefined) {
              argV = labels[argLabel];
            } else {
              if (waitingLabels[argLabel] === undefined)
                waitingLabels[argLabel] = [];
              waitingLabels[argLabel].push(ptr);
            }
          }
          heap[ptr++] = (argV & 0xffffffff) >>> 0;
        }
        commandTimes.push(Date.now() - commandT);
      }
      console.log("Command Times: ");
      console.dir(commandTimes);
      console.log(`Total Time: ${Date.now() - t}ms`);
      for (let name in waitingLabels) {
        console.log("MISSING LABEL: " + name);
      }

      this.Heap = heap;
    } else {
      let t = Date.now();
      this.Code = code.join("\n");
      let heap: number[] = [];
      let labels: any = {};
      let waitingLabels: any = {};
      let commandTimes: number[] = [];
      let ptr = 0;

      for (let i = 0; i < code.length; i++) {
        this.ASMMap[ptr] = i;
        if (code[i].match(/^\s*LINE/i)) continue;

        if (code[i].match(/^\s*FILE/i)) continue;
        let codel = code[i].match(
          /^\s*?(?:\n|$)|^\s*(?:([a-z_]\w*):)?\s*(?:(?:db\s*((?:(?:\d+|[a-z_]\w*),?\s*)*))|(?:(NOP|HALT|SETA|SETB|CPYAB|CPYBA|PTRA|PTRB|PUTBPTRA|PUTAPTRB|JMP|JMPA|JMPB|JNZA|JNZB|JBNZA|JANZB|CALL|CALLA|CALLB|RET|INCA|INCB|DECA|DECB|ADDA|ADDB|ADDAB|ADDBA|SUBA|SUBB|SUBAB|SUBBA|MULAB|MULBA|DIVAB|DIVBA|NOTA|NOTB|READA|READB|WRITEA|WRITEB|CMP|APUSH|APUSHA|APUSHB|BPUSH|BPUSHA|BPUSHB|APOP|BPOP|APOPA|APOPB|BPOPA|BPOPB)(?:\s+(?:(\d+)|([a-z_]\w*)))?))?\s*$/im
        );
        if (!codel) {
          console.log(`No match: ${code[i]}`);
          continue;
        }
        let label = codel[1] ?? "";
        let dbArgs = codel[2] ?? "";
        let command = codel[3] ?? "";
        let argNumber = codel[4] ?? "";
        let argLabel = codel[5] ?? "";

        let commandT = Date.now();

        if (label) {
          let l = ptr;
          labels[label] = l;
          if (waitingLabels[label]) {
            waitingLabels[label].forEach((i: number) => {
              heap[i] = (l & 0xffffffff) >>> 0;
            });
            delete waitingLabels[label];
          }
        }
        if (dbArgs.length > 0) {
          let argVals = dbArgs.matchAll(/(\d+)|([a-z_]\w*)/gi);
          for (let argVal of argVals) {
            let argNum = argVal[1] ?? "";
            let argLab = argVal[2] ?? "";
            if (argNum.length > 0) {
              heap[ptr++] = +argNum;
            } else if (argLab.length > 0) {
              if (labels[argLab] !== undefined) {
                heap[ptr++] = labels[argLab];
              } else {
                if (waitingLabels[argLab] === undefined)
                  waitingLabels[argLab] = [];
                waitingLabels[argLab].push(ptr);
                ptr++;
              }
            }
          }
        } else if (command.length > 0) {
          let commandIndex = INSTRUCTIONS.findIndex(
            (i) => i[0] === command.toUpperCase()
          );
          if (commandIndex < 0) {
            console.log(`UNKNOWN COMMAND: ${command}`);
          }
          heap[ptr++] = commandIndex;
          let argV = 0;
          if (argNumber.length > 0) argV = +argNumber;
          else if (argLabel.length > 0) {
            if (argLabel.toUpperCase() === "_IP") labels[argLabel] = ptr;
            if (labels[argLabel] !== undefined) {
              argV = labels[argLabel];
            } else {
              if (waitingLabels[argLabel] === undefined)
                waitingLabels[argLabel] = [];
              waitingLabels[argLabel].push(ptr);
            }
          }
          heap[ptr++] = (argV & 0xffffffff) >>> 0;
        }
        commandTimes.push(Date.now() - commandT);
      }
      console.log("Command Times: ");
      console.dir(commandTimes);
      console.log(`Total Time: ${Date.now() - t}ms`);
      for (let name in waitingLabels) {
        console.log("MISSING LABEL: " + name);
      }
      this.Heap = heap;
      this.Labels = labels;
    }
    this.CodeLines = this.Code.split("\n");
  }

  CodeWithPointerHighlight(): string {
    var code = this.Code.split(`\n`);
    var currentInstruction = this.ASMMap[this.IP];
    if (currentInstruction)
      code[
        currentInstruction
      ] = `<span class='pointer'>${code[currentInstruction]}</span>`;
    for (let i = 0; i < code.length; i++) {
      var index = this.ASMMap.indexOf(i);
      code[i] = `${hexPad(index, 8)}: ${code[i]}`;
    }
    return code.join(`\n`);
  }

  ToMeta(): MetaInterpreter {
    let interp = new MetaInterpreter(ASMTranspile(this.Code));
    interp.CodePointer = interp.Code.findIndex((c) => c[0] === "CDE");

    // Rebuild the WhileStack
    for (let i = 0; i < interp.CodePointer; i++) {
      let codel = interp.Code[i];
      if (codel[0] === "WHL") {
        let args = Array.from(codel[1].matchAll(/(?:,?\s*([A-F]|\d+|'.'))/g))
          .map((c) => c[1])
          .map((c) =>
            c[0] === "'" ? c.charCodeAt(1) : c.match(/\d/) ? +c : c
          );
        let a: number = GetStackIndex(args[0]);
        interp.WhileStack.push([i, a]);
      } else if (codel[0] === "END") {
        interp.WhileStack.pop();
      }
    }

    interp.Input = this.Input;
    interp.InputPointer = this.InputPointer;
    interp.Output = this.Output;
    interp.LastStack = 0;

    // Rebuild registeries
    // Halt
    interp.Stacks[1].push(0);
    interp.Stacks[1].push(this.running ? 1 : 0);
    // RegB
    interp.Stacks[1].push((this.RegB >> 8) & 255);
    interp.Stacks[1].push(this.RegB & 255);
    // RegA
    interp.Stacks[1].push((this.RegA >> 8) & 255);
    interp.Stacks[1].push(this.RegA & 255);
    // Instruction arg
    interp.Stacks[1].push(0);
    interp.Stacks[1].push(0);
    // Loaded instruction
    interp.Stacks[1].push(0);
    interp.Stacks[1].push(0);
    // Instruction Pointer
    interp.Stacks[1].push((this.IP >> 8) & 255);
    interp.Stacks[1].push(this.IP & 255);
    // Heap Target
    interp.Stacks[1].push(0);
    interp.Stacks[1].push(0);
    // Heap Pointer
    interp.Stacks[1].push(0);
    interp.Stacks[0].push(0);

    // Rebuild Heap
    let maxHeap = 0;
    this.Heap.forEach((c, i) => {
      maxHeap = Math.max(maxHeap, i);
    });
    for (let i = maxHeap; i >= 0; i--) {
      interp.Stacks[3].push(((this.Heap[i] ?? 0) >> 8) & 255);
      interp.Stacks[i > 0 ? 3 : 2].push((this.Heap[i] ?? 0) & 255);
    }
    return interp;
  }

  Step() {
    if (!this.running) return;
    let command = this.Heap[this.IP];
    let arg = this.Heap[this.IP + 1];
    this.IP += 2;
    var instructionFunction = INSTRUCTIONS[command];
    if (instructionFunction) instructionFunction[2](this, arg);
    else {
      this.running = false;
      throw new Error(`Unknown instruction ${command}`);
    }
  }

  RenderBFMemory() {
    return this.ToMeta().RenderBFMemory();
  }

  RenderBFBMMemory() {
    return this.ToMeta().RenderBFBMMemory();
  }

  RenderHeap(): string {
    let heap =
      "                 0        1        2        3        4        5        6        7        8        9        A        B        C        D        E        F\n";
    for (let i = 0; i < this.Heap.length; i += 16) {
      heap += `${hexPad(i, 8)}: `;
      for (let j = 0; j < 16; j++) {
        if (this.Heap[i + j] !== undefined) {
          if (this.IP === i + j || (j === 0 && this.IP + 1 === i + j))
            heap += "<span class='pointer'>";
          heap += `${hexPad(this.Heap[i + j], 8)}`;
          if (this.IP + 1 === i + j || (this.IP === i + j && j === 15))
            heap += "</span>";
          heap += " ";
        } else heap += `         `;
      }
      heap += `| `;
      for (let j = 0; j < 16; j++) {
        var char: string = " ";
        if (this.Heap[i + j] !== undefined) {
          let v = this.Heap[i + j];
          if (v >= 32 && v < 127) {
            char = String.fromCharCode(v);
          } else {
            char = ".";
          }
        }
        heap += char;
      }
      heap += "\n";
    }
    return `Heap:<br><div id='heap'>${heap}</div>`;
  }

  RenderBSMemory() {
    let instructionPtr = this.IP;
    let regA = this.RegA;
    let regB = this.RegB;

    let stack1 = "";
    let stack2 = "";
    for (let i = 0; i < this.StackA.length; i++)
      stack1 += hexPad(this.StackA[i], 8) + " ";
    for (let i = 0; i < this.StackB.length; i++)
      stack2 += hexPad(this.StackB[i], 8) + " ";

    let body = `File: <span class='reg'>${this.GetFile()}</span><br>
Line: <span class='reg'>${this.GetLine() + 1}</span><br>
Instruction PTR: <span class='reg'>${hexPad(instructionPtr, 4)}</span><br>
Instruction: <span class='reg'>${hexPad(this.Heap[instructionPtr] ?? 0)} ${
      INSTRUCTIONS[this.Heap[instructionPtr] ?? 0]?.[0] ?? "????"
    } ${hexPad(this.Heap[instructionPtr + 1] ?? 0, 8)}</span><br>
Register A: <span class='reg'>${hexPad(regA, 8)}</span><br>
Register B: <span class='reg'>${hexPad(regB, 8)}</span><br><br>
Stack1: <span class='reg'>${stack1}</span><br>
Stack2: <span class='reg'>${stack2}</span><br>`;
    document.querySelector('div.tab[data-target="baMemory"]')!.innerHTML = body;
  }

  GetLineFrom(IP: number): number {
    var codel = this.ASMMap[IP];
    while (codel >= 0) {
      let m = this.CodeLines[codel].match(/\bline\s*(\d+)/i);
      if (m) {
        return +m[1];
      }
      codel--;
    }
    return 0;
  }
  GetFileFroM(IP: number): string {
    var codel = this.ASMMap[IP];
    while (codel >= 0) {
      let m = this.CodeLines[codel].match(/\bfile\s*(.+)/i);
      if (m) {
        return m[1];
      }
      codel--;
    }
    return "main.bc";
  }
  GetLine(): number {
    return this.GetLineFrom(this.IP);
  }
  GetFile(): string {
    return this.GetFileFroM(this.IP);
  }

  RenderMemory(style: string) {
    switch (style) {
      case "bfMemory":
        this.RenderBFMemory();
        break;
      case "bfbmMemory":
        this.RenderBFBMMemory();
        break;
      case "baMemory":
        this.RenderBSMemory();
        break;
    }
  }
}
