import test from 'node:test';
import assert from 'node:assert/strict';
import {recipientEmail,emailInvitation} from '../src/lib/personal-sharing.ts';
test('personal sharing accepts one email address and rejects multiple recipients or header injections',()=>{
  assert.equal(recipientEmail(' Person+jul@Example.NO '),'person+jul@example.no');
  for(const value of ['','person','a@b.no,c@d.no','a@b.no;c@d.no','a@b.no\r\nBcc:second@example.no','Name <a@b.no>','a@b.no?bcc=x','a@-bad.no']) assert.equal(recipientEmail(value),null,value);
});
test('email drafts preserve the personal message and private invitation without adding recipients or leaking data into headers',()=>{
  const link='https://luke.example/receive#invite='+'a'.repeat(64);
  const draft=emailInvitation({email:'venn+jul@example.no',title:'Desember & glede?\nBcc: injected',message:'God jul!\nKlem ❤️',sender:'Martin',link});
  assert.ok(draft.href.startsWith('mailto:venn%2Bjul@example.no?'));
  const fields=new URLSearchParams(draft.href.split('?')[1]);
  assert.deepEqual([...fields.keys()],['subject','body']);assert.ok(!fields.get('subject')!.includes('\n'));
  assert.ok(fields.get('body')!.includes('God jul!\r\nKlem ❤️'));assert.ok(fields.get('body')!.includes(link));
  assert.ok(draft.text.includes('Google-kontoen venn+jul@example.no'));assert.ok(draft.text.endsWith('Hilsen Martin'));
  assert.throws(()=>emailInvitation({email:'a@b.no,c@d.no',title:'Hei',message:'',sender:'',link}));
});

test('group emails normalize and deduplicate addresses while enforcing separate sharing modes',async()=>{
  const {invitationEmails}=await import('../src/lib/personal-sharing.ts');
  assert.deepEqual(invitationEmails(' ONE@example.no;two@example.no\none@example.no','group'),['one@example.no','two@example.no']);
  assert.deepEqual(invitationEmails('one@example.no','person'),['one@example.no']);
  for(const [value,kind] of [['a@example.no,b@example.no','person'],['a@example.no','group'],['a@example.no\nNot an email','group'],['Name <a@example.no>','person'],['','group']] as const) assert.throws(()=>invitationEmails(value,kind));
  assert.throws(()=>invitationEmails(Array.from({length:51},(_,n)=>`${n}@example.no`).join(','),'group'));
});
test('group email drafts use Bcc and never include recipients in the body or invitation URL',async()=>{
  const {groupEmailInvitation}=await import('../src/lib/personal-sharing.ts');
  const link='https://luke.example/receive#invite='+'b'.repeat(64);
  const draft=groupEmailInvitation({emails:['second@example.no','first+jul@example.no'],title:'Jul?\nBcc: bad',message:'God jul!\n❤️',sender:'Martin',link});
  const fields=new URLSearchParams(draft.href.split('?')[1]);
  assert.ok(draft.href.startsWith('mailto:?bcc='));
  assert.deepEqual([...fields.keys()],['bcc','subject','body']);
  assert.equal(fields.get('bcc'),'first+jul@example.no,second@example.no');
  assert.ok(!fields.get('subject')!.includes('\n'));
  assert.ok(fields.get('body')!.includes(link));assert.ok(fields.get('body')!.includes('God jul!\r\n❤️'));
  assert.ok(!draft.text.includes('first+jul@example.no'));assert.ok(!draft.text.includes('second@example.no'));
});
