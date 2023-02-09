import { GenerateReadOnly } from "./App";
var generated = false;
export function GenerateReadOnlys() {
  if (generated) return;
  generated = true;
  GenerateReadOnly(
    "array.bc",
    `class Array {
    int Length;
    @void Data;
    metamethod Array(int l){
        this.Data = alloc(l);
        this.Length = l;
    }
    
    metamethod getindex(array this, int i) -> void{
        return *(this.Data+i%this.Length);
    }
    metamethod setindex(array this, int i, void v){
        *(this.Data+i%this.Length) = v;
    }
    metamethod ptrindex(array this, int i) -> @void{
        return this.Data+i%this.Length;
    }
    function ReplaceV(func(void)->void over){
        int i = 0;
        while(i < this.Length){
            this[i] = over(this[i]);
            i++;
        }
    }
    function ReplaceK(func(int)->void over){
        int i = 0;
        while(i < this.Length){
            this[i] = over(i);
            i++;
        }
    }
    function ReplaceKV(func(int)->void over){
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
    `macro ( (assignable) (/(\\*\\*|[*\\/+-])/) "=" (expression) ) { $1 = $1 $2 $3 }
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
    `//!DEPRECATED
function pow(int a, int b) -> int{
    if(b == 1)return a;
    if(b == 0)return 1;
    if(b%2 == 1)return pow(a, b-1)*a;
    int v = pow(a, b/2);
    return v * v;
}

abstract class sint7 {
    metamethod get_sign(sint7 this) -> int {
        return (this -> int) / 64;
    }
    metamethod get_value(sint7 this) -> int {
        return (this -> int) % 64;
    }
    static function withSign(sint7 s, int sign) {
        return (s.value + (sign * 64) -> sint7);
    }
    static function withVal(sint7 s, int v) -> sint7 {
        return (v + s.sign*64 -> sint7);
    }
    metamethod add(sint7 a, sint7 b) -> sint7 {
        return (((a->int) + (b->int))%128 -> sint7);
    }
    metamethod sub(sint7 a, sint7 b) -> sint7 {
        return (((a->int) - (b->int))%128 -> sint7);
    }
    metamethod increment(sint7 a) -> sint7 {
        return (((a->int)+1)%128 -> sint7);
    }
    metamethod decrement(sint7 a) -> sint7 {
        return (((a->int)-1)%128 -> sint7);
    }
    metamethod gt(sint7 a, sint7 b) -> int {
        int as = a.sign;
        int bs = b.sign;
        if(as > bs)return bs;
        if(bs > as)return as;
        return a.value > b.value;
    }
    metamethod lt(sint7 a, sint7 b) -> int {
        int as = a.sign;
        int bs = b.sign;
        if(as > bs)return as;
        if(bs > as)return bs;
        return a.value < b.value;
    }
    metamethod eq(sint7 a, sint7 b) -> int {
        return (a -> int) == (b -> int);
    }
    metamethod cast(int i) -> sint7 {
        return (i%64 -> sint7);
    }
}

abstract class float {
    static function fromParts(int fract, sint7 exp, int sign) -> float {
        return ( fract + ((exp -> int) + sign * 128)*256 -> float);
    }

    metamethod get_high(float f) -> int {
        return (f->int)/256;
    }
    metamethod get_sign(float f) -> int {
        return f.high/128;
    }
    metamethod get_exp(float f) -> sint7 {
        return ( f.high%128 -> sint7 );
    }
    metamethod get_fract(float f) -> int {
        return (f->int)%256;
    }
    metamethod get_parts(float f) -> int, sint7, int {
        return f.fract, f.exp, f.sign;
    }
    
    static function withHigh(float f, int h) -> float {
        return ( f.sign + (h * 256) -> float );
    }
    static function withSign(float f, int sign) -> float {
        return float.fromParts(f.fract, f.exp, sign);
    }
    static function withExp(float f, sint7 exp) -> float {
        return float.fromParts(f.fract, exp, f.sign);
    }
    
    static function shiftExp(float f, sint7 amount) -> float {
        int ff, sint7 fe, int fs = f.parts;
        if(amount < 0){
            while(amount!=0){
                ff = ff * 2;
                amount++;
                fe--;
            }
        }else{
            while(amount!=0){
                ff = ff / 2;
                amount--;
                fe++;
            }
        }
        ff = ff % 256;
        return float.fromParts(ff, fe, fs);
    }
    
    metamethod get_neg(float f) -> float {
        return float.withSign(f, 1 - f.sign);
    }
    
    metamethod add(float a, float b) -> float {
        int as = a.sign;
        int bs = b.sign;
        if(bs != as)return a - b.neg;
        sint7 ae = a.exp;
        sint7 be = b.exp;
        sint7 e = ae;
        if(be > ae)e = be;
        a = float.shiftExp(a, e - ae);
        b = float.shiftExp(b, e - be);
        int af = a.fract;
        int bf = b.fract;
        int f = af + bf;
        while(f >= 256){
            f = f / 2;
            e = e + 1;
        }
        return float.fromParts(f, e, as);
    }
    metamethod sub(float a, float b) -> float {
        int as = a.sign;
        int bs = b.sign;
        if(bs != as)return a - b.neg;
        sint7 ae = a.exp;
        sint7 be = b.exp;
        sint7 e = ae;
        if(be > ae)e = be;
        a = float.shiftExp(a, e - ae);
        b = float.shiftExp(b, e - be);
        int af = a.fract;
        int bf = b.fract;
        int f = (af - bf)%256;
        if(bf > af){
            f = (bf - af)%256;
            as = 1 - as;
        }
        return float.fromParts(f, e, as);
    }
    metamethod mul(float a, float b) -> float {
        int as = a.sign;
        int bs = b.sign
        int s = as != bs;
        sint7 ae = a.exp;
        sint7 be = b.exp;
        sint7 e = ae;
        if(ae < be){a = float.shiftExp(a, be - ae); e = be}
        else b = float.shiftExp(b, ae - be);
        
        int af = a.fract;
        int bf = b.fract;
        int f = af * bf;
        while(f >= 256){
            f = f / 2;
            e++;
        }
        return float.fromParts(f, e, s);
    }
    metamethod div(float a, float b) -> float {
        int as = a.sign;
        int bs = b.sign;
        int s = as != bs;
        sint7 ae = a.exp;
        sint7 be = b.exp;
        sint7 e = ae;
        if(ae < be){a = float.shiftExp(a, be - ae); e = be}
        else b = float.shiftExp(b, ae - be);
        
        int af = a.fract;
        int bf = b.fract;
        int f, int m = af /% bf;
        m = m * (256 / bf);
        int leadingZeroes = 0;
        while((leadingZeroes < 8) * (m%pow(2,leadingZeroes) == 0)){
            leadingZeroes++;
        }
        while((leadingZeroes < 8) * (f < 128)){
            f = f * 2;
            m = m * 2;
            f = f + (m/256);
            m = m % 256;
            e--;
            leadingZeroes++;
        }
        return float.fromParts(f, e, s);
    }
}`
  );
  GenerateReadOnly(
    "random.bc",
    `int seed = 1;

function rand() -> int{
    seed = (seed * 128) + seed + 85;
    return seed;
}`
  );
  GenerateReadOnly(
    "stack.bc",
    `class Stack {
    int Capacity;
    int Length;
    @void Data;
    
    metamethod Stack(){
        this.Capacity = 8;
        this.Data = alloc(8);
    }
    
    metamethod Stack(int cap){
        this.Capacity = cap;
        this.Data = alloc(cap);
    }
    
    function Push(void v){
        if(this.Length == this.Capacity){
            @void newBuff = alloc(this.Capacity * 2);
            int i = 0;
            while(i < this.Length){
                *(newBuff + i) = *(this.Data + i);
                i++;
            }
            this.Capacity = this.Capacity * 2;
            @void oldData = this.Data;
            this.Data = newBuff;
            free(oldData);
        };
        *(this.Data + this.Length) = v;
        this.Length++;
    }
    function Pop() -> void {
        if(this.Length){
            this.Length--;
            return *(this.Data + this.Length);
        }
        return 0;
    }
    function Peek() -> void {
        if(this.Length) return *(this.Data + this.Length - 1);
        return 0;
    }
    function Has() -> int {
        if this.Length return 1;
        return 0;
    }
    metamethod getindex(Stack this, int i) -> void{
        return *(this.Data+i%this.Length);
    }
    metamethod setindex(Stack this, int i, void v){
        *(this.Data+i%this.Length) = v;
    }
    metamethod ptrindex(Stack this, int i) -> @void{
        return this.Data+i%this.Length;
    }
}`
  );
  GenerateReadOnly(
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

class String : Array {
    metamethod String(int l, @int d){
        this.Length = l;
        this.Data = d;
    }
    function Write() -> string{
        var l = this.Length;
        var d = this.Data;
        while(l--){
            charwrite(*d++);
        }
        return this;
    }
    function Upper() -> string{
        this.ReplaceV(charupper);
        return this;
    }
    function Lower() -> string{
        this.ReplaceV(charlower);
        return this;
    }
    static string ZERO;
    
    static function From(int i) -> string {
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

  GenerateReadOnly(
    "term.bc",
    `include stack.bc;

abstract class Color3B {
    metamethod get_R(Color3B c) -> int {
        return (c->int)%2;
    }
    metamethod get_G(Color3B c) -> int {
        return ((c->int)/2)%2;
    }
    metamethod get_B(Color3B c) -> int {
        return ((c->int)/4)%2;
    }
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

int _, @int numBuffer = "00000";
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
    
    static function Write(int length, @int data){
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
        Term.Write(l, (numBuffer+5)-l);
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
    
    
    
    static Stack KeyDown;
    static Stack KeyUp;
    static Stack Click;
    static Stack Frame;
}

Term.KeyDown = new Stack(1);
Term.KeyUp = new Stack(1);
Term.Click = new Stack(1);
Term.Frame = new Stack(1);

class __Style {
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
    metamethod __Style(){};
}

class __Cursor {
    metamethod get_X(__Cursor c) -> void {return 0};
    metamethod get_Y(__Cursor c) -> void {return 0};
    metamethod get_Up(__Cursor c) -> void {return 0};
    metamethod get_Down(__Cursor c) -> void {return 0};
    metamethod get_Left(__Cursor c) -> void {return 0};
    metamethod get_Right(__Cursor c) -> void {return 0};
    
    metamethod set_X(__Cursor c, int x){ return Term.method(x, 'G') }
    metamethod set_Y(__Cursor c, int y){ return Term.method(y, 'H') }
    function Up(int n){ return Term.method(n, 'A') }
    function Down(int n){ return Term.method(n, 'B') }
    function Left(int n){ return Term.method(n, 'D') }
    function Right(int n){ return Term.method(n, 'C') }
    function Push(){ return Term.smethod('s') }
    function Pop(){ return Term.smethod('u') }
    function Reset(){ return Term.smethod('H') }
    function NextLine(){ return Term.method(1, 'E') }
    function PrevLine(){ return Term.method(1, 'F') }
    metamethod __Cursor(){};
}

Term.Style = new __Style();
Term.Cursor = new __Cursor();`
  );
  GenerateReadOnly(
    "tree.bc",
    `include stack.bc;
void NULL;

class Branch {
    @Branch Anchor;
    Branch Left;
    int High;
    int Key;
    void Value;
    Branch Right;
    
    metamethod Branch(@Branch Anchor, int High, int Key, void Value){
        this.Anchor = Anchor;
        this.High = High;
        this.Key = Key;
        this.Value = Value;
    }
    
    function FillStack(Stack s){
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
    
    function Each(func(int, void) method){
        if(this.Left)this.Left.Each(method);
        method(this.Key, this.Value);
        if(this.Right)this.Right.Each(method);
    }
    
    function Get(int key) -> void {
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
    function Set(int key, void val) {
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

class Tree {
    Branch Root;
    
    function ToStack() -> Stack {
        Stack s = new Stack();
        if(this.Root)this.Root.FillStack(s);
        return s;
    }
    
    function Rebalance() {
        Stack s = this.ToStack();
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
    
    function Fill(Stack s, int low, int high){
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
    
    function Each(func(int,int) method){
        if(this.Root)this.Root.Each(method);
    }
    
    metamethod getindex(Tree this, int i) -> void{
        if(this.Root)return this.Root.Get(i);
        return NULL;
    }
    
    metamethod setindex(Tree this, int i, void v){
        if(this.Root)return this.Root.Set(i, v);
        this.Root = new Branch(&this.Root, 1, i, v);
    }
    
    metamethod Tree(){}
}`
  );
}
