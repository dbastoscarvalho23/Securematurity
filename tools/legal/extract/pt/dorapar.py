import re
from lib import *
def dora():
    ls,v=load('../work/dora.l.json','oj_old')
    pre,arts=structure(blocks(ls,v))
    return pre,arts
def split_paras(text):
    """split article text into numbered paragraphs n.º -> text"""
    out=[];cur=None
    for line in text.split('\n'):
        m=re.match(r'^(\d+)\.\s',line)
        if m:
            cur={'n':m.group(1),'lines':[line]}; out.append(cur)
        else:
            if cur is None:
                cur={'n':None,'lines':[line]}; out.append(cur)
            else: cur['lines'].append(line)
    for o in out: o['text']='\n'.join(o['lines'])
    return out
