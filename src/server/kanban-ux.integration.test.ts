import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {agendaFixture} from './agenda-test-fixture.js';

test('Kanban retries create one record and auxiliary join/leave is idempotent and reentrant',async()=>{
  const f=await agendaFixture();
  try{
    const workspace='1a4e0bd0-5f4a-4d10-8000-000000000201';
    await f.service.manageWorkspace(f.actors.owner,workspace,{addMembershipId:f.ids.member});
    const board=(await f.apps.owner.inject({url:'/api/workspaces/'+workspace+'/boards'})).json()[0];
    const columns=(await f.apps.owner.inject({url:'/api/boards/'+board.id})).json().columns;
    const payload={title:'Cartão fictício de reenvio',columnId:columns[0].id};
    const key=randomUUID(),headers={'idempotency-key':key},url='/api/boards/'+board.id+'/cards';
    const responses=await Promise.all(Array.from({length:6},()=>f.apps.owner.inject({method:'POST',url,headers,payload})));
    responses.forEach(r=>assert.equal(r.statusCode,201,r.body));
    const cardId=responses[0].json().id;
    assert(responses.every(r=>r.json().id===cardId));
    assert.equal((await f.db.one<any>('SELECT COUNT(*) n FROM cards WHERE id=?',[cardId])).n,1);
    assert.equal((await f.db.one<any>("SELECT COUNT(*) n FROM card_activities WHERE card_id=? AND action='card.created'",[cardId])).n,1);
    assert.equal((await f.apps.owner.inject({method:'POST',url,headers,payload:{...payload,title:'Outro título fictício'}})).statusCode,409);
    const viewerComment=await f.apps.member.inject({method:'POST',url:'/api/cards/'+cardId+'/comments',payload:{body:'Comentário de quem apenas visualiza'}});
    assert.equal(viewerComment.statusCode,201,viewerComment.body);
    let viewerDetail=(await f.apps.member.inject({url:'/api/cards/'+cardId})).json();
    assert.equal(viewerDetail.permissions.edit,false);assert.equal(viewerDetail.permissions.comment,true);
    assert.equal(viewerDetail.comments.find((comment:any)=>comment.id===viewerComment.json().id)?.canDelete,true);
    assert.equal((await f.apps.member.inject({method:'DELETE',url:'/api/comments/'+viewerComment.json().id})).statusCode,204);
    for(const [endpoint,body] of [['checklist',{content:'Item fictício'}],['comments',{body:'Comentário fictício'}]] as const){
      const commandKey=randomUUID(),commandUrl='/api/cards/'+cardId+'/'+endpoint;
      const results=await Promise.all(Array.from({length:4},()=>f.apps.owner.inject({method:'POST',url:commandUrl,headers:{'idempotency-key':commandKey},payload:body})));
      results.forEach(r=>assert.equal(r.statusCode,201,r.body));assert(results.every(r=>r.json().id===results[0].json().id));
    }
    const columnKey=randomUUID();
    const added=await Promise.all(Array.from({length:4},()=>f.apps.owner.inject({method:'POST',url:'/api/boards/'+board.id+'/columns',headers:{'idempotency-key':columnKey},payload:{name:'Coluna fictícia única'}})));
    added.forEach(r=>assert.equal(r.statusCode,201,r.body));assert(added.every(r=>r.json().id===added[0].json().id));
    assert.equal((await f.apps.owner.inject({method:'DELETE',url:'/api/columns/'+added[0].json().id+'?targetColumnId='+columns[0].id})).statusCode,204);
    const helperUrl='/api/cards/'+cardId+'/helpers/me';
    const join=()=>f.apps.member.inject({method:'POST',url:helperUrl});
    const leave=()=>f.apps.member.inject({method:'DELETE',url:helperUrl});
    (await Promise.all([join(),join(),join()])).forEach(r=>assert.equal(r.statusCode,200,r.body));
    let detail=(await f.apps.member.inject({url:'/api/cards/'+cardId})).json();assert.equal(detail.helpers.length,1);
    assert.equal(detail.activities.filter((a:any)=>a.action==='helper.joined').length,1);
    let projection=(await f.apps.member.inject({url:'/api/foundation'})).json().boards.find((b:any)=>b.id===board.id).columns.flatMap((c:any)=>c.cards).find((c:any)=>c.id===cardId);
    assert.equal(projection.isHelper,true);assert.equal(projection.canMove,true);
    (await Promise.all([leave(),leave(),leave()])).forEach(r=>assert.equal(r.statusCode,204,r.body));
    detail=(await f.apps.member.inject({url:'/api/cards/'+cardId})).json();assert.equal(detail.helpers.length,0);assert.equal(detail.activities.filter((a:any)=>a.action==='helper.left').length,1);
    projection=(await f.apps.member.inject({url:'/api/boards/'+board.id})).json().columns.flatMap((c:any)=>c.cards).find((c:any)=>c.id===cardId);
    assert.equal(projection.isHelper,false);assert.equal(projection.canMove,false);
    assert.equal((await join()).statusCode,200);detail=(await f.apps.member.inject({url:'/api/cards/'+cardId})).json();assert.equal(detail.helpers.length,1);
    assert.equal(detail.activities.filter((a:any)=>a.action==='helper.joined').length,2);
    assert.equal((await f.apps.owner.inject({method:'DELETE',url:'/api/cards/'+cardId+'/helpers/'+f.ids.member})).statusCode,204);
    assert.equal((await f.apps.member.inject({url:'/api/cards/'+cardId})).json().helpers.length,0);
    const disposableItem=(await f.apps.owner.inject({method:'POST',url:'/api/cards/'+cardId+'/checklist',payload:{content:'Item removível'}})).json().id;
    assert.equal((await f.apps.owner.inject({method:'DELETE',url:'/api/checklist/'+disposableItem})).statusCode,204);
    const restricted=(await f.apps.owner.inject({method:'POST',url,payload:{...payload,visibility:'directors'}})).json().id;
    assert.equal((await f.apps.member.inject({method:'POST',url:'/api/cards/'+restricted+'/helpers/me'})).statusCode,404);
    assert.equal((await f.apps.other.inject({method:'POST',url:helperUrl})).statusCode,404);
    const detailAfter=(await f.apps.owner.inject({url:'/api/cards/'+cardId})).json();
    assert.equal(detailAfter.comments.length,1);assert.equal(detailAfter.checklist.length,1);
    const moveUrl='/api/cards/'+cardId+'/move',movePayload={columnId:columns[1].id,version:1};
    const moves=await Promise.all(Array.from({length:3},()=>f.apps.owner.inject({method:'POST',url:moveUrl,payload:movePayload})));
    moves.forEach(r=>assert.equal(r.statusCode,200,r.body));
    assert.equal((await f.apps.owner.inject({url:'/api/cards/'+cardId})).json().activities.filter((a:any)=>a.action==='card.moved').length,1);
    assert.equal((await f.apps.owner.inject({method:'POST',url:moveUrl,payload:{columnId:columns[2].id,version:1}})).statusCode,409);
    // Cached commands must still reject a suspended actor.
    await f.db.run("UPDATE memberships SET status='suspended' WHERE id=?",[f.ids.owner]);
    assert.equal((await f.apps.owner.inject({method:'POST',url,headers,payload})).statusCode,403);
  }finally{await f.close();}
});
