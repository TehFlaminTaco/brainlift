%macro apush

%macro apusha
    mov [r10], r8
    add r10, 8
%endmacro
%macro apushb
    mov [r10], r0
    add r10, 8
%endmacro


section	.text
	global _start       ;must be declared for using gcc

_start:                     ;tell linker entry point
    mov r10, astack
    mov r11, bstack
    
    mov rax, 'G'
    mov [r9], rax
    add r9, 8
    
	mov	rdx, len    ;message length
	mov	rcx, msg    ;message to write
    
    sub r9, 8
    mov rax, [r9]
    mov [rcx], al
    
	mov	rbx, 1	    ;file descriptor (stdout)
	mov	rax, 4	    ;system call number (sys_write)
	int	0x80        ;call kernel
	mov	rax, 1	    ;system call number (sys_exit)
	int	0x80        ;call kernel

section .data
msg:	db	'Hello, world!',0xa	;our dear string
len:	equ	$ - msg			;length of our dear string	
 
section .bss
astack: resq 1024
bstack: resq 256

