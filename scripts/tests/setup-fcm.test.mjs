import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {validateFcm,assignFcm} from '../setup-fcm.mjs';
const privateKey=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'});
const config={expo:{owner:'team-owner',slug:'team',extra:{eas:{projectId:'project-id'}},android:{package:'team.cookies.tracker'}}};
const sdk={project_info:{project_id:'test-project'},client:[{client_info:{android_client_info:{package_name:'team.cookies.tracker'}}}]};
const key={type:'service_account',private_key:privateKey,private_key_id:'test-key',client_email:'sender@test-project.iam.gserviceaccount.com',project_id:'test-project'};
test('Firebase files must agree on project and Android package before a credential can be uploaded',()=>{
 assert.equal(validateFcm(config,sdk,key).firebaseProject,'test-project');
 assert.throws(()=>validateFcm(config,sdk,{...key,project_id:'another-project'}));
 assert.throws(()=>validateFcm(config,{...sdk,client:[]},key));
 assert.throws(()=>validateFcm(config,sdk,{...key,private_key:'not-a-key'}));
 assert.throws(()=>validateFcm(config,sdk,{...key,client_email:'another@example.com'}));
});
test('rerunning setup retains the assigned key and only updates the FCM binding',async()=>{
 const assigned={id:'credential',privateKeyIdentifier:key.private_key_id,clientEmail:key.client_email};
 let uploads=0;const api={
  createOrGetExistingAndroidAppCredentialsWithBuildCredentialsAsync:async()=>({id:'app-credentials',googleServiceAccountKeyForFcmV1:assigned}),
  createGoogleServiceAccountKeyAsync:async()=>{uploads++;return assigned;},
  updateAndroidAppCredentialsAsync:async(_graphql,cred,input)=>{assert.equal(cred.id,'app-credentials');assert.deepEqual(input,{googleServiceAccountKeyForFcmV1Id:'credential'});return {googleServiceAccountKeyForFcmV1:assigned};},
 };
 await assignFcm(api,{}, {id:'expo-app',slug:'team',ownerAccount:{name:'team-owner'}},key,'team.cookies.tracker');
 assert.equal(uploads,0);
});
test('changing the actual key uploads it once and rejects an unconfirmed Expo assignment',async()=>{
 let uploads=0;const api={
  createOrGetExistingAndroidAppCredentialsWithBuildCredentialsAsync:async()=>({id:'app-credentials'}),
  createGoogleServiceAccountKeyAsync:async()=>{uploads++;return {id:'new-key'};},
  updateAndroidAppCredentialsAsync:async()=>({googleServiceAccountKeyForFcmV1:{privateKeyIdentifier:'wrong-key'}}),
 };
 await assert.rejects(()=>assignFcm(api,{}, {id:'expo-app',slug:'team',ownerAccount:{name:'team-owner'}},key,'team.cookies.tracker'));
 assert.equal(uploads,1);
});
