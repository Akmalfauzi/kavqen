import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const db = new PrismaClient();
const expiry = new Date(Date.now() + 30 * 86400000);
const past = new Date(Date.now() - 86400000);
const definitions = [['intake','Consultation Registration'],['feedback','Service Feedback'],['event','Workshop Registration'],['survey','Product Survey'],['code','Information Request'],['expired','Expired Form'],['draft','Follow-up Draft']];
async function main() {
 const password = await bcrypt.hash('KavqenDemo2026!', 10);
 const admin = await db.role.findUniqueOrThrow({where:{code:'ADMIN'}});
 const participant = await db.role.findUniqueOrThrow({where:{code:'USER'}});
 const users = [];
 for (const [key,name,roleId] of [['owner','Dina Owner Demo',admin.id],['participant','Raka Participant Demo',participant.id],['other','Nadia Participant Demo',participant.id]]) {
  const data={name,password,roleId,deletedAt:null,phone:'+6281200000000',company:'Kavqen Demo',language:'en'};
  users.push(await db.user.upsert({where:{email:`${key}@demo.kavqen.test`},create:{email:`${key}@demo.kavqen.test`,...data},update:{...data,authVersion:{increment:1},resetTokenHash:null,resetTokenExpiresAt:null}}));
 }
 const [owner,user,other]=users;
 const fields=[{name:'demo_full_name',label:'Full name',type:'string',required:true,options:[],prompt_hint:'Ask for the full name and confirm spelling.'},{name:'demo_phone',label:'Phone number',type:'phone',required:true,options:[],prompt_hint:'Ask for the complete phone number and confirm every digit.'},{name:'demo_notes',label:'Notes',type:'text',required:false,options:[],prompt_hint:'Ask for any additional requirements or feedback.'}];
 for(const field of fields) await db.field.upsert({where:{name:field.name},create:{...field,category:'Demo'},update:{...field,deletedAt:null}});
 for(const [key,title] of definitions){
  const id=`demo-workflow-${key}`;
  const nodes=fields.map((f,i)=>({id:`demo-step-${i}`,type:i===0?'trigger':'step',title:f.label,position:{x:320,y:40+i*220},config:{step_name:f.label,purpose:f.prompt_hint,target_fields:[f.name]}}));
  const edges=nodes.slice(1).map((n,i)=>({id:`demo-edge-${i}`,source:nodes[i].id,target:n.id}));
  const data={name:`Demo - ${title}`,description:'A demo scenario using fictional data.',ownerId:owner.id,status:key==='draft'?'DRAFT':'PUBLISHED',deletedAt:null,data:{nodes,edges,publishedFields:fields}};
  await db.workflow.upsert({where:{id},create:{id,...data},update:data});
  if(key==='draft') continue;
  writeFileSync(`../../configs/${id}.json`,JSON.stringify({theme_id:id,title:data.name,description:data.description,nodes,edges,fields},null,2));
  const invite=['event','survey'].includes(key);
  const code={workflowId:id,createdById:owner.id,codeHash:createHash('sha256').update(`KQ-DEMO-${key.toUpperCase()}`).digest('hex'),prefix:'KQ-DEMO',expiresAt:key==='expired'?past:expiry,revokedAt:null,inviteEmail:invite?user.email:null,inviteStatus:invite?'PENDING':null};
  await db.accessCode.upsert({where:{id:`demo-code-${key}`},create:{id:`demo-code-${key}`,...code},update:code});
  if(['intake','feedback','expired'].includes(key)) await db.formGrant.upsert({where:{userId_workflowId:{userId:user.id,workflowId:id}},create:{userId:user.id,workflowId:id,accessCodeId:`demo-code-${key}`,expiresAt:code.expiresAt},update:{accessCodeId:`demo-code-${key}`,expiresAt:code.expiresAt}});
 }
 for(const [index,key,actor,notes] of [[1,'intake',user,'Morning consultation request.'],[2,'intake',user,'Additional request for next week.'],[3,'expired',user,'History recorded before access expired.'],[4,'intake',other,'Nadia\'s submission, not Raka\'s.']] as const){
  const data={workflowId:`demo-workflow-${key}`,userId:actor.id,agentName:'Demo Assistant',data:{demo_full_name:actor.name,demo_phone:'+6281200000000',demo_notes:notes},createdAt:new Date(Date.now()-index*86400000)};
  await db.submission.upsert({where:{id:`demo-submission-${index}`},create:{id:`demo-submission-${index}`,...data},update:data});
 }
 await db.knowledgeDocument.upsert({where:{id:'demo-knowledge-guide'},create:{id:'demo-knowledge-guide',ownerId:owner.id,title:'Demo Service Guide',category:'Demo',content:'Service hours are Monday to Friday, 9am to 5pm (GMT+7). All demo data is fictional.'},update:{title:'Demo Service Guide',category:'Demo',content:'Service hours are Monday to Friday, 9am to 5pm (GMT+7). All demo data is fictional.',deletedAt:null}});
 for(const [key,userId,title] of [['event',user.id,'Workshop Registration invitation'],['survey',user.id,'Product Survey invitation'],['submission',owner.id,'Demo submissions available']]){
  const data={userId,title,description:key==='submission'?'Four sample submissions are available from Raka and Nadia.':'Open the dashboard to accept or decline the invitation.',kind:key==='submission'?'submission':'invitation'};
  await db.userNotification.upsert({where:{id:`demo-notification-${key}`},create:{id:`demo-notification-${key}`,...data},update:{...data,readAt:null,deletedAt:null}});
 }
 console.log('Demo prepared. Expiry:',expiry.toISOString());
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
