jest.mock('../../src/models/User',()=>({findById:jest.fn()}));
jest.mock('../../src/services/workspaceService',()=>({activeMembership:jest.fn()}));
jest.mock('../../src/models/Device',()=>require('../helpers/fakeCollection').fakeCollection());
jest.mock('../../src/models/Agent',()=>require('../helpers/fakeCollection').fakeCollection());
jest.mock('../../src/models/AgentRun',()=>require('../helpers/fakeCollection').fakeCollection());
jest.mock('../../src/models/AgentAction',()=>require('../helpers/fakeCollection').fakeCollection());
jest.mock('../../src/models/Threat',()=>require('../helpers/fakeCollection').fakeCollection());
jest.mock('../../src/services/deviceService',()=>({ONLINE_MS:180000}));
jest.mock('../../src/services/findingService',()=>({OPEN:['new','investigating','acknowledged']}));
const models=['Device','Agent','AgentRun','AgentAction','Threat'].map(n=>require('../../src/models/'+n));
const [Device,Agent,Run,Action,Threat]=models;
const {summary}=require('../../src/services/consoleSummary');
const alice={userId:'507f1f77bcf86cd799439011',workspaceId:'workspace-a'};
const bob={userId:'507f1f77bcf86cd799439012',workspaceId:'workspace-b'};
beforeEach(()=>models.forEach(m=>m.reset()));
test('counts beyond page limits, excludes other accounts and expired approvals',async()=>{
 for(let i=0;i<205;i++)await Device.create({workspaceId:alice.workspaceId,state:'active',lastSeenAt:new Date()});
 await Device.create({workspaceId:bob.workspaceId,state:'active',lastSeenAt:new Date()});
 await Agent.create({workspaceId:alice.workspaceId,state:'active'});
 await Run.create({workspaceId:alice.workspaceId,state:'running'});
 await Action.create({workspaceId:alice.workspaceId,state:'proposed',expiresAt:new Date(Date.now()+60000)});
 await Action.create({workspaceId:alice.workspaceId,state:'proposed',expiresAt:new Date(Date.now()-60000)});
 await Threat.create({user:alice.userId,status:'new',severity:'critical'});
 await Threat.create({user:bob.userId,status:'new',severity:'critical'});
 const s=await summary(alice);
 expect(s.metrics.devices).toMatchObject({value:205,exact:true,scope:'workspace'});
 expect(s.metrics.onlineDevices.value).toBe(205);
 expect(s.metrics.pendingApprovals.value).toBe(1);
 expect(s.metrics.urgentFindings).toMatchObject({value:1,scope:'account'});
 expect(s.metrics.activeRuns.value).toBe(1);
});
test('a failed count is unavailable, never a measured zero',async()=>{
 const spy=jest.spyOn(Device,'countDocuments').mockRejectedValue(new Error('database unavailable'));
 const s=await summary(alice);expect(s.metrics.devices).toMatchObject({value:null,state:'unavailable',exact:false});
 expect(s.metrics.activeAgents).toMatchObject({value:0,state:'ready',exact:true});spy.mockRestore();
});
test('rejects an unverified threat owner',async()=>{await expect(summary({workspaceId:'a'})).rejects.toThrow('verified');});
test('summary route requires verified identity and workspace membership',()=>{
 const fs=require('fs'),path=require('path');const source=fs.readFileSync(path.join(__dirname,'../../src/routes/consoleV1.js'),'utf8');
 expect(source).toMatch(/router.get\('\/console\/summary', verifiedUser, requireWorkspace/);
 expect(source).toContain('summary(req.user)');expect(source).not.toContain('summary(req.query');
});


describe('authenticated summary HTTP boundary',()=>{
 const express=require('express');
 const {serve}=require('../helpers/http');
 const User=require('../../src/models/User');
 const {activeMembership}=require('../../src/services/workspaceService');
 const {signSessionToken}=require('../../src/services/sessionTokens');
 const user={_id:alice.userId,email:'alice@example.com',role:'user',defaultWorkspaceId:alice.workspaceId,isActive:true,isLocked:()=>false,activity:{},save:jest.fn()};
 let api;
 beforeAll(async()=>{const app=express();app.use('/api/v1',require('../../src/routes/consoleV1'));api=await serve(app);});
 afterAll(async()=>api.close());
 beforeEach(()=>{User.findById.mockResolvedValue(user);activeMembership.mockResolvedValue({role:'owner'});});
 const get=(path='/api/v1/console/summary',token=signSessionToken(user))=>api.request(path,{headers:token?{Authorization:'Bearer '+token}:{}});
 test('missing and invalid sessions are refused',async()=>{
  expect((await get(undefined,null)).status).toBe(401);
  expect((await get(undefined,'invalid')).status).toBe(401);
 });
 test('inactive workspace membership is refused',async()=>{
  activeMembership.mockResolvedValue(null);expect((await get()).status).toBe(403);
 });
 test('caller cannot select another account or workspace through query parameters',async()=>{
  await Device.create({workspaceId:alice.workspaceId,state:'active',lastSeenAt:new Date()});
  await Device.create({workspaceId:bob.workspaceId,state:'active',lastSeenAt:new Date()});
  const res=await get('/api/v1/console/summary?workspaceId='+bob.workspaceId+'&userId='+bob.userId);
  expect(res.status).toBe(200);
  expect(res.body.data.scope).toEqual({accountId:alice.userId,workspaceId:alice.workspaceId});
  expect(res.body.data.metrics.devices.value).toBe(1);
  expect(activeMembership).toHaveBeenCalledWith(alice.workspaceId,alice.userId);
 });
});
