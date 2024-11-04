import { GenerateReadOnly, AllReadOnlys } from "./App";
var generated = false;
export function GenerateReadOnlys() {
  if (generated) return;
  generated = true;
  GenerateReadOnly("array.bc", `class Array<T> {
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
            while(i < this.Capacity)
                newBuff[i] = this.Data[i];
            free(this.Data);
            this.Data = newBuff;
            this.Capacity = this.Capacity * 2;
        }
    }

    virtual function Iterate(func(T) iterator) {
        int i = 0;
        while(i < this.Size){
            iterator(*(this.Data+(i++)));
        }
    }
}

metamethod getindex<T>(Array<T> this, int index) -> T {
    return *(this.Data+(index%this.Size));
}
metamethod setindex<T>(Array<T> this, int index, T value) {
    *(this.Data+(index%this.Size)) = value;
}
metamethod ptrindex<T>(Array<T> this, int index) -> @T {
    return (this.Data+(index%this.Size));
}`);
  GenerateReadOnly("extmacros.bc", "macro ( (assignable) (/\\/%|<<|>>|<=|>=|==|!=|&&|\\|\\||[*^\\/%+<>&~|-]/) \"=\" (expression) ) { $1 = $1 $2 $3 }\nmacro ( 'for' \"(\" (expression?) \";\" (expression?) \";\" (expression?) \")\" (expression) ) {\n    {\n        $1;\n        while($2){\n            $4;\n            $3;\n        }\n    }\n}\nmacro ( 'new' type '[]' '{' '}' ){{}}\nmacro ( 'new' (type) '[]' '{'  ','? (expression) ((',' expression)*) '}' ) {{\n    $1 a = $2;\n    new $1[]{$3};\n    &a;\n}}\nmacro ( 'new' (type) '[' (number) ']' ){ (reserve $2 -> @$1) };\n");
  GenerateReadOnly("int.bc", "metamethod pow(int _a, int _b) -> int {\n    if(!_b)\n        return 1;\n    if(_b == 1)\n        return _a;\n    int _result = 1;\n    while(_b > 0){\n        if(!(_b%2)){\n            _b = _b / 2;\n            _a = _a * _a;\n        }else{\n            _b = _b - 1\n            _result = _result * _a;\n            _b = _b / 2;\n            _a = _a * _a\n        }\n    }\n    return _result;\n}\nmetamethod bshl(int _a, int _b) -> int {\n    return _a * (2 ^ _b);\n}\nmetamethod bshr(int _a, int _b) -> int {\n    return _a / (2 ^ _b);\n}\nmetamethod band(int _a, int _b) -> int {\n    int _o = 0;\n    int _i = 1;\n    while (_i){\n        _o = _o + ((_a%2)*(_b%2))*_i;\n        _i = _i * 2;\n        _a = _a / 2;\n        _b = _b / 2;\n    }\n    return _o;\n}\nmetamethod bor(int _a, int _b) -> int {\n    int _o = 0;\n    int _i = 1;\n    while (_i){\n        _o = _o + !(!(_a%2)*!(_b%2))*_i;\n        _i = _i * 2;\n        _a = _a / 2;\n        _b = _b / 2;\n    }\n    return _o;\n}\nmetamethod bxor(int _a, int _b) -> int {\n    int _o = 0;\n    int _i = 1;\n    while (_i){\n        _o = _o + (_a%2!=_b%2)*_i;\n        _i = _i * 2;\n        _a = _a / 2;\n        _b = _b / 2;\n    }\n    return _o;\n}\n\n// int can cast to everything implicitely, via modulo\n// Whilst int acts as an insigned value generally, we allow it to be cast to signed values destructively.\nmetamethod cast(int _i) -> u32 (_i -> u32);\nmetamethod cast(int _i) -> s32 (_i -> s32);\n// Likewise, everything can cast to int implicitly\nmetamethod cast(u32 _i) -> int (_i -> int);\nmetamethod cast(s32 _i) -> int (_i -> int);\n// u32s can cast to u16 and u8, and so on (Including in reverse)\nmetamethod cast(u32 _i) -> u16 ((_i -> int) % 0x10000 -> u16);\nmetamethod cast(u32 _i) -> u8  ((_i -> int) % 0x100 -> u8);\nmetamethod cast(u16 _i) -> u32 ((_i -> int) -> u32);\nmetamethod cast(u16 _i) -> u8  ((_i -> int) % 0x100 -> u8);\nmetamethod cast(u8  _i) -> u32 ((_i -> int) -> u32);\nmetamethod cast(u8  _i) -> u16 ((_i -> int) -> u16);\n// Same with signed values, although special attention must be paid to the sign bit\n// To go from s32, we take the value % 0x8000, which leaves 15 bits of data and the sign bit\n// We transfer the sign bit by adding (_i / 0x80000000) * 0x8000, Same for the other bits and values\nmetamethod cast(s32 _i) -> s16 (\n    ((_i -> int) % 0x8000) + ((_i -> int) / 0x80000000) * 0x8000 -> s16\n);\nmetamethod cast(s32 _i) -> s8 (\n    ((_i -> int) % 0x80) + ((_i -> int) / 0x80000000) * 0x80 -> s8\n);\nmetamethod cast(s16 _i) -> s32 (\n    ((_i -> int) % 0x8000) + ((_i -> int) / 0x8000) * 0x80000000 -> s32\n);\nmetamethod cast(s16 _i) -> s8 (\n    ((_i -> int) % 0x80) + ((_i -> int) / 0x8000) * 0x80 -> s8\n);\nmetamethod cast(s8 _i) -> s32 (\n    ((_i -> int) % 0x8000) + ((_i -> int) / 0x80) * 0x80000000 -> s32\n);\nmetamethod cast(s8 _i) -> s16 (\n    ((_i -> int) % 0x80) + ((_i -> int) / 0x80) * 0x8000 -> s16\n);\n// Finally, u32 cast to s32 and so on, though without the sign bit\nmetamethod get_signed(u32 _i) -> s32 ((_i -> int) % 0x80000000 -> s32);\nmetamethod get_unsigned(s32 _i) -> u32 ((_i -> int) % 0x80000000 -> u32);\n\nmetamethod lt(s32 _a, s32 _b) -> int ((_a -> int)+0x80000000) < ((_b -> int)+0x80000000) ;\nmetamethod gt(s32 _a, s32 _b) -> int ((_a -> int)+0x80000000) > ((_b -> int)+0x80000000) ;\nmetamethod le(s32 _a, s32 _b) -> int ((_a -> int)+0x80000000) <= ((_b -> int)+0x80000000) ;\nmetamethod ge(s32 _a, s32 _b) -> int ((_a -> int)+0x80000000) >= ((_b -> int)+0x80000000) ;\n\nabstract class u32 {}\nabstract class u16 {}\nabstract class u8  {}\nabstract class s32 {}\nabstract class s16 {}\nabstract class s8  {}");
  GenerateReadOnly("io.bc", `include stringify.bc;
include array.bc;

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
function getchar() -> int{
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
  GenerateReadOnly("pair.bc", "struct pair<A,B> {\n    A a;\n    B b;\n    new(void a, void b){\n        this.a = a;\n        this.b = b;\n    };\n}");
  GenerateReadOnly("stack.bc", "metamethod getindex<T>(Stack<T> this, int i) -> T{\n    return *(this.Data+i%this.Length);\n}\nmetamethod setindex<T>(Stack<T> this, int i, T v){\n    *(this.Data+i%this.Length) = v;\n}\nmetamethod ptrindex<T>(Stack<T> this, int i) -> @T{\n    return this.Data+i%this.Length;\n}\n\nclass Stack<T> {\n    int Capacity;\n    int Length;\n    @T Data;\n    \n    new(){\n        this.Capacity = 8;\n        this.Data = alloc(8);\n    }\n    \n    new(int cap){\n        this.Capacity = cap;\n        this.Data = alloc(cap);\n    }\n     \n    virtual function Push(T v){\n        if(this.Length == this.Capacity){\n            @T newBuff = alloc(this.Capacity * 2);\n            int i = 0;\n            while(i < this.Length){\n                *(newBuff + i) = *(this.Data + i);\n                i++;\n            }\n            this.Capacity = this.Capacity * 2;\n            @T oldData = this.Data;\n            this.Data = newBuff;\n            free(oldData);\n        };\n        *(this.Data + this.Length) = v;\n        this.Length++;\n    }\n    virtual function Pop() -> T {\n        if(this.Length){\n            this.Length--;\n            return *(this.Data + this.Length);\n        }\n        return (0 -> T);\n    }\n    virtual function Peek() -> T {\n        if(this.Length) return *(this.Data + this.Length - 1);\n        return (0 -> T);\n    }\n    virtual function Has() -> int {\n        if this.Length return 1;\n        return 0;\n    }\n}");
  GenerateReadOnly("string.bc", "abstract class string {}\nmetamethod get_length(string this) -> int *(this -> @int);\nmetamethod get_chars(string this) -> @int 1+(this -> @int);\nmetamethod getindex(string this, int index) -> int this.chars[index % this.length];\nmetamethod setindex(string this, int index, int value) -> int this.chars[index % this.length] = value;\nmetamethod ptrindex(string this, int index) -> @int &this.chars[index % this.length]");
  GenerateReadOnly("stringify.bc", `include string.bc;

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
