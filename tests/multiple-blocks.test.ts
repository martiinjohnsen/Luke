import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyDoor,addDoorBlock,patchDoorBlock,removeDoorBlock,doorBlockOrder,blockDoor,remainingBlocks,isCalendar,createCalendar,questionsForDoor,blockQuestionOffset,isDoorComplete,parseBackup,blockLimit,type Door} from '../src/lib/model.ts';
import {initialData} from '../src/lib/templates.ts';
import {ownedDocument} from '../src/lib/cloud/workspace.ts';
import {questionKey,quizSummary} from '../src/lib/quiz-progress.ts';
import {validateDoor,issuesForBlock,ISSUE_SCOPE} from '../src/lib/door-validation.ts';
import {calendarCollection} from '../src/lib/calendar-collection.ts';
import {stageNewMedia,needsMediaMigration} from '../src/lib/media-workspace.ts';
import {shuffledDoors} from '../src/lib/door-layout.ts';
import {leaderboard,type Participant} from '../src/lib/participants.ts';
const question={title:'Farge?',options:['Lilla','Grønn'],answerIndex:0,explanation:'Lilla'};
const make=()=>createCalendar({title:'Min kalender',recipient:'Deg',sender:'Meg',year:2025,theme:'advent'});
test('three independent images keep draggable order, remaining counts and attachments after round-trip',()=>{
  const calendar=make();let door=emptyDoor(1);
  for(let n=1;n<=3;n++){door=addDoorBlock(door,'image',{image:'data:image/png;base64,AAAA',imageAlt:`Bilde ${n}`})!.door;assert.equal(remainingBlocks(door,'image'),3-n);}
  assert.equal(addDoorBlock(door,'image',{}),null);
  door.contentOrder=['image:3','image','image:2'];calendar.doors[0]=door;
  assert.equal(isCalendar(calendar),true);assert.equal(isDoorComplete(door),true);
  const restored=parseBackup(JSON.stringify({...initialData(),calendars:[calendar]})).calendars[0];assert.deepEqual(restored.doors[0],door);
  const items=calendarCollection(restored,[1],24);assert.deepEqual(items.map(i=>i.id),['1-image:3','1-image','1-image:2']);
  const removed=removeDoorBlock(door,'image:2');assert.deepEqual(doorBlockOrder(removed),['image:3','image']);assert.equal(remainingBlocks(removed,'image'),1);
  assert.equal(blockDoor(door,'image:2').imageAlt,'Bilde 2');assert.equal(remainingBlocks(door,'image'),0);
  assert.equal(addDoorBlock(removed,'image',{image:'data:image/png;base64,AAAA'})!.id,'image:2');
});
test('previously saved additional quiz boxes preserve original question keys and use fixed offsets despite visual reorders',()=>{
  const calendar=make();const original={...emptyDoor(1),questions:[question]};const key=questionKey(1,0,question);
  const door:Door={...original,contentOrder:['quiz','quiz:2','quiz:3'],extra:{
    'quiz:2':{...emptyDoor(1),contentOrder:['quiz'],questions:[question]},
    'quiz:3':{...emptyDoor(1),contentOrder:['quiz'],questions:[{...question,title:'Andre?'}]}
  }};calendar.doors[0]=door;
  assert.equal(isCalendar(calendar),true);assert.equal(remainingBlocks(door,'quiz'),0);assert.equal(addDoorBlock(door,'quiz',{}),null);
  assert.equal(questionsForDoor(door,calendar).length,3);assert.equal(blockQuestionOffset(door,'quiz:3',calendar),2);
  door.contentOrder=['quiz:3','quiz:2','quiz'];assert.equal(questionKey(1,0,questionsForDoor(door,calendar)[0]),key);
  assert.equal(quizSummary(calendar,{[key]:{answer:0}}).correct,1);
  assert.equal(quizSummary(calendar,{[key]:{answer:0}}).total,3);
  assert.equal(ownedDocument(calendar).quizCounts!['1'],3);
});
test('an invalid second attachment identifies its own field without flagging or changing the first',()=>{
  const door=addDoorBlock({...emptyDoor(1),image:'data:image/png;base64,AAAA'},'image',{image:''})!.door;
  const issues=validateDoor(door);assert.equal(issues.image,undefined);assert.ok(issues['image:2/image']);
  assert.ok(issuesForBlock(issues,'image:2').image);assert.equal(issuesForBlock(issues,'image:2')[ISSUE_SCOPE],'image:2-');
  assert.equal(issuesForBlock(issues,'image').image,undefined);
  assert.equal(isDoorComplete(door),false);assert.equal(isDoorComplete(patchDoorBlock(door,'image:2',{image:'data:image/png;base64,BBBB'})),true);
});
test('extra media is staged and migrated with its slot intact, without mutating the source',()=>{
  const c=make();c.doors[0]=addDoorBlock({...emptyDoor(1),audio:'data:audio/webm;base64,AAAA'},'audio',{audio:'data:audio/webm;base64,BBBB'})!.door;
  const before=structuredClone(c);assert.equal(needsMediaMigration(c),true);
  const staged=stageNewMedia({...initialData(),calendars:[c]},{},new Set([c.id]));
  assert.equal(staged.data.calendars[0].doors[0].audio,'');assert.equal(blockDoor(staged.data.calendars[0].doors[0],'audio:2').audio,'');assert.deepEqual(c,before);assert.equal(isCalendar(staged.data.calendars[0]),true);
});
test('invalid fourth slots, nested extras and hidden content are rejected without invalidating legacy data',()=>{
  const c=make();c.doors[0]={...emptyDoor(1),link:{label:'En',url:'https://example.com'},contentOrder:['link','link:2'],extra:{'link:2':{...emptyDoor(1),contentOrder:['link'],link:{label:'To',url:'https://example.com'}}}};
  assert.equal(isCalendar(c),true);
  const fourth=structuredClone(c);(fourth.doors[0].extra as Record<string,unknown>)['link:4']=emptyDoor(1);assert.equal(isCalendar(fourth),false);
  const nested=structuredClone(c);nested.doors[0].extra!['link:2']!.extra={};assert.equal(isCalendar(nested),false);
  const hidden=structuredClone(c);hidden.doors[0].extra!['link:2']!.image='data:image/png;base64,AAAA';assert.equal(isCalendar(hidden),false);
});
test('recipient door positions stay shuffled and stable across devices, without changing numeric editor order',()=>{
  const c=make(),before=c.doors.map(d=>d.day),a=shuffledDoors(c.doors,'calendar-a').map(d=>d.day);
  assert.notDeepEqual(a,before);assert.deepEqual(a,shuffledDoors([...c.doors].reverse(),'calendar-a').map(d=>d.day));assert.deepEqual(c.doors.map(d=>d.day),before);
  assert.deepEqual(a.slice().sort((a,b)=>a-b),before);assert.notDeepEqual(a,shuffledDoors(c.doors,'calendar-b').map(d=>d.day));
});
test('leaderboard ties share a rank and source snapshots retain their original order',()=>{
  const p=(id:string,correct:number)=>({id,name:id,summary:{total:4,correct,answered:4,unlocked:4,days:[]},self:false,opened:[],openedCount:0,joinedAt:''}) satisfies Participant;
  const people=[p('C',1),p('B',3),p('A',3)];assert.deepEqual(leaderboard(people).map(({person,rank})=>[person.id,rank]),[['A',1],['B',1],['C',3]]);assert.deepEqual(people.map(p=>p.id),['C','B','A']);
});
test('only gifts, images and audio allow three boxes while other add-menu types allow one',()=>{
  const c=make();let d=emptyDoor(1);
  const patches={
    giftcard:{giftCard:{merchant:'Butikk',amount:100,currency:'NOK',code:'CODE',url:'',expiresOn:''}},
    image:{image:'data:image/png;base64,AAAA'},audio:{audio:'data:audio/mp4;base64,AAAA'},
    video:{videoUrl:'https://www.youtube.com/watch?v=dQw4w9WgXcQ'},
    link:{link:{label:'Lenke',url:'https://example.com'}},quiz:{questions:[question]},activity:{activity:{title:'Tur',body:'Ta en tur'}}
  } satisfies Record<string,Partial<typeof d>>;
  for(const kind of Object.keys(patches) as (keyof typeof patches)[]) for(let n=0;n<blockLimit(kind);n++) d=addDoorBlock(d,kind,structuredClone(patches[kind]))!.door;
  c.doors[0]=d;assert.equal(doorBlockOrder(d).length,13);assert.equal(isCalendar(c),true);assert.equal(isDoorComplete(d),true);assert.deepEqual(validateDoor(d),{});
  assert.deepEqual(parseBackup(JSON.stringify({...initialData(),calendars:[c]})).calendars[0].doors[0],d);
  assert.equal(calendarCollection(c,[1],24).length,12);
  for(const kind of Object.keys(patches) as (keyof typeof patches)[]) {assert.equal(remainingBlocks(d,kind),0);assert.equal(addDoorBlock(d,kind,{}),null);}
  assert.equal(questionsForDoor(d,c).length,1);
});
