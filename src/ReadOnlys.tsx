import { GenerateReadOnly, AllReadOnlys } from "./App";
var generated = false;
export function GenerateReadOnlys() {
  if (generated) return;
  generated = true;
  GenerateReadOnly("array.bc", `struct array<T> {
    int count;
    @T data;
    new();
    new<T>(int count, @T data){
        array<T> this = this<array<T>>;
        this.count = count;
        this.data = data;
    }
}
metamethod cast<T>(array<T> this)->int,@T
    return this.count,this.data
metamethod dispose<T>(array<T> this)
    free(this.data)`)
  GenerateReadOnly("arraylist.bc", `include array.bc;
include mem.bc;
class ArrayList<T> {
    int Capacity = 8;
    int Size = 0;
    @T Data;
    
    new(int capacity){
        this.Capacity = capacity;
        this.Data = alloc(capacity);
    }
    
    new(){
        this.Data = alloc(this.Capacity);
    }
    
    virtual function Add(T element){
        if(this.Size++ == this.Capacity){
            @T newBuff = alloc(this.Capacity*2);
            int i=0;
            while(i < this.Capacity){
                newBuff[i] = this.Data[i];
                i++;
            }
            free((this.Data -> int));
            this.Data = newBuff;
            this.Capacity = this.Capacity * 2;
        };
        *(this.Data + this.Size - 1) = element;
    }

    virtual function Iterate(func(T) iterator) {
        int i = 0;
        while(i < this.Size){
            iterator(*(this.Data+(i++)));
        }
    }
    
    virtual function Shrink() -> array<T> {
        @T buffer = alloc(this.Size);
        memcpy(this.Data, buffer, this.Size);
        return new array(this.Size, buffer);
    }
}

metamethod getindex<T>(ArrayList<T> this, int index) -> T {
    return *(this.Data+(index%this.Size));
}
metamethod setindex<T>(ArrayList<T> this, int index, T value) {
    *(this.Data+(index%this.Size)) = value;
}
metamethod ptrindex<T>(ArrayList<T> this, int index) -> @T {
    return (this.Data+(index%this.Size));
}
metamethod dispose<T>(ArrayList<T> this){
    free((this.Data -> int));
    free(this);
}
metamethod cast<T>(ArrayList<T> this) -> array<T>
    new array(this.Size, this.Data)`);
  GenerateReadOnly("arrayutils.bc", `include array.bc;
metamethod get_of(typearray this) function<T>(params T[count] data)->array<T> new array(count,data)

struct arrayutils {
    static function iterate<A>(func(A) method, array<A> this){
        int i = 0;
        while(i < this.count){
            method(this.data[i]);
            i++;
        }
    }
    static function map<A,B>(func(A)->B method, array<A> this) -> array<B>{
        int i = 0;
        @B res = alloc(this.count);
        while(i < this.count){
            res[i] = method(this.data[i]);
            i++;
        }
        return new array(this.count, res);
    }
    static function modify<A>(func(A)->A method, array<A> this) -> array<A>{
        int i = 0;
        while(i < this.count){
            this.data[i] = method(this.data[i]);
            i++;
        }
        return this;
    }
    static function filter<A>(func(A)->int method, array<A> this) -> array<A>{
        @A buffer = temp alloc(this.count);
        int i = 0;
        int j = 0;
        while(i < this.count){
            if(method(this.data[i])){
                buffer[j] = this.data[i];
                i++;
            }
            i++;
        }
        int newCount = j;
        int i = 0;
        @A res = alloc(newCount);
        while(i < newCount){
            res[i] = buffer[j];
        }
        return new array(newCount, res);
    }
    static function fold<A,B>(func(A,A)->B method, A initial, array<A> this) -> array<B> {
        @B res = alloc(this.count);
        int i = 0;
        while(i < this.count){
            res[i] = method(initial, this.data[i])
            initial = this.data[i];
            i++;
        }
        return new array(this.count, res);
    }
    static function fold<A,B>(func(A,A)->B method, array<A> this) -> array<B> {
        if(this.count == 0)
            return new array(0, alloc(0));
        A initial = this.data[0];
        @B res = alloc(this.count);
        int i = 1;
        while(i < this.count){
            res[i-1] = method(initial, this.data[i])
            initial = this.data[i];
            i++;
        }
        return new array(this.count - 1, res);
    }
    static function reduce<A,B>(func(B,A)->B method, B initial, array<A> this) -> B {
        int i = 0;
        while(i < this.count){
            initial = method(initial, this.data[i])
            i++;
        }
        return initial;
    }
    static function reduce<A>(func(A,A)->A method, array<A> this) -> A {
        A initial = this.data[0];
        int i = 0;
        while(i < this.count){
            initial = method(initial, this.data[i])
            i++;
        }
        return initial;
    }
}
metamethod get_iterate(array this) arrayutils.iterate;
metamethod get_map(array this) arrayutils.map;
metamethod get_modify(array this) arrayutils.modify;
metamethod get_filter(array this) arrayutils.filter;
metamethod get_fold(array this) arrayutils.fold;
metamethod get_reduce(array this) arrayutils.reduce;`)
  GenerateReadOnly("extformats.bc", `include stringify.bc;
include float.bc;

function stringifyFloat(float this, func(int) iter){
    int integer = this.integer;
    intToString(integer, iter);
    this = this - integer.float;
    if(this == float.zero)return;
    iter('.');
    int i = 6;
    while(this != float.zero && --i){
        this = this * float.ten;
        integer = this.integer;
        iter(integer+'0');
        this = this - integer.float;
    }
}
metamethod cast(float this) -> stringified new stringified(this, stringifyFloat);

abstract class hexInt {}
abstract class HexInt {}
abstract class binaryInt {}
abstract class binary8Int {}
abstract class binary32Int {}

function hexToString(hexInt this, func(int) iterator){
    @int buffer = reserve 8;
    int n = (this -> int)
    if(n == 0){
        iterator('0');
    }
    int l = 0;
    while(n){
        n, int m = n /% 16;
        if (m > 9)
            buffer[l] = ('a' + m - 10)
        else
            buffer[l] = '0' + m;
        l++;
    }
    while(l){
        l--;
        iterator(buffer[l]);
    }
}
function HexToString(HexInt this, func(int) iterator){
    @int buffer = reserve 8;
    int n = (this -> int)
    if(n == 0){
        iterator('0');
    }
    int l = 0;
    while(n){
        n, int m = n /% 16;
        if (m > 9)
            buffer[l] = ('A' + m - 10)
        else
            buffer[l] = '0' + m;
        l++;
    }
    while(l){
        l--;
        iterator(buffer[l]);
    }
}
function binaryToString(binaryInt this, func(int) iterator){
    @int buffer = reserve 32;
    int n = (this -> int)
    if(n == 0){
        iterator('0');
    }
    int l = 0;
    while(n){
        n, int m = n /% 2;
        buffer[l] = '0' + m;
        l++;
    }
    while(l){
        l--;
        iterator(buffer[l]);
    }
}
function binary8ToString(binary8Int this, func(int) iterator){
    @int buffer = reserve 32;
    int n = (this -> int)
    if(n == 0){
        iterator('0');
    }
    int l = 0;
    while(n){
        n, int m = n /% 2;
        buffer[l] = '0' + m;
        l++;
    }
    int diff = 8 - l
    while(diff--) iterator('0');
    while(l){
        l--;
        iterator(buffer[l]);
    }
}
function binary32ToString(binary32Int this, func(int) iterator){
    @int buffer = reserve 32;
    int n = (this -> int)
    if(n == 0){
        iterator('0');
    }
    int l = 0;
    while(n){
        n, int m = n /% 2;
        buffer[l] = '0' + m;
        l++;
    }
    int diff = 32 - l
    while(diff--) iterator('0');
    while(l){
        l--;
        iterator(buffer[l]);
    }
}

metamethod cast(hexInt this) -> stringified new stringified(this, hexToString);
metamethod cast(HexInt this) -> stringified new stringified(this, HexToString);
metamethod cast(binaryInt this) -> stringified new stringified(this, binaryToString);
metamethod cast(binary8Int this) -> stringified new stringified(this, binary8ToString);
metamethod cast(binary32Int this) -> stringified new stringified(this, binary32ToString);
metamethod cast(hexInt this) -> int (this -> int);
metamethod cast(HexInt this) -> int (this -> int);
metamethod get_hex(int this) -> hexInt (this -> hexInt);
metamethod get_Hex(int this) -> HexInt (this -> HexInt);
metamethod get_binary(int this) -> binaryInt (this -> binaryInt);
metamethod get_binary8(int this) -> binary8Int (this -> binary8Int);
metamethod get_binary32(int this) -> binary32Int (this -> binary32Int);`)
  GenerateReadOnly("extmacros.bc", "macro ( (assignable) (/\\/%|<<|>>|<=|>=|==|!=|&&|\\|\\||[*^\\/%+<>&~|-]/) \"=\" (expression) ) { $1 = $1 $2 $3 }\nmacro ( 'for' \"(\" (expression?) \";\" (expression?) \";\" (expression?) \")\" (expression) ) {\n    {\n        $1;\n        while($2){\n            $4;\n            $3;\n        }\n    }\n}\nmacro ( 'new' type '[]' '{' '}' ){{}}\nmacro ( 'new' (type) '[]' '{'  ','? (expression) ((',' expression)*) '}' ) {{\n    $1 _a = $2;\n    new $1[]{$3};\n    &_a;\n}}\nmacro ( 'new' (type) '[' (number) ']' ){ (reserve $2 -> @$1) };\n");
  GenerateReadOnly("float.bc", `include stringify.bc;
metamethod get_sign(float this) -> int (this -> int) / 0x80000000;
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
    if(!mantissa){
        return (0 -> float);
    }
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
    static const float ten = 0x41200000;

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
            return this;
        // Get both mantissas with their implied 1
        int mantissaA = this.mantissa + 0x800000;
        int mantissaB = other.mantissa + 0x800000;
        // Get both exponents
        int exponentA = this.exponent;
        int exponentB = other.exponent;
        // Shift left the smaller mantissa to match the larger one
        // We don't actually have bitshift, so we have to manually multiply
        int sign = this.sign;
        while(exponentA < exponentB){
            exponentA ++;
            mantissaA = mantissaA / 2;
        }
        while(exponentB < exponentA){
            exponentB ++;
            mantissaB = mantissaB / 2;
        }
        if (mantissaB > mantissaA) {
            mantissaA, mantissaB = (mantissaB, mantissaA -> int, int);
            sign = 1 - sign;
        }
        // Subtract the mantissas
        int mantissaC = mantissaA - mantissaB;
        // Normalize the mantissa
        while(mantissaC < 0x800000){
            exponentA --;
            mantissaC = mantissaC * 2;
        }
        // Return the result
        return float.make(sign, exponentA, mantissaC % 0x800000);
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

metamethod lt(float a, float b) -> int{
    if(a.sign != b.sign){
        return a.sign;
    }
    if(a.exponent != b.exponent){
        return if (a.sign)
                    a.exponent > b.exponent
                else
                    a.exponent < b.exponent;
    }
    return if (a.sign)
                a.mantissa > b.mantissa
            else
                a.mantissa < b.mantissa;
}
metamethod le(float a, float b) -> int{
    if(a.sign != b.sign){
        return a.sign;
    }
    if(a.exponent != b.exponent){
        return if (a.sign)
                    a.exponent > b.exponent
                else
                    a.exponent < b.exponent;
    }
    return if (a.sign)
                a.mantissa >= b.mantissa
            else
                a.mantissa <= b.mantissa;
}
metamethod gt(float a, float b) -> int{
    if(a.sign != b.sign){
        return b.sign;
    }
    if(a.exponent != b.exponent){
        return if (a.sign)
                    a.exponent < b.exponent
                else
                    a.exponent > b.exponent;
    }
    return if (a.sign)
                a.mantissa < b.mantissa
            else
                a.mantissa > b.mantissa;
}
metamethod ge(float a, float b) -> int{
    if(a.sign != b.sign){
        return b.sign;
    }
    if(a.exponent != b.exponent){
        return if (a.sign)
                    a.exponent < b.exponent
                else
                    a.exponent > b.exponent;
    }
    return if (a.sign)
                a.mantissa <= b.mantissa
            else
                a.mantissa >= b.mantissa;
}

function almost_equal(int mantA, int mantB) -> int {
    int diff = mantA - mantB;
    return (diff < 0x100) || (diff > 0xFFFFFF00);
} 

metamethod eq(float a, float b) -> int
    return (a.sign == b.sign) && (a.exponent == b.exponent) && almost_equal(a.mantissa, b.mantissa);
metamethod ne(float a, float b) -> int
    return (a.sign != b.sign) || (a.exponent != b.exponent) || !almost_equal(a.mantissa, b.mantissa);

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
} -> float) }`);
  GenerateReadOnly("int.bc", "metamethod pow(int _a, int _b) -> int {\n    if(!_b)\n        return 1;\n    if(_b == 1)\n        return _a;\n    int _result = 1;\n    while(_b > 0){\n        if(!(_b%2)){\n            _b = _b / 2;\n            _a = _a * _a;\n        }else{\n            _b = _b - 1\n            _result = _result * _a;\n            _b = _b / 2;\n            _a = _a * _a\n        }\n    }\n    return _result;\n}\nmetamethod bshl(int _a, int _b) -> int {\n    return _a * (2 ^ _b);\n}\nmetamethod bshr(int _a, int _b) -> int {\n    return _a / (2 ^ _b);\n}\nmetamethod band(int _a, int _b) -> int {\n    int _o = 0;\n    int _i = 1;\n    while (_i){\n        _o = _o + ((_a%2)*(_b%2))*_i;\n        _i = _i * 2;\n        _a = _a / 2;\n        _b = _b / 2;\n    }\n    return _o;\n}\nmetamethod bor(int _a, int _b) -> int {\n    int _o = 0;\n    int _i = 1;\n    while (_i){\n        _o = _o + !(!(_a%2)*!(_b%2))*_i;\n        _i = _i * 2;\n        _a = _a / 2;\n        _b = _b / 2;\n    }\n    return _o;\n}\nmetamethod bxor(int _a, int _b) -> int {\n    int _o = 0;\n    int _i = 1;\n    while (_i){\n        _o = _o + (_a%2!=_b%2)*_i;\n        _i = _i * 2;\n        _a = _a / 2;\n        _b = _b / 2;\n    }\n    return _o;\n}");
  GenerateReadOnly("inttypes.bc", "// int can cast to everything implicitely, via modulo\n// Whilst int acts as an insigned value generally, we allow it to be cast to signed values destructively.\nmetamethod cast(int _i) -> u32 (_i -> u32);\nmetamethod cast(int _i) -> s32 (_i -> s32);\n// Likewise, everything can cast to int implicitly\nmetamethod cast(u32 _i) -> int (_i -> int);\nmetamethod cast(s32 _i) -> int (_i -> int);\n// u32s can cast to u16 and u8, and so on (Including in reverse)\nmetamethod cast(u32 _i) -> u16 ((_i -> int) % 0x10000 -> u16);\nmetamethod cast(u32 _i) -> u8  ((_i -> int) % 0x100 -> u8);\nmetamethod cast(u16 _i) -> u32 ((_i -> int) -> u32);\nmetamethod cast(u16 _i) -> u8  ((_i -> int) % 0x100 -> u8);\nmetamethod cast(u8  _i) -> u32 ((_i -> int) -> u32);\nmetamethod cast(u8  _i) -> u16 ((_i -> int) -> u16);\n// Same with signed values, although special attention must be paid to the sign bit\n// To go from s32, we take the value % 0x8000, which leaves 15 bits of data and the sign bit\n// We transfer the sign bit by adding (_i / 0x80000000) * 0x8000, Same for the other bits and values\nmetamethod cast(s32 _i) -> s16 (\n    ((_i -> int) % 0x8000) + ((_i -> int) / 0x80000000) * 0x8000 -> s16\n);\nmetamethod cast(s32 _i) -> s8 (\n    ((_i -> int) % 0x80) + ((_i -> int) / 0x80000000) * 0x80 -> s8\n);\nmetamethod cast(s16 _i) -> s32 (\n    ((_i -> int) % 0x8000) + ((_i -> int) / 0x8000) * 0x80000000 -> s32\n);\nmetamethod cast(s16 _i) -> s8 (\n    ((_i -> int) % 0x80) + ((_i -> int) / 0x8000) * 0x80 -> s8\n);\nmetamethod cast(s8 _i) -> s32 (\n    ((_i -> int) % 0x8000) + ((_i -> int) / 0x80) * 0x80000000 -> s32\n);\nmetamethod cast(s8 _i) -> s16 (\n    ((_i -> int) % 0x80) + ((_i -> int) / 0x80) * 0x8000 -> s16\n);\n// Finally, u32 cast to s32 and so on, though without the sign bit\nmetamethod get_signed(u32 _i) -> s32 ((_i -> int) % 0x80000000 -> s32);\nmetamethod get_unsigned(s32 _i) -> u32 ((_i -> int) % 0x80000000 -> u32);\n\nmetamethod lt(s32 _a, s32 _b) -> int ((_a -> int)+0x80000000) < ((_b -> int)+0x80000000) ;\nmetamethod gt(s32 _a, s32 _b) -> int ((_a -> int)+0x80000000) > ((_b -> int)+0x80000000) ;\nmetamethod le(s32 _a, s32 _b) -> int ((_a -> int)+0x80000000) <= ((_b -> int)+0x80000000) ;\nmetamethod ge(s32 _a, s32 _b) -> int ((_a -> int)+0x80000000) >= ((_b -> int)+0x80000000) ;\n\nabstract class u32 {}\nabstract class u16 {}\nabstract class u8  {}\nabstract class s32 {}\nabstract class s16 {}\nabstract class s8  {}");
  GenerateReadOnly("io.bc", `include stringify.bc;

function qFormat(func(int) iterator, stringified s){
    iterator('"');
    s(function(int c){
        if (c == '"' || c == '\\\\'){
            iterator('\\\\');
        }
        iterator(c);
    });
    iterator('"');
} 

function xFormat(func(int) iterator, stringified s){
    // Treat the n value of the stringified as a lowercase hex number
    @int buffer = reserve 8;
    int n = s.n;
    if(n == 0){
        iterator('0');
    }
    int l = 0;
    while(n){
        n, int m = n /% 16;
        if (m > 9)
            buffer[l] = ('a' + m - 10)
        else
            buffer[l] = '0' + m;
        l++;
    }
    while(l){
        l--;
        iterator(buffer[l]);
    }
}

function XFormat(func(int) iterator, stringified s){
    // Treat the n value of the stringified as a lowercase hex number
    @int buffer = reserve 8;
    int n = s.n;
    if(n == 0){
        iterator('0');
    }
    int l = 0;
    while(n){
        n, int m = n /% 16;
        if (m > 9)
            buffer[l] = ('A' + m - 10)
        else
            buffer[l] = '0' + m;
        l++;
    }
    while(l){
        l--;
        iterator(buffer[l]);
    }
}

function bFormat(func(int) iterator, stringified s){
    // Treat the n value of the stringified as a lowercase hex number
    @int buffer = reserve 32;
    int n = s.n;
    if(n == 0){
        iterator('0');
    }
    int l = 0;
    while(n){
        n, int m = n /% 2;
        buffer[l] = '0' + m;
        l++;
    }
    while(l){
        l--;
        iterator(buffer[l]);
    }
}

function format(func(int) iterator, stringified formatSpecifier, params stringified[count] elements){
    // Tracks if a $ was primed
    int isSpecial = 0;
    // One of 0, 'q', 'x', 'X', 'b'
    int modifier = 0;
    formatSpecifier(function(int c){
        if (isSpecial) {
            if (c == 'q'){
                modifier = 'q';
                return;
            }
            if (c == 'x'){
                modifier = 'x';
                return;
            }
            if (c == 'X'){
                modifier = 'X';
                return;
            }
            if (c == 'b'){
                modifier = 'b';
                return;
            }
            // Iterate the element, use any special modifier if required.
            if (c >= '0' && c <= '9'){
                if(modifier == 'q'){
                    qFormat(iterator, elements[c - '0']);
                } else if(modifier == 'x'){
                    xFormat(iterator, elements[c - '0']);
                } else if(modifier == 'X'){
                    XFormat(iterator, elements[c - '0']);
                } else if(modifier == 'b'){
                    bFormat(iterator, elements[c - '0']);
                } else {
                    elements[c - '0'](iterator); 
                }
                isSpecial = 0;
                modifier = 0;
                return
            }
            isSpecial = 0;
            modifier = 0;
            iterator(c);
            return;
        }
        
        if (c == '$'){
            isSpecial = 1;
        }else{
            iterator(c);
        }
    });
}

function printf(stringified formatSpecifier, params stringified[count] elements){
    format(putchar, formatSpecifier, count, elements);
}

function print(params stringified[count] elements){
    stringified.deliminated(putchar, "\\t", count, elements);
}
int lastChar = -1;
int bufferedChar = -1;
var oldGetchar = getchar;
getchar = function() -> int{
    if(bufferedChar!=-1){
        int o = bufferedChar;
        bufferedChar = -1;
        return o;
    }
    return lastChar=oldGetchar();
}
function rejectchar(){
    bufferedChar=lastChar;
}

abstract class gets{};
metamethod call(typegets _, int bufferLength, @int buffer, stringified terminators) -> int {
    if(bufferLength == 0)
        return 0;
    int c;
    int i = 0;
    int terminated = 0;
    while(1+c=getchar()){
        terminators(function(int s)
            if (s == c)
                terminated = 1
        );
        if(terminated){
            rejectchar();
            return i;
        }
        buffer[i] = c;
        i++;
        if(i>=bufferLength)
            return i-1;
    }
    return i;
}
metamethod call(typegets _, int bufferLength, @int buffer) -> int
    return gets(bufferLength, buffer, "\\r\\n");

function __getsstringified(string _terminators, func(int) iterator){
    stringified terminators = _terminators;
    int c;
    while(1+c=getchar()){
        int terminated = 0;
        terminators(function(int s)
            if (s == c)
                terminated = 1
        );
        if(terminated){
            rejectchar();
            return;
        }else{
            iterator(c);
        }
    }
}

metamethod call(typegets _, string terminators) -> stringified {
    return new stringified(terminators, __getsstringified);
}
metamethod call(typegets _) -> stringified{
    return new stringified("\\r\\n", __getsstringified);
}
abstract class getof{};
metamethod call(typegetof _, int bufferLength, @int buffer, stringified whitelist) -> int{
    if(bufferLength == 0)
        return 0;
    int c;
    int i = 0;
    while(1+c=getchar()){
        int terminated = 1
        whitelist(function(int s)
            if (s == c)
                terminated = 0
        );
        if(terminated){
            rejectchar();
            return i;
        }
        buffer[i] = c;
        i++;
        if(i>=bufferLength)
            return i-1;
    }
    return i;
}

function __getofstringified(string _whitelist, func(int) iterator){
    stringified whitelist = _whitelist;
    int c;
    while(1+c=getchar()){
        int terminated = 1;
        whitelist(function(int s)
            if (s == c)
                terminated = 0
        );
        if(terminated){
            rejectchar();
            return;
        }else{
            iterator(c);
        }
    }
}
metamethod call(typegetof _, string whitelist) -> stringified {
    return new stringified(whitelist, __getofstringified);
}

function getint() -> int {
    int j = 0;
    getof("0123456789")(function(int c){
        j = j * 10
        j = j + c - '0';
    });
    return j;
}`);
  GenerateReadOnly("mem.bc", `function memcpy<T>(@T source, @T dest, int count){
    int i = 0;
    if((dest -> int) <= (source -> int)){
        while(i < count){
            dest[i]=source[i];
            i++;
        }
    }else{
        while(i < count){
            int j = (count-1)-i;
            dest[j]=source[j];
            i++;
        }
    }
}
function memswp<T>(@T a, @T b){
    T temp_a = *a;
    *a = *b;
    *b = temp_a;
}
function memswp<T>(@T a, @T b, int count){
    int i = 0;
    while(i < count){
        T temp_a = a[i];
        a[i] = b[i];
        b[i] = temp_a;
        i++;
    }
}`)
  GenerateReadOnly("pair.bc", "struct pair<A,B> {\n    A a;\n    B b;\n    new(void a, void b){\n        this.a = a;\n        this.b = b;\n    };\n}");
  GenerateReadOnly("rand.bc", `include int.bc;

int seedA = COMPILER.random;
int seedB = 0xb0a710ad;
function rand() -> int{
    int x = seedA;
    int y = seedB;
    x = x ~ (x << 13);
    x = x ~ (x >> 17);
    x = x ~ (x << 5);
    seedA = y;
    seedB = x;
    return x + y;
}
function rand(int max) -> int {
    if(max <= 1) return max;
    // Generate a re-roll threshold from the max.
    // This is the largest multiple of max that is <=0xffffffff
    int biggestMult = (0xffffffff / max) * max;
    int x;
    while(biggestMult <= x=rand()){}
    // Reroll until x is a number lessthan or equal to the biggest multiple.
    // This accounts for slight bias towards smaller numbers for non-power of 2
    return x%max;
}
function rand(int min, int max) -> int {
    return rand(max - min) + min;
}

function seed(int a, int b){
    seedA = a;
    seedB = b;
}`);
  GenerateReadOnly("stack.bc", "metamethod getindex<T>(Stack<T> this, int i) -> T{\n    return *(this.Data+i%this.Length);\n}\nmetamethod setindex<T>(Stack<T> this, int i, T v){\n    *(this.Data+i%this.Length) = v;\n}\nmetamethod ptrindex<T>(Stack<T> this, int i) -> @T{\n    return this.Data+i%this.Length;\n}\n\nclass Stack<T> {\n    int Capacity;\n    int Length;\n    @T Data;\n    \n    new(){\n        this.Capacity = 8;\n        this.Data = alloc(8);\n    }\n    \n    new(int cap){\n        this.Capacity = cap;\n        this.Data = alloc(cap);\n    }\n     \n    virtual function Push(T v){\n        if(this.Length == this.Capacity){\n            @T newBuff = alloc(this.Capacity * 2);\n            int i = 0;\n            while(i < this.Length){\n                *(newBuff + i) = *(this.Data + i);\n                i++;\n            }\n            this.Capacity = this.Capacity * 2;\n            @T oldData = this.Data;\n            this.Data = newBuff;\n            free(oldData);\n        };\n        *(this.Data + this.Length) = v;\n        this.Length++;\n    }\n    virtual function Pop() -> T {\n        if(this.Length){\n            this.Length--;\n            return *(this.Data + this.Length);\n        }\n        return (0 -> T);\n    }\n    virtual function Peek() -> T {\n        if(this.Length) return *(this.Data + this.Length - 1);\n        return (0 -> T);\n    }\n    virtual function Has() -> int {\n        if this.Length return 1;\n        return 0;\n    }\n}");
  GenerateReadOnly("string.bc", `abstract class string {}
metamethod get_length(string this) -> int *(this -> @int);
metamethod get_chars(string this) -> @int 1+(this -> @int);
metamethod getindex(string this, int index) -> int *(1+index+(this->@int));
metamethod setindex(string this, int index, int value) -> int *(1+index+(this->@int)) = value;
metamethod ptrindex(string this, int index) -> @int 1+index+(this->@int);
metamethod dispose(string this) if((this->int)>=(COMPILER.aftercode->int)) free(this);`);
  GenerateReadOnly("stringutils.bc", `include arrayutils.bc;
include string.bc;
include mem.bc;

metamethod get_array(string this) -> array<int> new array(this.length, this.chars);

struct stringutils {
    static function from(array<int> arr) -> string {
        @int res = alloc(arr.count+1);
        *res = arr.count;
        memcpy(arr.data, res+1, arr.count);
        return (res -> string);
    }
    static function from(int count, @int chars) -> string {
        @int res = alloc(count+1);
        *res = count;
        memcpy(chars, res+1, count);
        return (res -> string);
    }
    static function clone(string s) -> string {
        int size = (string -> @int) + 1;
        @int newchars = alloc(size);
        memcpy((s->@int),newchars,size);
        return (newchars -> string);
    }
    static function concat(string a, string b) -> string {
        @int res = alloc(a.length + b.length + 1);
        int i = 0;
        *res = a.length + b.length;
        while (i < a.length){
            res[i+1] = a[i];
            i++;
        }
        int j = 0;
        while (j < b.length){
            res[i+1] = b[j];
            i++;
            j++;
        }
        return (res -> string);
    }
    static function charlower(int char) -> int {
        if(char >= 'A' && char <= 'Z')
            return char - 'A' + 'a';
        return char;
    }
    static function charupper(int char) -> int {
        if(char >= 'a' && char <= 'z')
            return char - 'a' + 'A';
        return char;
    }
    static function lower(string s) -> string {
        s.array.modify(stringutils.charlower);
        return s;
    }
    static function upper(string s) -> string {
        s.array.modify(stringutils.charupper);
        return s;
    }
    static function toint(string s) -> int {
        int n = 0;
        s.array.iterate(int c => {
            if(c >= '0' && c <= '9'){
                n = (n*10)+(c-'0');
            }
        });
        return n;
    }
    static function reverse(string s) -> string {
        int i = 0;
        int c = s.length;
        while(i*2 < c){
            int a = s[i];
            s[i] = s[(c-1)-i];
            s[(c-1)-i]=a;
            i++;
        }
        return s;
    }
    static function sub(int start, int end, string s) -> string {
        if(end > s.length)end = s.length;
        if(start > end)
            return stringutils.reverse(stringutils.sub(end, start, s));
        return stringutils.from(end-start, &s[start]);
    }
    static function sub(int start, string s) -> string {
        int end = s.length;
        if(start > end)
            start = end;
        return stringutils.from(end-start, &s[start]);
    }
    static function find(string needle, string haystack) -> int {
        int i = 0;
        while(i < haystack.length){
            int j = 0;
            while(j < needle.length){
                if(needle[j] != haystack[j+i])
                    j=-1
                else
                    j++;
            }
            if(j!=-1)
                return i;
            i++;
        }
        return -1;
    }
    static function find(string needle, int i, string haystack) -> int {
        while(i < haystack.length){
            int j = 0;
            while(j < needle.length){
                if(needle[j] != haystack[j+i])
                    j=-1
                else
                    j++;
            }
            if(j!=-1)
                return i;
            i++;
        }
        return -1;
    }
    static function find(int needle, string haystack) -> int {
        int i = 0;
        while(i < haystack.length){
            if(needle == haystack[i])
                return i;
            i++;
        }
        return -1;
    }
    static function find(int needle, int i, string haystack) -> int {
        while(i < haystack.length){
            if(needle == haystack[i])
                return i;
            i++;
        }
        return -1;
    }
    static function has(string needle, string haystack) -> int {
        int i = 0;
        while(i < haystack.length){
            int j = 0;
            while(j < needle.length){
                if(needle[j] != haystack[j+i])
                    j=-1
                else
                    j++;
            }
            if(j!=-1)
                return 1;
            i++;
        }
        return 0;
    }
    static function has(string needle, int i, string haystack) -> int {
        int i = 0;
        while(i < haystack.length){
            int j = 0;
            while(j < needle.length){
                if(needle[j] != haystack[j+i])
                    j=-1
                else
                    j++;
            }
            if(j!=-1)
                return 1;
            i++;
        }
        return 0;
    }
    static function has(int needle, string haystack) -> int {
        int i = 0;
        while(i < haystack.length){
            if(needle == haystack[i])
                return 1;
            i++;
        }
        return 0;
    }
    static function has(int needle, int i, string haystack) -> int {
        int i = 0;
        while(i < haystack.length){
            if(needle == haystack[i])
                return 1;
            i++;
        }
        return 0;
    }
    static function replace(string needle, string replacement, string haystack) -> string {
        // The replacement string can be no-longer than one replacement for each length of the needle over the haystack.
        int buffersize = (haystack.length / needle.length) * replacement.length;
        @int buffer = temp alloc(buffersize);
        int j = 0;
        int i = 0;
        while(i < haystack.length){
            int k = 0;
            while(k < needle.length){
                if(needle[k] != haystack[k+i])
                    k=-1
                else
                    k++;
            }
            if(k==-1){
                buffer[j] = haystack[i];
                i++;
                j++;
            }else{
                memcpy(&replacement[0], &buffer[j], replacement.length);
                j = j + replacement.length;
                i = i + needle.length;
            }
        }
        int i = 0;
        return stringutils.from(j, buffer);
    }
    static function replace(string needle, string replacement, int i, string haystack) -> string {
        // The replacement string can be no-longer than one replacement for each length of the needle over the haystack.
        int buffersize = (haystack.length / needle.length) * replacement.length;
        @int buffer = temp alloc(buffersize);
        int j = 0;
        while(j < i){
            buffer[j] = haystack[j];
            j++;
        }
        while(i < haystack.length){
            int k = 0;
            while(k < needle.length){
                if(needle[k] != haystack[k+i])
                    k=-1
                else
                    k++;
            }
            if(k==-1){
                buffer[j] = haystack[i];
                i++;
                j++;
            }else{
                memcpy(&replacement[0], &buffer[j], replacement.length);
                j = j + replacement.length;
                i = i + needle.length;
            }
        }
        int i = 0;
        return stringutils.from(j, buffer);
    }
    static function replaceone(string needle, string replacement, string haystack) -> string {
        int tochop = stringutils.find(needle, haystack);
        if(tochop == -1)
            return stringutils.clone(haystack);
        string start = temp stringutils.sub(0, tochop, haystack);
        string end = temp stringutils.sub(tochop + needle.length, haystack);
        start = temp stringutils.concat(start, replacement);
        string res = stringutils.concat(start, end);
        return res;
    }
    static function split(string haystack) -> array<string> {
        array<string> res = new array(haystack.length, alloc(haystack.length));
        int i = 0;
        while(i < haystack.length){
            res.data[i] = stringutils.from(1, &haystack[i]);
            i++;
        }
        return res;
    }
    static function split(string chars, string haystack) -> array<string> {
        array<string> res = new array(haystack.length, temp alloc(haystack.length));
        @int buffer = temp alloc(haystack.length);
        int bufferIndex = 0;
        int haystackIndex = 0;
        int arrayIndex = 0;
        while(haystackIndex < haystack.length){
            if(stringutils.has(haystack[haystackIndex], chars)){
                res.data[arrayIndex] = stringutils.from(bufferIndex, buffer);
                bufferIndex = 0;
                arrayIndex++;
            }else{
                *(buffer+bufferIndex) = haystack[haystackIndex]
                bufferIndex++;
            }
            haystackIndex++;
        }
        res.data[arrayIndex] = stringutils.from(bufferIndex, buffer);
        arrayIndex++;
        @string actualRes = alloc(arrayIndex);
        memcpy(res.data, actualRes, arrayIndex);
        return new array(arrayIndex, actualRes);
    }
    
    static function iswhitespace(int char) -> int {
        if(char == ' ') return 1;
        if(char == '\\t') return 1;
        if(char == '\\n') return 1;
        if(char == '\\r') return 1;
        return 0;
    }

    static function trimstart(string s) -> string {
        int i = 0;
        while(i < s.length && stringutils.iswhitespace(s[i])){
            i++;
        }
        return stringutils.sub(i, s);
    }

    static function trimend(string s) -> string {
        int i = s.length-1;
        while(i >= 0 && stringutils.iswhitespace(s[i])){
            i--;
        }
        return stringutils.sub(0, i+1, s);
    }

    static function trim(string s) -> string {
        return stringutils.trimstart(temp stringutils.trimend(s));
    }
}

metamethod get_from(typestring s)   stringutils.from;

metamethod get_concat(string s)     function(string b, string a)    stringutils.concat(a,b);
metamethod get_lower(string s)      stringutils.lower;
metamethod get_upper(string s)      stringutils.upper;
metamethod get_toint(string s)      stringutils.toint;
metamethod get_reverse(string s)    stringutils.reverse;
metamethod get_sub(string s)        stringutils.sub;
metamethod get_find(string s)       stringutils.find;
metamethod get_has(string s)        stringutils.has;
metamethod get_replace(string s)    stringutils.replace;
metamethod get_replaceone(string s) stringutils.replaceone;
metamethod get_split(string s)      stringutils.split;
metamethod get_trimstart(string s)  stringutils.trimstart;
metamethod get_trimend(string s)    stringutils.trimend;
metamethod get_trim(string s)       stringutils.trim;`)
  GenerateReadOnly("stringify.bc", `include string.bc;
include arraylist.bc;

abstract class stringifyMethod {}
metamethod cast(stringifyMethod this) -> func(void, func(int)) (this -> func(void, func(int)));
metamethod cast(func(void, func(int)) this) -> stringifyMethod (this -> stringifyMethod);

metamethod call(stringified s, func(int) iterator)
    (s.method -> func(int,func(int)))(s.n, iterator)

struct stringified {
    void n;
    stringifyMethod method;
    new(void n, stringifyMethod method){
        this.n = n;
        this.method = method;
    }
    static function deliminated(func(int) iterator, stringified seperator, params stringified[count] elements){
        int i = 0;
        while(i < count){
            if(i){
                seperator(iterator);
            };
            elements[i](iterator);
            i++;
        }
    }
    static function join(func(int) iterator, params stringified[count] elements){
        int i = 0;
        while(i < count){
            elements[i](iterator);
            i++;
        }
    }
    
    virtual function toString() -> string {
        ArrayList<int> buff = temp new ArrayList(8);
        this(int c => buff.Add(c));
        @int s = alloc(buff.Size+1);
        s[0] = buff.Size;
        int i=0;
        while(i < buff.Size){
            s[i+1] = buff[i];
            i++;
        }
        return (s -> string);
    } 
}

function intToString(int n, func(int) iterator){
    if(!n){
        iterator('0');
        return;
    }
    @int buffer = reserve 10;
    int i = 0;
    while(n){
        n,int m = n /% 10;
        buffer[i] = (m+'0');
        i++;
    }
    while(i--){
        iterator(buffer[i]);
    }
}
metamethod cast(int n) -> stringified new stringified(n, intToString);

function iterateString(string s, func(int) iterator){
    int i = 0;
    int l = s.length;
    while(i < l){
        iterator(s[i]);
        i++;
    }
}
metamethod cast(string s) -> stringified new stringified(s, iterateString);`);
  GenerateReadOnly("term.bc", `include stack.bc;
include string.bc;

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

@int numBuffer = reserve 10;
abstract class Term {    
    static function WriteLen(int length, @int data){
        while(length--)putchar(data++);
    }

    static function Write(string text){
        Term.WriteLen(text.length, text.chars);
    }
    
    static function WriteNum(int n){
        if(n==0)return putchar('0');
        int l = 0;
        while(n>0){
            n,int m = n/%10;
            *((numBuffer+4)-l) = '0' + m;
            l++;
        }
        Term.WriteLen(l, (numBuffer+5)-l);
    }
    
    static function smethod(int c){
        putchar(0x1B);
        putchar('[');
        putchar(c);
    }
    
    static function method(int n, int c){
        putchar(0x1B);
        putchar('[');
        Term.WriteNum(n);
        putchar(c);
    }
    
    // Formatting stuff
    static function format(int n){
        Term.method(n, 'm');
    }
    static __Style Style;
    static __Cursor Cursor;
    
    // Clear
    static function ClearAfter(){
        Term.smethod('J');
    }
    static function ClearBefore(){
        Term.method(1, 'J');
    }
    static function Clear(){
        Term.method(2, 'J');
    }
    
    // Events
    static function PollEvents(){
        int r = getchar();
        if(r+1){
            int low = getchar();
            int high = getchar();
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
}`);
  GenerateReadOnly("*", Object.keys(AllReadOnlys).map(c => `include ${c};`).join('\n'));
}
