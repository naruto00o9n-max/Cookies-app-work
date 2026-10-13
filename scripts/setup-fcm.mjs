import {createRequire} from 'node:module';
import {createPrivateKey} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function validateFcm(config,sdk,key) {
  const expo=config?.expo;
  if(!expo?.owner||!expo.slug||!expo.extra?.eas?.projectId)throw new Error('Link the Expo project before configuring FCM.');
  if(key?.type!=='service_account'||typeof key.private_key!=='string'||!key.private_key_id||!key.client_email||!key.project_id)throw new Error('FIREBASE_SERVICE_ACCOUNT must contain the private service account JSON file.');
  if(!key.client_email.endsWith(`@${key.project_id}.iam.gserviceaccount.com`))throw new Error('The service account email does not match its Firebase project.');
  if(sdk?.project_info?.project_id!==key.project_id)throw new Error('GOOGLE_SERVICES_JSON and FIREBASE_SERVICE_ACCOUNT belong to different Firebase projects.');
  if(!sdk.client?.some(c=>c.client_info?.android_client_info?.package_name===expo.android?.package))throw new Error('The Firebase Android SDK file does not match the Android package.');
  try{if(createPrivateKey(key.private_key).asymmetricKeyType!=='rsa')throw new Error('Invalid RSA key');}catch{throw new Error('The service account private key is invalid.');}
  return {projectId:expo.extra.eas.projectId,owner:expo.owner,slug:expo.slug,androidPackage:expo.android.package,firebaseProject:key.project_id};
}
export async function assignFcm(api,graphql,app,key,androidPackage) {
  const lookup={account:app.ownerAccount,projectName:app.slug,androidApplicationIdentifier:androidPackage};
  const credentials=await api.createOrGetExistingAndroidAppCredentialsWithBuildCredentialsAsync(graphql,lookup);
  let uploaded=credentials.googleServiceAccountKeyForFcmV1;
  if(uploaded?.privateKeyIdentifier!==key.private_key_id||uploaded?.clientEmail!==key.client_email)uploaded=await api.createGoogleServiceAccountKeyAsync(graphql,app.ownerAccount,key);
  const updated=await api.updateAndroidAppCredentialsAsync(graphql,credentials,{googleServiceAccountKeyForFcmV1Id:uploaded.id});
  if(updated.googleServiceAccountKeyForFcmV1?.privateKeyIdentifier!==key.private_key_id)throw new Error('Expo did not confirm the assigned FCM credential.');
  return {projectId:app.id,androidPackage,firebaseProject:key.project_id};
}
async function main() {
  const token=process.env.EXPO_TOKEN;
  if(!token)throw new Error('Missing EXPO_TOKEN in GitHub Actions secrets.');
  let sdk,key;
  try{sdk=JSON.parse(process.env.GOOGLE_SERVICES_JSON||'');key=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT||'');}catch{throw new Error('Add both GOOGLE_SERVICES_JSON and FIREBASE_SERVICE_ACCOUNT as JSON GitHub Actions secrets.');}
  const config=JSON.parse(await readFile(path.join(root,'mobile/app.json'),'utf8'));
  const expected=validateFcm(config,sdk,key),easRoot=process.env.EAS_CLI_ROOT;
  if(!easRoot)throw new Error('The pinned EAS CLI installation is missing.');
  const require=createRequire(path.join(easRoot,'package.json'));
  const {createGraphqlClient}=require('./build/commandUtils/context/contextUtils/createGraphqlClient.js');
  const {AppQuery}=require('./build/graphql/queries/AppQuery.js');
  const api=require('./build/credentials/android/api/GraphqlClient.js');
  const graphql=createGraphqlClient({accessToken:token});
  const app=await AppQuery.byIdAsync(graphql,expected.projectId);
  if(app.id!==expected.projectId||app.ownerAccount?.name!==expected.owner||app.slug!==expected.slug)throw new Error('Expo returned a different project or owner. No credentials were changed.');
  const result=await assignFcm(api,graphql,app,key,expected.androidPackage);
  console.log(`FCM v1 configured: @${expected.owner}/${expected.slug}, ${result.androidPackage}, Firebase ${result.firebaseProject}. Private key contents are not logged.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('FCM setup failed. Confirm the Expo token can manage this project and that both Firebase JSON secrets are correct. Private credential details are withheld.');process.exitCode=1;});
