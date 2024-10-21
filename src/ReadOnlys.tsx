import { GenerateReadOnly } from "./App";
var generated = false;
export function GenerateReadOnlys() {
  if (generated) return;
  generated = true;
  GenerateReadOnly(
    "array.bc",
    `metamethod getindex<T>(Array<T> this, int i) -> T{
    return *(this.Data+i%this.Length);
}
metamethod setindex<T>(Array<T> this, int i, T v){
    *(this.Data+i%this.Length) = v;
}
metamethod ptrindex<T>(Array<T> this, int i) -> @T{
    return this.Data+i%this.Length;
}

class Array<T> {
    new(int l){
        this.Data = alloc(l);
        this.Length = l;
    }
    int Length;
    @T Data;
    virtual function ReplaceV(func(T)->T over){
        int i = 0;
        while(i < this.Length){
            this[i] = over(this[i]);
            i++;
        }
    }
    virtual function ReplaceK(func(int)->T over){
        int i = 0; 
        while(i < this.Length){
            this[i] = over(i);
            i++;
        }
    }
    virtual function ReplaceKV(func(int,T)->T over){
        int i = 0;
        while(i < this.Length){
            this[i] = over(i, this[i]);
            i++;
        }
    }
}`
  );
  GenerateReadOnly(
    "extmacros.bc",
    `macro ( (assignable) (/(\\*\\*|[*\\/+~-])/) "=" (expression) ) { $1 = $1 $2 $3 }
macro ( 'for' "(" (expression?) ";" (expression?) ";" (expression?) ")" (expression) ) {
    {
        $1;
        while($2){
            $4;
            $3;
        }
    }
}
`
  );
  GenerateReadOnly(
    "float.bc",
    `metamethod get_sign(float this) -> int (this -> int) / 0x80000000;
metamethod get_exponent(float this) -> int ((this -> int) / 0x800000) % 0x100;
metamethod get_mantissa(float this) -> int (this -> int) % 0x800000;

const int bias = 127+23;
metamethod get_integer(float this) -> int {
    int mantissa = this.mantissa + 0x800000;
    int exponent = this.exponent;
    if(exponent == 0xFF){ // MAXINT, Can be NaN but hecc NaN
        return  if (this.sign)
                    0x80000000
                else
                    0x7fffffff;
    }
    while(exponent < bias){
        exponent ++;
        mantissa = mantissa / 2;
    }
    while(exponent > bias){
        exponent --;
        mantissa = mantissa * 2;
    }
    if(this.sign == 1){
        mantissa = 0-mantissa;
    }
    return mantissa;
}

metamethod get_float(int this) -> float {
    int sign = 0;
    if (this > 0x7fffffff) {
        sign = 1;
        this = 0-this;
    }
    int mantissa = this;
    int exponent = bias;
    while(mantissa >= 0x1000000){
        exponent ++;
        mantissa = mantissa / 2;
    }
    while(mantissa < 0x800000){
        exponent --;
        mantissa = mantissa * 2;
    }
    return ((sign * 0x80000000) + (exponent * 0x800000) + (mantissa % 0x800000) -> float);
}

metamethod unm(float this) -> float {
    return this.withSign(1 - this.sign);
}

abstract class float {
    static const float one = 0x3F800000;
    static const float zero = 0;

    static function make(int sign, int exponent, int mantissa) -> float
        ((sign * 0x80000000) + (exponent * 0x800000) + mantissa -> float);
    virtual function withSign(int sign) -> float
        float.make(sign, this.exponent, this.mantissa);
    virtual function withExponent(int exponent) -> float
        float.make(this.sign, exponent, this.mantissa);
    virtual function withMantissa(int mantissa) -> float
        float.make(this.sign, this.exponent, mantissa);
    static function _sub(float this, float other) -> float {
        if(this.sign != other.sign){
            return float._add(this,-other);
        }
        if((this -> int) == 0)
            return -other;
        if((other -> int) == 0)
        // Get both mantissas with their implied 1
        int mantissaA = this.mantissa + 0x800000;
        int mantissaB = other.mantissa + 0x800000;
        // Get both exponents
        int exponentA = this.exponent;
        int exponentB = other.exponent;
        // Shift left the smaller mantissa to match the larger one
        // We don't actually have bitshift, so we have to manually multiply
        while(exponentA < exponentB){
            exponentA ++;
            mantissaA = mantissaA / 2;
        }
        while(exponentB < exponentA){
            exponentB ++;
            mantissaB = mantissaB / 2;
        }
        // Subtract the mantissas
        int mantissaC = mantissaA - mantissaB;
        // Normalize the mantissa
        while(mantissaC < 0x800000){
            exponentA --;
            mantissaC = mantissaC * 2;
        }
        // Return the result
        return float.make(this.sign, exponentA, mantissaC % 0x800000);
    }
    static function _add(float this, float other) -> float {
        if((this -> int) == 0)
            return other;
        if((other -> int) == 0)
            return this;
        if(this.sign != other.sign){
            return float._sub(this,-other);
        }
        // Get both mantissas with their implied 1
        int mantissaA = this.mantissa + 0x800000;
        int mantissaB = other.mantissa + 0x800000;
        // Get both exponents
        int exponentA = this.exponent;
        int exponentB = other.exponent;
        // Shift left the smaller mantissa to match the larger one
        // We don't actually have bitshift, so we have to manually multiply
        while(exponentA < exponentB){
            exponentA ++;
            mantissaA = mantissaA / 2;
        }
        while(exponentB < exponentA){
            exponentB ++;
            mantissaB = mantissaB / 2;
        }
        // Add the mantissas
        int mantissaC = mantissaA + mantissaB;
        // Normalize the mantissa
        while(mantissaC >= 0x1000000){
            exponentA ++;
            mantissaC = mantissaC / 2;
        }
        // Return the result
        return float.make(this.sign, exponentA, mantissaC % 0x800000);
    }
    static function _mul(float this, float other) -> float {
        if((this -> int) == 0)
            return (0 -> float);
        if((other -> int) == 0)
            return (0 -> float);
        // Get both mantissas with their implied 1
        int mantissaA = this.mantissa + 0x800000;
        int mantissaB = other.mantissa + 0x800000;
        // Get both exponents
        int exponentA = this.exponent;
        int exponentB = other.exponent;
        int exponentC = (exponentA + exponentB) - 134;
        // Multiply the mantissas
        int mantissaC = (mantissaA / 0x100) * (mantissaB / 0x100);
        // Normalize the mantissa
        while(mantissaC >= 0x1000000){
            exponentC ++;
            mantissaC = mantissaC / 2;
        }
        // Return the result
        return float.make(this.sign + other.sign, exponentC, mantissaC % 0x800000);
    }
    static function _div(float this, float other) -> float {
        if((this -> int) == 0)
            return (0 -> float);
        if((other -> int) == 0)
            return (0x7fc00000 -> float);
        // Floating point Division
        // Apparently this is just like fancy fixed-point division
        int mantissaA = this.mantissa + 0x800000;
        int mantissaB = other.mantissa + 0x800000;
        int exponentA = this.exponent;
        int exponentB = other.exponent;
        
        int mantissaC = 0;
        int div, int rem = (mantissaA * 0x100) /% mantissaB;
        mantissaC = div * 0x8000;
        div, rem = (rem * 0x100) /% mantissaB;
        mantissaC = mantissaC + (div * 0x80);
        div, rem = (rem * 0x100) /% mantissaB;
        mantissaC = mantissaC + (div / 2);
        int exponentC = (exponentA - exponentB) + 127;

        if(mantissaC == 0){
            return (0 -> float);
        }
        while(mantissaC < 0x800000){
            exponentC --;
            mantissaC = mantissaC * 2;
        }
        return float.make(this.sign + other.sign, exponentC, mantissaC % 0x800000);
    }
    static function _pow(float this, int base) -> float {
        if (base == 0) {
            return (0x3F800000 -> float);
        }
        if ((this -> int) == 0) {
            return (0x0 -> float);
        }
        // Use simple binary exponentiation
        float result = (0x3F800000 -> float);
        while (base > 0) {
            if (base % 2 == 1) {
                result = float._mul(result, this);
            }
            this = float._mul(this, this);
            base = base / 2;
        }
        return result;
    }
    static function _mod(float this, float other) -> float {
        if((this -> int) == 0)
            return (0 -> float);
        if((other -> int) == 0)
            return (0x7fc00000 -> float);
        // Get both their mantissas
        int mantissaA = this.mantissa + 0x800000;
        int mantissaB = other.mantissa + 0x800000;
        // And their exponents
        int exponentA = this.exponent;
        int exponentB = other.exponent;
        // If A has a smaller exponant than B, return A (Because it will never be bigger than B)
        if(exponentA < exponentB){
            return this;
        }
        // Shift A until it has the same exponant as B
        while(exponentA > exponentB){
            exponentA --;
            mantissaA = mantissaA * 2;
        }
        // Perform the modulo on the mantissas
        int mantissaC = mantissaA % mantissaB;
        if(mantissaC == 0){
            return (0 -> float);
        }
        // Normalize the mantissa
        while(mantissaC < 0x800000){
            exponentA --;
            mantissaC = mantissaC * 2;
        }
        // Return the result
        return float.make(this.sign, exponentA, mantissaC % 0x800000);
    }
}

metamethod sub(float this, float other) -> float
    float._sub(this, other);

metamethod add(float this, float other) -> float
    float._add(this, other);

metamethod mul(float this, float other) -> float
    float._mul(this, other);

metamethod div(float this, float other) -> float
    float._div(this, other);

metamethod pow(float this, int other) -> float
    float._pow(this, other);

metamethod mod(float this, float other) -> float
    float._mod(this, other);

macro ( '__divide_float' (number) ',' (number) ) { const {
    const int A = $1;
    const int other = $2;
    if(A == 0)
        0
    else if(other == 0)
        0x7fc00000
    else {
        const int mantissaA = (A%0x800000) + 0x800000;
        const int mantissaB = (other%0x800000) + 0x800000;
        const int exponentA = (A/0x800000)%0x100;
        const int exponentB = (other/0x800000)%0x100; 
        
        const int mantissaC = 0;
        const int div = (mantissaA * 0x100) / mantissaB;
        const int rem = (mantissaA * 0x100) % mantissaB;
        const mantissaC = div * 0x8000; 
        const div = (rem * 0x100) / mantissaB;
        const rem = (rem * 0x100) % mantissaB;
        const mantissaC = mantissaC + (div * 0x80);
        const div = (rem * 0x100) / mantissaB;
        const rem = (rem * 0x100) % mantissaB;
        const mantissaC = mantissaC + (div / 2);
        const int exponentC = (exponentA - exponentB) + 127;
    
        const if(mantissaC == 0){
            0;
        }else{
            const while(mantissaC < 0x800000){
                exponentC = exponentC - 1;
                mantissaC = mantissaC * 2;
            }
            const ((((A/0x80000000) + (other/0x80000000))%2)*0x80000000) + ((exponentC%0x100) * 0x800000) + (mantissaC % 0x800000);
        }
    }
}}

macro ( '__number_to_float' (number) ) { const {
        const int A = $1;
        const int sign = 0;
        const if (A > 0x7fffffff) {
            sign = 1;
            A = 0-A; 
        }else {0}
        const int mantissa = A;
        const int exponent = bias;
        const while(mantissa >= 0x1000000){
            exponent = exponent + 1;
            mantissa = mantissa / 2;
        };
        const while(mantissa < 0x800000){
            exponent = exponent - 1;
            mantissa = mantissa * 2; 
        };
        const (sign * 0x80000000) + (exponent * 0x800000) + (mantissa % 0x800000); 
} }

macro ( '__count_digits' /\\d/ (/\\d+/)) {1+__count_digits $1}
macro ( '__count_digits' /\\d/) {1}

macro ( '__tenth_power' (number) ) {const {
    const int t = 1;
    const int i = 1+$1;
    const while(i=i-1)t = t * 10;
    t;
}} 

macro ( (number) '.' (/\\d+/) 'f' ) { (const {
    const int divisor = (__tenth_power __count_digits $2);
    const int numerator = $1;
    numerator = (numerator * divisor) + $2;
    (__divide_float (__number_to_float numerator) , (__number_to_float divisor));
} -> float) }`
  );
  GenerateReadOnly(
    "int.bc",
    `metamethod pow(int _a, int _b) -> int {
    if(!_b)
        return 1;
    if(_b == 1)
        return _a;
    int _result = 1;
    while(_b > 0){
        if(!(_b%2)){
            _b = _b / 2;
            _a = _a * _a;
        }else{
            _b = _b - 1
            _result = _result * _a;
            _b = _b / 2;
            _a = _a * _a
        }
    }
    return _result;
}
metamethod bshl(int _a, int _b) -> int {
    return _a * (2 ^ _b);
}
metamethod bshr(int _a, int _b) -> int {
    return _a / (2 ^ _b);
}
metamethod band(int _a, int _b) -> int {
    int _o = 0;
    int _i = 1;
    while (_i){
        _o = _o + ((_a%2)*(_b%2))*_i;
        _i = _i * 2;
        _a = _a / 2;
        _b = _b / 2;
    }
    return _o;
}
metamethod bor(int _a, int _b) -> int {
    int _o = 0;
    int _i = 1;
    while (_i){
        _o = _o + !(!(_a%2)*!(_b%2))*_i;
        _i = _i * 2;
        _a = _a / 2;
        _b = _b / 2;
    }
    return _o;
}
metamethod bxor(int _a, int _b) -> int {
    int _o = 0;
    int _i = 1;
    while (_i){
        _o = _o + (_a%2!=_b%2)*_i;
        _i = _i * 2;
        _a = _a / 2;
        _b = _b / 2;
    }
    return _o;
}

// int can cast to everything implicitely, via modulo
// Whilst int acts as an insigned value generally, we allow it to be cast to signed values destructively.
metamethod cast(int _i) -> u32 (_i -> u32);
metamethod cast(int _i) -> s32 (_i -> s32);
// Likewise, everything can cast to int implicitly
metamethod cast(u32 _i) -> int (_i -> int);
metamethod cast(s32 _i) -> int (_i -> int);
// u32s can cast to u16 and u8, and so on (Including in reverse)
metamethod cast(u32 _i) -> u16 ((_i -> int) % 0x10000 -> u16);
metamethod cast(u32 _i) -> u8  ((_i -> int) % 0x100 -> u8);
metamethod cast(u16 _i) -> u32 ((_i -> int) -> u32);
metamethod cast(u16 _i) -> u8  ((_i -> int) % 0x100 -> u8);
metamethod cast(u8  _i) -> u32 ((_i -> int) -> u32);
metamethod cast(u8  _i) -> u16 ((_i -> int) -> u16);
// Same with signed values, although special attention must be paid to the sign bit
// To go from s32, we take the value % 0x8000, which leaves 15 bits of data and the sign bit
// We transfer the sign bit by adding (_i / 0x80000000) * 0x8000, Same for the other bits and values
metamethod cast(s32 _i) -> s16 (
    ((_i -> int) % 0x8000) + ((_i -> int) / 0x80000000) * 0x8000 -> s16
);
metamethod cast(s32 _i) -> s8 (
    ((_i -> int) % 0x80) + ((_i -> int) / 0x80000000) * 0x80 -> s8
);
metamethod cast(s16 _i) -> s32 (
    ((_i -> int) % 0x8000) + ((_i -> int) / 0x8000) * 0x80000000 -> s32
);
metamethod cast(s16 _i) -> s8 (
    ((_i -> int) % 0x80) + ((_i -> int) / 0x8000) * 0x80 -> s8
);
metamethod cast(s8 _i) -> s32 (
    ((_i -> int) % 0x8000) + ((_i -> int) / 0x80) * 0x80000000 -> s32
);
metamethod cast(s8 _i) -> s16 (
    ((_i -> int) % 0x80) + ((_i -> int) / 0x80) * 0x8000 -> s16
);
// Finally, u32 cast to s32 and so on, though without the sign bit
metamethod get_signed(u32 _i) -> s32 ((_i -> int) % 0x80000000 -> s32);
metamethod get_unsigned(s32 _i) -> u32 ((_i -> int) % 0x80000000 -> u32);

metamethod lt(s32 _a, s32 _b) -> int ((_a -> int)+0x80000000) < ((_b -> int)+0x80000000) ;
metamethod gt(s32 _a, s32 _b) -> int ((_a -> int)+0x80000000) > ((_b -> int)+0x80000000) ;
metamethod le(s32 _a, s32 _b) -> int ((_a -> int)+0x80000000) <= ((_b -> int)+0x80000000) ;
metamethod ge(s32 _a, s32 _b) -> int ((_a -> int)+0x80000000) >= ((_b -> int)+0x80000000) ;

abstract class u32 {}
abstract class u16 {}
abstract class u8  {}
abstract class s32 {}
abstract class s16 {}
abstract class s8  {}`
  );
  GenerateReadOnly(
    "stack.bc",
    `metamethod getindex(Stack<T> this, int i) -> T{
    return *(this.Data+i%this.Length);
}
metamethod setindex(Stack<T> this, int i, T v){
    *(this.Data+i%this.Length) = v;
}
metamethod ptrindex(Stack<T> this, int i) -> @T{
    return this.Data+i%this.Length;
}

class Stack<T> {
    int Capacity;
    int Length;
    @T Data;
    
    new(){
        this.Capacity = 8;
        this.Data = alloc(8);
    }
    
    new(int cap){
        this.Capacity = cap;
        this.Data = alloc(cap);
    }
     
    virtual function Push(T v){
        if(this.Length == this.Capacity){
            @T newBuff = alloc(this.Capacity * 2);
            int i = 0;
            while(i < this.Length){
                *(newBuff + i) = *(this.Data + i);
                i++;
            }
            this.Capacity = this.Capacity * 2;
            @T oldData = this.Data;
            this.Data = newBuff;
            free(oldData);
        };
        *(this.Data + this.Length) = v;
        this.Length++;
    }
    virtual function Pop() -> T {
        if(this.Length){
            this.Length--;
            return *(this.Data + this.Length);
        }
        return (0 -> T);
    }
    virtual function Peek() -> T {
        if(this.Length) return *(this.Data + this.Length - 1);
        return (0 -> T);
    }
    virtual function Has() -> int {
        if this.Length return 1;
        return 0;
    }
}`
  );
  /*GenerateReadOnly(
    "string.bc",
    `include array.bc;

function charlower(int i)->int {
    if((i>='A')*(i<='Z'))return i + ('a'-'A');
    return i;
}
function charupper(int i)->int {
    if((i>='a')*(i<='z'))return i + ('A'-'a');
    return i;
}
function charwrite(int i) {
}
function charwrite(int c){
    asm {seta [c]
         ptra
         writea }
}

class String : Array<int> {
    metamethod String(int l, @int d){
        this.Length = l;
        this.Data = d;
    }
    function Write() -> String{
        var l = this.Length;
        var d = this.Data;
        while(l--){
            charwrite(*d++);
        }
        return this;
    }
    function Upper() -> String{
        this.ReplaceV(charupper);
        return this;
    }
    function Lower() -> String{
        this.ReplaceV(charlower);
        return this;
    }
    static String ZERO;
    
    static function From(int i) -> String {
        if(i == 0)return String.ZERO;
        @int buffer = alloc(5);
        int l = 0;
        while(i > 0){
            l++;
            i, int m = i /% 10;
            *(buffer + 5 - l) = m + '0';
        }
        @int s = alloc(l);
        while(i < l){
            *(s+i) = *((buffer + 5 - l) + i);
            i++;
        }
        free(buffer);
        return new String(l, s);
    }
}
String.ZERO = new String("0");`
  );

  */ GenerateReadOnly(
    "term.bc",
    `include stack.bc;

metamethod get_R(Color3B c) -> int {
    return (c->int)%2;
}
metamethod get_G(Color3B c) -> int {
    return ((c->int)/2)%2;
}
metamethod get_B(Color3B c) -> int {
    return ((c->int)/4)%2;
}
abstract class Color3B {
    static function FromRGB(int r, int g, int b) -> Color3B{
        return ((r%2) + (g%2)*2 + (b%2)*4 -> Color3B);
    }
}

Color3B Black   = (0 -> Color3B);
Color3B Red     = (1 -> Color3B);
Color3B Green   = (2 -> Color3B);
Color3B Yellow  = (3 -> Color3B);
Color3B Blue    = (4 -> Color3B);
Color3B Magenta = (5 -> Color3B);
Color3B Cyan    = (6 -> Color3B);
Color3B White   = (7 -> Color3B);

@int numBuffer = ("00000")+1;
abstract class Term {
    static function WriteChar(int n){
        asm { seta [n]
              ptra 
              writea }
    }
    
    static function Read() -> int{
        int n;
        asm { seta [n]
              readb
              putbptra }
        return n;
    }
    
    static function Write(@int data){
        int length = data++;
        while(length--)Term.WriteChar(data++);
    }
    
    static function WriteLen(int length, @int data){
        while(length--)Term.WriteChar(data++);
    }
    
    static function WriteNum(int n){
        if(n==0)return Term.WriteChar('0');
        int l = 0;
        while(n>0){
            n,int m = n/%10;
            *((numBuffer+4)-l) = '0' + m;
            l++;
        }
        Term.WriteLen(l, (numBuffer+5)-l);
    }
    
    static function smethod(int c){
        Term.WriteChar(0x1B);
        Term.WriteChar('[');
        Term.WriteChar(c);
    }
    
    static function method(int n, int c){
        Term.WriteChar(0x1B);
        Term.WriteChar('[');
        Term.WriteNum(n);
        Term.WriteChar(c);
    }
    
    // Formatting stuff
    static function format(int n){
        Term.method(n, 'm');
    }
    static __Style Style;
    static __Cursor Cursor;
    
    // Clear
    static function ClearAfter(){
        return Term.smethod('J');
    }
    static function ClearBefore(){
        return Term.method(1, 'J');
    }
    static function Clear(){
        return Term.method(2, 'J');
    }
    
    // Events
    static function PollEvents(){
        int r = Term.Read();
        if(r){
            int low = Term.Read();
            int high = Term.Read();
            int i = 0;
            if(r == 1){
                while(i < Term.Click.Length){
                    (Term.Click[i++] -> func(int,int))(low, high)
                }
            }else if (r == 2){
                while(i < Term.KeyDown.Length){
                    (Term.KeyDown[i++] -> func(int,int))(low, high)
                }
            }else if (r == 3){
                while(i < Term.KeyUp.Length){
                    (Term.KeyUp[i++] -> func(int,int))(low, high)
                }
            }else if (r == 4){
                while(i < Term.Frame.Length){
                    (Term.Frame[i++] -> func())()
                }
            }
        }
    }
    
    
    
    static Stack<func(int,int)> KeyDown = reserve Stack(1);
    static Stack<func(int,int)> KeyUp = reserve Stack(1);
    static Stack<func(int,int)> Click = reserve Stack(1);
    static Stack<func()> Frame = reserve Stack(1);
}

metamethod get_Fore(__Style s) -> void{return 0;}
metamethod get_Back(__Style s) -> void{return 0;}
metamethod get_Bold(__Style s) -> void{return 0;}
metamethod get_Italic(__Style s) -> void{return 0;}
metamethod get_Underline(__Style s) -> void{return 0;}
metamethod get_Striked(__Style s) -> void{return 0;}

metamethod set_Fore(__Style s, Color3B col){
    return Term.format(30 + (col -> int));
}
metamethod set_Back(__Style s, Color3B col){
    return Term.format(40 + (col -> int));
}
metamethod set_Bold(__Style s, int b){
    if(b)Term.format(1)
    else Term.format(22);
}
metamethod set_Italic(__Style s, int b){
    if(b)Term.format(3)
    else Term.format(23);
}
metamethod set_Underline(__Style s, int b){
    if(b)Term.format(4)
    else Term.format(24);
}
metamethod set_Striked(__Style s, int b){
    if(b)Term.format(9)
    else Term.format(29);
}
abstract class __Style {
}

metamethod get_X(__Cursor c) -> void {return 0};
metamethod get_Y(__Cursor c) -> void {return 0};
metamethod get_Up(__Cursor c) -> void {return 0};
metamethod get_Down(__Cursor c) -> void {return 0};
metamethod get_Left(__Cursor c) -> void {return 0};
metamethod get_Right(__Cursor c) -> void {return 0};

metamethod set_X(__Cursor c, int x){ return Term.method(x, 'G') }
metamethod set_Y(__Cursor c, int y){ return Term.method(y, 'H') }
abstract class __Cursor {
    virtual function Up(int n){ return Term.method(n, 'A') }
    virtual function Down(int n){ return Term.method(n, 'B') }
    virtual function Left(int n){ return Term.method(n, 'D') }
    virtual function Right(int n){ return Term.method(n, 'C') }
    virtual function Push(){ return Term.smethod('s') }
    virtual function Pop(){ return Term.smethod('u') }
    virtual function Reset(){ return Term.smethod('H') }
    virtual function NextLine(){ return Term.method(1, 'E') }
    virtual function PrevLine(){ return Term.method(1, 'F') }
}`
  );
  /* GenerateReadOnly(
    "tree.bc",
    `include stack.bc;
void NULL;

class Branch<T> {
    @Branch<T> Anchor;
    Branch<T> Left;
    int High;
    int Key;
    T Value;
    Branch<T> Right;
    
    metamethod Branch(@Branch<T> Anchor, int High, int Key, T Value){
        this.Anchor = Anchor;
        this.High = High;
        this.Key = Key;
        this.Value = Value;
    }
    
    function FillStack(Stack<Branch> s){
        if(this.Left)this.Left.FillStack(s);
        s.Push(this);
        if(this.Right)this.Right.FillStack(s);
    }
    
    function Destroy(){
        if(!this.Left * !this.Right){
            if(this.Anchor){
                *this.Anchor = NULL;
            }
            free((this -> @void));
            return;
        }
        if(!this.Left){
            if(this.Anchor){
                *this.Anchor = this.Right;
                this.Right.Anchor = this.Anchor;
            }
            this.Right.High = this.High;
            free((this -> @void));
            return;
        }
        if(!this.Right){
            if(this.Anchor){
                *this.Anchor = this.Left;
                this.Left.Anchor = this.Anchor;
            }
            this.Left.High = this.High;
            free((this -> @void));
            return;
        }
        if(this.High){
            var r = this.Left.Right;
            this.Left.Right = this.Right;
            *this.Anchor = this.Left;
            var l = this.Right;
            while(l.Left){l = l.Left};
            l.Left = r;
            free((this -> @void));
        }else{
            var r = this.Right.Left;
            this.Right.Left = this.Left;
            *this.Anchor = this.Right;
            var l = this.Left;
            while(l.Right){l = l.Right};
            l.Right = r;
            free((this -> @void));
        }
    }
    
    function Each(func(int, T) method){
        if(this.Left)this.Left.Each(method);
        method(this.Key, this.Value);
        if(this.Right)this.Right.Each(method);
    }
    
    function Get(int key) -> T {
        if(key == this.Key){
            return this.Value;
        }
        if(key < this.Key){
            if(!this.Left)return NULL;
            return this.Left.Get(key);
        }
        if(!this.Right)return NULL;
        return this.Right.Get(key);
    }
    function Set(int key, T val) {
        if(key == this.Key){
            return this.Value = val;
        }
        if(key < this.Key){
            if(!this.Left)return this.Left = new Branch(&this.Left, 0, key, val);
            return this.Left.Set(key, val);
        }
        if(!this.Right)return this.Right = new Branch(&this.Right, 1, key, val);
        return this.Right.Set(key, val);
    }
    
    metamethod truthy(Branch this) -> int { (this -> int) }
}

class Tree<T> {
    Branch<T> Root;
    
    function ToStack() -> Stack<Branch<T>> {
        Stack<Branch<T>> s = new Stack();
        if(this.Root)this.Root.FillStack(s);
        return s;
    }
    
    function Rebalance() { 
        Stack<Branch<T>> s = this.ToStack(); 
        int middle = s.Length/2;
        this.Root = NULL;
        this[(s[middle] -> Branch).Key] = (s[middle] -> Branch).Value;
        this.Fill(s, 0, middle-1);
        this.Fill(s, middle+1, s.Length-1);
        int i = 0;
        while(i < s.Length){
            free((s[i++] -> @void));
        }
    }
    
    function Fill(Stack<Branch<T>> s, int low, int high){
        if(high > low){
            int m = ((high - low)/2) + low;
            this[(s[m] -> Branch).Key] = (s[m] -> Branch).Value;
            this.Fill(s, low, m-1);
            this.Fill(s, m+1, high);
            return;
        }
        if(high == low){
            this[(s[low] -> Branch).Key] = (s[low] -> Branch).Value;
        }
    }
    
    function Each(func(int,T) method){
        if(this.Root)this.Root.Each(method);
    }
    
    metamethod getindex(Tree<T> this, int i) -> T{
        if(this.Root)return this.Root.Get(i);
        return NULL;
    }
    
    metamethod setindex(Tree<T> this, int i, T v){
        if(this.Root)return this.Root.Set(i, v);
        this.Root = new Branch(&this.Root, 1, i, v);
    }
    
    metamethod Tree(){}
}`
  );*/
}
