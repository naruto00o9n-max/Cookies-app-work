import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
try {
 const config=JSON.parse(await readFile(path.join(root,'mobile/app.json'),'utf8')).expo;
 if(!process.env.EXPO_TOKEN||!process.env.EAS_CLI_ROOT)throw new Error('Missing Expo tooling');
 const require=createRequire(path.join(process.env.EAS_CLI_ROOT,'package.json'));
 const {createGraphqlClient}=require('./build/commandUtils/context/contextUtils/createGraphqlClient.js');
 const {AppQuery}=require('./build/graphql/queries/AppQuery.js');
 const ios=require('./build/credentials/ios/api/GraphqlClient.js');
 const client=createGraphqlClient({accessToken:process.env.EXPO_TOKEN});
 const app=await AppQuery.byIdAsync(client,config.extra.eas.projectId);
 if(app.ownerAccount.name!==config.owner||app.slug!==config.slug)throw new Error('Unexpected Expo owner');
 const credentials=await ios.getIosAppCredentialsWithCommonFieldsAsync(client,{account:app.ownerAccount,projectName:app.slug,bundleIdentifier:config.ios.bundleIdentifier});
 console.log(JSON.stringify({iosPushReadiness:{bundleIdentifier:config.ios.bundleIdentifier,appCredentialsConfigured:Boolean(credentials),apnsKeyConfigured:Boolean(credentials?.pushKey),appleTeamConfigured:Boolean(credentials?.appleTeam)}}));
} catch { console.error('Could not read iOS push credential metadata. No credentials were changed.');process.exitCode=1;}
