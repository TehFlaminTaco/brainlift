vAllocTable: db 0
vAllocSize: db 0
alloc:
    seta vAllocTable
    setb aftercode
    putbptra
    seta vAllocSize
    apopb
    putbptra
    wAllocCond:
        seta vAllocTable
        ptra
        ptra
        jnza wAllocBody
        seta vAllocTable
        ptra
        inca
        ptra
        nota
        jnza wAllocDone
        seta vAllocTable
        ptra
        inca
        ptra
        setb vAllocSize
        ptrb
        addb 3
        cmp
        jnzb wAllocBody
        jmp wAllocDone
    wAllocBody:
        seta vAllocTable
        ptra
        setb vAllocTable
        ptrb
        incb
        ptrb
        addba
        adda 2
        setb vAllocTable
        putaptrb
        jmp wAllocCond
    wAllocDone:
    seta vAllocTable
    ptra
    inca
    ptra
    jnza fAllocSlip
    jmp fAllocSlipDone
    fAllocSlip:
        setb vAllocSize
        ptrb
        subba
        suba 2
        apusha
        seta vAllocTable
        ptra
        setb vAllocSize
        ptrb
        addba
        adda 2
        setb 0
        putbptra
        inca
        apopb
        putbptra
    fAllocSlipDone:
    seta vAllocTable
    ptra
    setb 1
    putbptra
    inca
    setb vAllocSize
    ptrb
    putbptra
    inca
    apusha
    ret

vFreeTable: db 0
vFreeTarget: db 0
vFreeLast: db 0
free:
    seta vFreeTable
    setb aftercode
    putbptra
    seta vFreeTarget
    apopb
    subb 2
    putbptra
    wFreeCond:
        seta vFreeTable
        ptra
        setb vFreeTarget
        ptrb
        cmp
        notb
        jnzb wFreeDone
        seta vFreeLast
        setb vFreeTable
        ptrb
        putbptra
        seta vFreeTable
        ptra
        setb vFreeTable
        ptrb
        incb
        ptrb
        addba
        adda 2
        setb vFreeTable
        putaptrb
        jmp wFreeCond
    wFreeDone:
    seta vFreeTable
    ptra
    setb vFreeTarget
    ptrb
    subab
    notb
    jnzb fFreeClear
    ret
    fFreeClear:
        seta vFreeTable
        ptra
        setb 0
        putbptra
        seta vFreeLast
        ptra
        ptra
        jnza fFreeDone
        seta vFreeTarget
        ptra
        inca
        ptra
        setb vFreeLast
        ptrb
        incb
        ptrb
        addab
        addb 2
        seta vFreeLast
        ptra
        inca
        putbptra
    fFreeDone:
    ret